-- ============================================================================
-- COMPRESSOR RPM MONITOR - DATABASE SCHEMA MIGRATION
-- PostgreSQL / Supabase
-- Tabel telemetri pulsa & estimasi RPM kompresor inverter AC (Single-Channel U/V/W)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABEL: compressor_profiles
-- Preset model dan konfigurasi motor kompresor (Pole count, batas RPM)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compressor_profiles (
    id VARCHAR(32) PRIMARY KEY,
    brand VARCHAR(64) NOT NULL,
    model VARCHAR(64) NOT NULL,
    motor_poles INT NOT NULL DEFAULT 4,             -- Umumnya 4 pole atau 6 pole pada kompresor inverter
    pulses_per_revolution NUMERIC(6, 2) NOT NULL DEFAULT 2.00,
    rpm_low_max NUMERIC(7, 1) NOT NULL DEFAULT 1800.0,
    rpm_medium_max NUMERIC(7, 1) NOT NULL DEFAULT 3200.0,
    rpm_high_min NUMERIC(7, 1) NOT NULL DEFAULT 3200.0,
    stop_timeout_ms INT NOT NULL DEFAULT 1200,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.compressor_profiles IS 'Katalog parameter motor kompresor inverter AC untuk kalibrasi estimasi RPM';

-- Masukkan Profil Default untuk Merek-Merek Populer di Indonesia
INSERT INTO public.compressor_profiles (id, brand, model, motor_poles, pulses_per_revolution, rpm_low_max, rpm_medium_max, rpm_high_min, notes)
VALUES 
    ('universal', 'Universal', 'Standard Inverter (Generic)', 4, 2.00, 1800.0, 3200.0, 3200.0, 'Profil universal konservatif untuk kompresor inverter umum (4-Pole BLDC)'),
    ('daikin_ftkq', 'Daikin', 'Flash Inverter FTKQ (1 PK)', 4, 2.00, 1750.0, 3100.0, 3100.0, 'Kompresor hermetik Daikin Swing/Scroll Inverter'),
    ('sharp_jtech', 'Sharp', 'J-Tech Inverter AH-X (1 PK)', 4, 2.00, 1600.0, 3000.0, 3000.0, 'Kompresor Sharp Eco Inverter dengan mode hemat energi'),
    ('panasonic_si_biru', 'Panasonic', 'si-BiRU Inverter CS-PU (1 PK)', 4, 2.00, 1800.0, 3300.0, 3300.0, 'Kompresor Panasonic Rotary Inverter R32'),
    ('lg_dual_inverter', 'LG', 'DualCool Dual Inverter (1 PK)', 6, 3.00, 1900.0, 3400.0, 3400.0, 'Kompresor LG Dual Rotary (Twin Rotary 6-Pole)'),
    ('samsung_windfree', 'Samsung', 'WindFree Digital Inverter (1 PK)', 8, 4.00, 1650.0, 3150.0, 3150.0, 'Kompresor Samsung Digital Inverter 8-Pole Multi-Magnet')
ON CONFLICT (id) DO UPDATE SET
    motor_poles = EXCLUDED.motor_poles,
    pulses_per_revolution = EXCLUDED.pulses_per_revolution,
    rpm_low_max = EXCLUDED.rpm_low_max,
    rpm_medium_max = EXCLUDED.rpm_medium_max,
    rpm_high_min = EXCLUDED.rpm_high_min;

-- ----------------------------------------------------------------------------
-- 2. TABEL: compressor_rpm_measurements
-- Tabel data telemetri historis kecepatan putaran kompresor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compressor_rpm_measurements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    compressor_status VARCHAR(16) NOT NULL DEFAULT 'OFF',  -- 'OFF', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'
    estimated_rpm NUMERIC(7, 1) NOT NULL DEFAULT 0.0,
    pulse_count BIGINT NOT NULL DEFAULT 0,
    pulse_interval NUMERIC(10, 2) NOT NULL DEFAULT 0.0,     -- Interval antar pulsa dalam mikrodetik
    speed_category VARCHAR(20) NOT NULL DEFAULT 'OFF',     -- 'OFF', 'LOW', 'MEDIUM', 'HIGH', 'ACCELERATING', 'DECELERATING', 'UNKNOWN'
    speed_trend VARCHAR(20) NOT NULL DEFAULT 'STOPPED',     -- 'STABLE', 'ACCELERATING', 'DECELERATING', 'STOPPED', 'UNKNOWN'
    signal_status VARCHAR(20) NOT NULL DEFAULT 'VALID',    -- 'VALID', 'NO_SIGNAL', 'UNSTABLE', 'NOISE_DETECTED'
    calibration_status VARCHAR(20) NOT NULL DEFAULT 'UNCALIBRATED', -- 'UNCALIBRATED', 'CALIBRATED'
    sensor_channel CHAR(1) NOT NULL DEFAULT 'U',           -- 'U', 'V', atau 'W'
    data_source VARCHAR(20) NOT NULL DEFAULT 'REAL',       -- 'REAL', 'SIMULATOR'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_device_rpm_recorded UNIQUE (device_id, recorded_at)
);

