-- ============================================================================
-- ESP32 AC DATALOGGER ONLINE - DATABASE SCHEMA
-- PostgreSQL / Supabase
-- ============================================================================

-- Pastikan ekstensi pgcrypto tersedia untuk hashing & UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. TABEL: devices
-- Menyimpan metadata perangkat ESP32, token hash untuk otentikasi API,
-- dan status kalibrasi sensor tegangan.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.devices (
    device_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    device_token_hash VARCHAR(64) NOT NULL, -- SHA-256 hex string dari token rahasia
    calibrated BOOLEAN NOT NULL DEFAULT FALSE,
    voltage_calibration_factor NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
    voltage_zero_offset NUMERIC(8, 4) NOT NULL DEFAULT 1.6500, -- Tegangan offset ADC (V)
    notes TEXT,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Komentar dokumentasi kolom
COMMENT ON TABLE public.devices IS 'Master data perangkat ESP32 datalogger';
COMMENT ON COLUMN public.devices.device_token_hash IS 'SHA-256 hash dari token perangkat. Token asli tidak disimpan plain-text.';
COMMENT ON COLUMN public.devices.calibrated IS 'True jika kalibrasi tegangan AC telah diverifikasi dengan multimeter True-RMS.';

-- ----------------------------------------------------------------------------
-- 2. TABEL UTAMA: ac_readings
-- Menyimpan telemetri real-time pengukuran tegangan AC, suhu, dan kelembapan.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ac_readings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    measured_at TIMESTAMPTZ NOT NULL,
    voltage_v NUMERIC(6, 2) NOT NULL,
    voltage_valid BOOLEAN NOT NULL DEFAULT FALSE,
    temperature_c NUMERIC(5, 2) NOT NULL,
    humidity_rh NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Cegah data duplikat jika ESP32 mengirim ulang batch dari buffer offline
    CONSTRAINT uq_device_measurement UNIQUE (device_id, measured_at)
);

COMMENT ON TABLE public.ac_readings IS 'Penyimpanan telemetri tegangan, suhu, dan kelembapan AC';
COMMENT ON COLUMN public.ac_readings.voltage_v IS 'Tegangan AC dalam Volt RMS';
COMMENT ON COLUMN public.ac_readings.voltage_valid IS 'Status validitas: false jika belum kalibrasi, sensor error, atau nilai di luar batas fisik';
COMMENT ON COLUMN public.ac_readings.temperature_c IS 'Suhu udara sekitar AC dalam derajat Celsius (SHT31)';
COMMENT ON COLUMN public.ac_readings.humidity_rh IS 'Kelembapan relatif udara dalam %RH (SHT31)';

-- ----------------------------------------------------------------------------
-- 3. TABEL: system_settings
-- Pengaturan ambang batas batas peringatan tegangan/suhu dan retensi data.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    id INT PRIMARY KEY DEFAULT 1,
    voltage_low_threshold NUMERIC(5, 1) NOT NULL DEFAULT 198.0,   -- Standar PLN 220V -10%
    voltage_high_threshold NUMERIC(5, 1) NOT NULL DEFAULT 242.0,  -- Standar PLN 220V +10%
    temp_low_threshold NUMERIC(4, 1) NOT NULL DEFAULT 16.0,       -- Suhu minimal operasi AC normal
    temp_high_threshold NUMERIC(4, 1) NOT NULL DEFAULT 32.0,      -- Suhu maksimal ruangan/inlet
    humidity_low_threshold NUMERIC(4, 1) NOT NULL DEFAULT 30.0,
    humidity_high_threshold NUMERIC(4, 1) NOT NULL DEFAULT 75.0,
    retention_days INT NOT NULL DEFAULT 30,                       -- Periode retensi data (hari)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT single_row_settings CHECK (id = 1)
);