COMMENT ON TABLE public.compressor_rpm_measurements IS 'Log telemetri kecepatan putar (ESTIMATED RPM) kompresor inverter AC';
COMMENT ON COLUMN public.compressor_rpm_measurements.estimated_rpm IS 'Estimasi RPM mekanik motor kompresor berdasarkan frekuensi fasa listrik';
COMMENT ON COLUMN public.compressor_rpm_measurements.calibration_status IS 'UNCALIBRATED jika profil belum diverifikasi; CALIBRATED jika diverifikasi';
COMMENT ON COLUMN public.compressor_rpm_measurements.data_source IS 'REAL jika dari kabel fisik; SIMULATOR jika dari generator uji coba';

-- ----------------------------------------------------------------------------
-- 3. INDEKS OPTIMASI PENCARIAN & GRAFIK
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compressor_rpm_device_recorded
    ON public.compressor_rpm_measurements (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_compressor_rpm_recorded
    ON public.compressor_rpm_measurements (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_compressor_rpm_status
    ON public.compressor_rpm_measurements (device_id, compressor_status, recorded_at DESC);

-- ----------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.compressor_rpm_measurements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.compressor_profiles;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.compressor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compressor_rpm_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all on compressor_profiles"
    ON public.compressor_profiles FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow insert/update for all on compressor_profiles"
    ON public.compressor_profiles FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow read access for all on compressor_rpm_measurements"
    ON public.compressor_rpm_measurements FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Allow insert/update for all on compressor_rpm_measurements"
    ON public.compressor_rpm_measurements FOR ALL
    TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. STORED FUNCTION: RINGKASAN PERILAKU KOMPRESOR (BEHAVIOR ANALYTICS)
-- Menghitung durasi per kategori kecepatan, RPM Min, Max, Rata-rata,
-- dan frekuensi siklus ON/OFF tanpa membebani browser.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_compressor_rpm_analytics(
    p_device_id TEXT,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS TABLE (
    total_samples BIGINT,
    total_active_seconds BIGINT,
    off_seconds BIGINT,
    low_seconds BIGINT,
    medium_seconds BIGINT,
    high_seconds BIGINT,
    min_active_rpm NUMERIC,
    max_active_rpm NUMERIC,
    avg_active_rpm NUMERIC,
    acceleration_events BIGINT,
    deceleration_events BIGINT,
    start_stop_cycles BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT 
            compressor_status,
            estimated_rpm,
            speed_trend,
            LAG(compressor_status) OVER (ORDER BY recorded_at) AS prev_status
        FROM public.compressor_rpm_measurements
        WHERE device_id = p_device_id
          AND recorded_at >= p_start
          AND recorded_at <= p_end
    )
    SELECT
        COUNT(*)::BIGINT AS total_samples,
        COUNT(*) FILTER (WHERE compressor_status IN ('LOW', 'MEDIUM', 'HIGH'))::BIGINT AS total_active_seconds,
        COUNT(*) FILTER (WHERE compressor_status = 'OFF')::BIGINT AS off_seconds,
        COUNT(*) FILTER (WHERE compressor_status = 'LOW')::BIGINT AS low_seconds,
        COUNT(*) FILTER (WHERE compressor_status = 'MEDIUM')::BIGINT AS medium_seconds,
        COUNT(*) FILTER (WHERE compressor_status = 'HIGH')::BIGINT AS high_seconds,
        COALESCE(MIN(estimated_rpm) FILTER (WHERE estimated_rpm > 100), 0.0)::NUMERIC AS min_active_rpm,
        COALESCE(MAX(estimated_rpm) FILTER (WHERE estimated_rpm > 100), 0.0)::NUMERIC AS max_active_rpm,
        COALESCE(AVG(estimated_rpm) FILTER (WHERE estimated_rpm > 100), 0.0)::NUMERIC AS avg_active_rpm,
        COUNT(*) FILTER (WHERE speed_trend = 'ACCELERATING')::BIGINT AS acceleration_events,
        COUNT(*) FILTER (WHERE speed_trend = 'DECELERATING')::BIGINT AS deceleration_events,
        COUNT(*) FILTER (WHERE compressor_status != 'OFF' AND (prev_status = 'OFF' OR prev_status IS NULL))::BIGINT AS start_stop_cycles
    FROM filtered;
END;
$$;