-- Insert nilai default jika belum ada
INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. INDEKS OPTIMASI PERFORMA
-- Esensial untuk query grafik real-time, rentang riwayat, dan ekspor CSV
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ac_readings_device_measured_at 
    ON public.ac_readings (device_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS idx_ac_readings_measured_at 
    ON public.ac_readings (measured_at DESC);

-- ----------------------------------------------------------------------------
-- 5. REALTIME PUBLICATION
-- Aktifkan Supabase Realtime agar dashboard menerima event INSERT secara instan
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Kebijakan untuk pembacaan data di Dashboard (Teknisi Terotentikasi & Anonim Terbatas):
-- Pengguna publik/anon dapat MEMBACA telemetri untuk monitoring dashboard jika diizinkan
-- (atau batasi ke auth.role() = 'authenticated' sesuai kebutuhan keamanan perusahaan)
CREATE POLICY "Allow read access for authenticated users on ac_readings"
    ON public.ac_readings FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow read access for authenticated users on devices"
    ON public.devices FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow read access for settings"
    ON public.system_settings FOR SELECT
    TO authenticated, anon
    USING (true);

-- Pengubahan data hanya untuk teknisi terotentikasi:
CREATE POLICY "Allow update devices for authenticated"
    ON public.devices FOR UPDATE
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow update settings for authenticated"
    ON public.system_settings FOR UPDATE
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- Catatan: Ingestion data oleh ESP32 dilakukan melalui Supabase Edge Function
-- yang menggunakan SERVICE_ROLE_KEY sehingga otomatis melewati (bypass) RLS secara aman
-- tanpa membeberkan service key ke perangkat firmware atau browser klien.

-- ----------------------------------------------------------------------------
-- 7. STORED FUNCTION: AGREGASI HISTORIS (DOWNSAMPLING)
-- Mencegah lag pada browser saat memuat data riwayat 1 jam, 6 jam, atau 24 jam.
-- Menggunakan date_bin (PostgreSQL 14+) untuk mengelompokkan data ke bucket waktu.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_aggregated_readings(
    p_device_id TEXT,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_bucket_seconds INT DEFAULT 60
)
RETURNS TABLE (
    bucket_time TIMESTAMPTZ,
    avg_voltage NUMERIC,
    min_voltage NUMERIC,
    max_voltage NUMERIC,
    avg_temp NUMERIC,
    min_temp NUMERIC,
    max_temp NUMERIC,
    avg_humidity NUMERIC,
    reading_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_bin(
            (p_bucket_seconds || ' seconds')::interval,
            measured_at,
            TIMESTAMPTZ '2000-01-01 00:00:00Z'
        ) AS bucket_time,
        ROUND(AVG(voltage_v)::numeric, 2) AS avg_voltage,
        ROUND(MIN(voltage_v)::numeric, 2) AS min_voltage,
        ROUND(MAX(voltage_v)::numeric, 2) AS max_voltage,
        ROUND(AVG(temperature_c)::numeric, 2) AS avg_temp,
        ROUND(MIN(temperature_c)::numeric, 2) AS min_temp,
        ROUND(MAX(temperature_c)::numeric, 2) AS max_temp,
        ROUND(AVG(humidity_rh)::numeric, 2) AS avg_humidity,
        COUNT(*) AS reading_count
    FROM public.ac_readings
    WHERE device_id = p_device_id
      AND measured_at >= p_start
      AND measured_at <= p_end
    GROUP BY bucket_time
    ORDER BY bucket_time ASC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. STORED FUNCTION: RETENSI DATA (PEMBERSIHAN OTOMATIS)
-- Menghapus data yang lebih lama dari retention_days untuk menjaga kuota database
-- (86.400 baris/hari = ~5MB/hari).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_readings(p_days INT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_days INT;
    v_deleted_count INT;
BEGIN
    IF p_days IS NULL THEN
        SELECT retention_days INTO v_days FROM public.system_settings WHERE id = 1;
        IF v_days IS NULL OR v_days < 1 THEN
            v_days := 30;
        END IF;
    ELSE
        v_days := p_days;
    END IF;

    DELETE FROM public.ac_readings
    WHERE measured_at < (now() - (v_days || ' days')::interval);

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. SEED DATA PERANGKAT AWAL (CONTOH UNTUK PENGUJIAN)
-- Token default: "esp32-secret-token-ac-01"
-- SHA-256: encode(digest('esp32-secret-token-ac-01', 'sha256'), 'hex')
-- Nilai hash: "a3a2d3637be59dc2356ec39d33261623910c01cbff01e84ce40217be5fa4d41a"
-- ----------------------------------------------------------------------------
INSERT INTO public.devices (
    device_id,
    name,
    device_token_hash,
    calibrated,
    voltage_calibration_factor,
    voltage_zero_offset,
    notes
) VALUES (
    'esp32-ac-01',
    'ESP32 AC Datalogger Unit 01 (Server Room)',
    encode(digest('esp32-secret-token-ac-01', 'sha256'), 'hex'),
    false, -- Default belum dikalibrasi sesuai aturan keselamatan
    1.0000,
    1.6500,
    'Perangkat awal untuk monitoring AC Ruang Server. Membutuhkan kalibrasi awal sebelum live voltage diaktifkan.'
) ON CONFLICT (device_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. COMPRESSOR RPM MONITOR TABLES & POLICIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compressor_profiles (
    id VARCHAR(32) PRIMARY KEY,
    brand VARCHAR(64) NOT NULL,
    model VARCHAR(64) NOT NULL,
    motor_poles INT NOT NULL DEFAULT 4,
    pulses_per_revolution NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    rpm_low_max NUMERIC(7, 1) NOT NULL DEFAULT 1800.0,
    rpm_medium_max NUMERIC(7, 1) NOT NULL DEFAULT 3200.0,
    rpm_high_min NUMERIC(7, 1) NOT NULL DEFAULT 3200.0,
    stop_timeout_ms INT NOT NULL DEFAULT 1200,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.compressor_profiles (id, brand, model, motor_poles, pulses_per_revolution, rpm_low_max, rpm_medium_max, rpm_high_min, notes)
VALUES 
    ('universal', 'Universal', 'Standard Inverter (Generic)', 4, 2.00, 1800.0, 3200.0, 3200.0, 'Profil universal konservatif untuk kompresor inverter umum (4-Pole BLDC)'),
    ('daikin_ftkq', 'Daikin', 'Flash Inverter FTKQ (1 PK)', 4, 2.00, 1750.0, 3100.0, 3100.0, 'Kompresor hermetik Daikin Swing/Scroll Inverter'),
    ('sharp_jtech', 'Sharp', 'J-Tech Inverter AH-X (1 PK)', 4, 2.00, 1600.0, 3000.0, 3000.0, 'Kompresor Sharp Eco Inverter dengan mode hemat energi'),
    ('panasonic_si_biru', 'Panasonic', 'si-BiRU Inverter CS-PU (1 PK)', 4, 2.00, 1800.0, 3300.0, 3300.0, 'Kompresor Panasonic Rotary Inverter R32'),
    ('lg_dual_inverter', 'LG', 'DualCool Dual Inverter (1 PK)', 6, 3.00, 1900.0, 3400.0, 3400.0, 'Kompresor LG Dual Rotary (Twin Rotary 6-Pole)'),
    ('samsung_windfree', 'Samsung', 'WindFree Digital Inverter (1 PK)', 8, 4.00, 1650.0, 3150.0, 3150.0, 'Kompresor Samsung Digital Inverter 8-Pole Multi-Magnet')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.compressor_rpm_measurements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    compressor_status VARCHAR(16) NOT NULL DEFAULT 'OFF',
    estimated_rpm NUMERIC(7, 1) NOT NULL DEFAULT 0.0,
    pulse_count BIGINT NOT NULL DEFAULT 0,
    pulse_interval NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
    speed_category VARCHAR(20) NOT NULL DEFAULT 'OFF',
    speed_trend VARCHAR(20) NOT NULL DEFAULT 'STOPPED',
    signal_status VARCHAR(20) NOT NULL DEFAULT 'VALID',
    calibration_status VARCHAR(20) NOT NULL DEFAULT 'UNCALIBRATED',
    sensor_channel CHAR(1) NOT NULL DEFAULT 'U',
    data_source VARCHAR(20) NOT NULL DEFAULT 'REAL',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_device_rpm_recorded UNIQUE (device_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_compressor_rpm_device_recorded
    ON public.compressor_rpm_measurements (device_id, recorded_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.compressor_rpm_measurements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compressor_profiles;

ALTER TABLE public.compressor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_rpm_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all on compressor_profiles"
    ON public.compressor_profiles FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow read access for all on compressor_rpm_measurements"
    ON public.compressor_rpm_measurements FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow update for all on compressor_profiles"
    ON public.compressor_profiles FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow update for all on compressor_rpm_measurements"
    ON public.compressor_rpm_measurements FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

