# PANDUAN TEKNIS & KEAMANAN: COMPRESSOR RPM MONITOR
## Universal Inverter Speed Behavior Analyzer (Single-Channel U/V/W)

---

## 1. Ringkasan Fitur
Fitur **Compressor RPM Monitor** dirancang khusus bagi teknisi pendingin (AC) untuk menganalisis perilaku kecepatan motor kompresor inverter dari waktu ke waktu:
- Mendeteksi kapan kompresor mulai bekerja (*Start/Running*).
- Mendeteksi kapan kompresor bekerja pelan (*LOW Speed*).
- Mendeteksi kapan kompresor meningkatkan kecepatan (*ACCELERATING*).
- Mendeteksi kapan kompresor bekerja kecepatan tinggi (*HIGH Speed / Turbo*).
- Mendeteksi kapan kompresor menurunkan kecepatan (*DECELERATING*).
- Mendeteksi kapan kompresor berhenti (*STOPPED / OFF*).
- Menghitung durasi waktu dan persentase kompresor pada masing-masing tingkat kecepatan.

---

## 2. Arsitektur & Alur Kerja Sistem

```
[ Kabel Kompresor Inverter ] (Salah Satu: U, V, atau W)
             │
             ▼
[ SISI TEGANGAN TINGGI ]
  - Resistor Pembatas Tegangan Tinggi Seri (High-Voltage Resistors, misal 200kΩ - 470kΩ rating 500V+)
  - Rangkaian Penyearah & Clipper / Zener Diode Proteksi Transien
  - Low-Pass Filter Analog (Meredam frekuensi carrier PWM 2-15 kHz)
             │
             ▼
[ ISOLASI GALVANIK 3750V - 5000V ]
  - Optocoupler Cepat / Schmitt-Trigger (misal: 6N137, H11L1, PC817 + RC Filter, atau TLP2362)
             │
             ▼
[ SISI TEGANGAN RENDAH ]
  - Output Pulsa Digital Bersih (0 - 3.3V)
  - Pin Interrupt ESP32 (GPIO33, internal pull-up / pull-down)
  - Glitch Filter & Penghitung Periode Interval Waktu (micros)
             │
             ▼
[ PERHITUNGAN ESTIMATED RPM ]
  - f_fundamental = 1.000.000 / delta_t_micros
  - RPM = (f_fundamental * 120) / Motor_Poles
  - Exponential Moving Average (EMA) Smoothing Filter
             │
             ▼
[ PENGIRIMAN & MONITORING ]
  - Supabase Edge Functions (ingest-telemetry)
  - Tabel: compressor_rpm_measurements
  - Dashboard: Terintegrasi Langsung pada Dashboard Utama (Satu Halaman Terpadu)
```

---

## 3. Peringatan Keselamatan Hardware (SANGAT PENTING)

Keluaran inverter kompresor (U, V, W) mengandung tegangan DC Bus tinggi (300V hingga 400V DC) yang di-switch dengan modulasi PWM frekuensi tinggi dan memiliki lonjakan transien induktif (*high dV/dt*) yang sangat berbahaya.

> [!CAUTION]
> **DILARANG KERAS:**
> 1. Menghubungkan kabel U, V, atau W kompresor langsung ke pin GPIO ESP32.
> 2. Menggunakan modul ZMPT101B untuk mengukur fasa inverter kompresor (ZMPT101B dirancang untuk 50Hz sinusoidal murni PLN, bukan gelombang PWM inverter bertegangan DC common-mode tinggi).
> 3. Menggunakan pembagi resistor sederhana tanpa optocoupler isolasi galvanik.
> 4. Menggunakan optocoupler biasa tanpa resistor rating tegangan tinggi dan proteksi transien di sisi inputnya.

### Persyaratan Desain Rangkaian:
- **Sisi Input (High Voltage):**
  - Gunakan resistor film logam berkategori tegangan tinggi (misal 3 buah resistor 100kΩ 1W yang diseri untuk membagi tegangan dan mematuhi jarak *creepage/clearance*).
  - Pasang dioda proteksi antiparalel / bidirectional TVS (Transient Voltage Suppressor) di depan LED optocoupler.
  - Tambahkan kapasitor keramik untuk menyaring carrier switching PWM frekuensi tinggi (di atas 500 Hz).
- **Sisi Output (Low Voltage):**
  - Kolektor optocoupler ditarik ke 3.3V ESP32 dengan resistor pull-up 4.7kΩ - 10kΩ.
  - Emitter optocoupler terhubung ke GND ESP32.

---

## 4. Cara Kalibrasi & Batasan Akurasi Pengukuran

### Batasan Pengukuran:
Nilai RPM yang dihasilkan sistem ini diberi label **ESTIMATED RPM**, karena:
1. Sistem mengukur **frekuensi fundamental kelistrikan fasa inverter**, bukan mencacah putaran fisik poros motor secara optik langsung.
2. Kecepatan putaran mekanik aktual motor BLDC/IPM sinkron dengan frekuensi medan magnet stator inverter, namun pada kondisi transien atau beban kompresi dinamis, akurasi bergantung pada ketepatan jumlah kutub motor (*motor poles*).

### Rumus Konversi Frekuensi ke RPM:
$$\text{RPM} = \frac{120 \times f_{\text{fundamental}}}{P}$$

| Merek / Tipe Kompresor | Jumlah Pole ($P$) | Pulsa per Putaran | Frekuensi Listrik 30 Hz | Frekuensi Listrik 60 Hz | Frekuensi Listrik 100 Hz |
|---|---|---|---|---|---|
| **Daikin / Sharp / Panasonic (4-Pole)** | 4 | 2.0 | 900 RPM (LOW) | 1800 RPM (MED) | 3000 RPM (HIGH) |
| **LG DualCool (6-Pole)** | 6 | 3.0 | 600 RPM (LOW) | 1200 RPM (LOW) | 2000 RPM (MED) |
| **Samsung Digital Inverter (8-Pole)** | 8 | 4.0 | 450 RPM (LOW) | 900 RPM (LOW) | 1500 RPM (LOW/MED) |

### Prosedur Kalibrasi:
1. Buka **Dashboard utama** Universal Inverter Analyzer.
2. Pada kartu **Ringkasan Kondisi Compressor**, klik tombol **Profil: [Merek]**.
3. Pilih preset yang sesuai dengan unit AC yang sedang diperiksa (misal: Daikin FTKQ, Sharp J-Tech, LG DualCool, Panasonic si-BiRU).
4. Verifikasi kabel fasa yang diklem/disensing (Fasa U, V, atau W).
5. Jika telah dikonfirmasi dengan spesifikasi kompresor, centang opsi **"Tandai Terkalibrasi (Calibrated)"**.

---

## 5. Mode Simulator (Uji Coba Tanpa Hardware)

Untuk menguji tampilan dashboard dan alur analitika tanpa harus menyalakan AC inverter nyata:

### A. Simulator via Web Dashboard:
Di halaman **Compressor RPM Monitor**, terdapat panel kontrol cepat:
- **OFF (0 RPM)**: Menguji kondisi kompresor mati/standby.
- **LOW (~1350 RPM)**: Menguji kondisi putaran hemat energi/beban ringan.
- **MEDIUM (~2550 RPM)**: Menguji kondisi operasi pendinginan normal.
- **HIGH (~3900 RPM)**: Menguji kondisi kompresor ngebut / beban puncak (*Turbo*).
- **Akselerasi ↗**: Menguji kenaikan putaran bertahap (status ACCELERATING).
- **Deselerasi ↘**: Menguji penurunan putaran bertahap (status DECELERATING).
- **Noise / Fluktuatif**: Menguji sinyal terdistorsi (status UNSTABLE).
- **Putus Sinyal**: Menguji sensor terlepas / kabel putus (status NO_SIGNAL).

> Seluruh data simulator diberi tanda tegas `DATA_SOURCE: SIMULATOR` dan tidak dianggap sebagai data pengukuran fisik nyata.

### B. Simulator via Firmware ESP32:
Pada file `firmware/ac_datalogger/config.h`:
```cpp
#define ENABLE_RPM_SIMULATOR  true   // Aktifkan simulator internal ESP32
#define RPM_SIMULATOR_MODE    4      // 4 = Akselerasi bertahap
```

---

## 6. Struktur File yang Ditambahkan & Diubah

| Lokasi File | Status | Keterangan |
|---|---|---|
| `firmware/ac_datalogger/compressor_rpm.h` | **BARU** | Modul interrupt, glitch filter, kalkulasi periodik & simulator RPM |
| `firmware/compressor_rpm.h` | **BARU** | Salinan modul RPM untuk sinkronisasi sketch folder |
| `supabase/compressor_rpm_schema.sql` | **BARU** | DDL tabel `compressor_rpm_measurements`, `compressor_profiles`, RLS, & fungsi agregasi |
| `dashboard/src/pages/RpmMonitorPage.jsx` | **BARU** | Halaman dashboard lengkap: metrik real-time, grafik Recharts, durasi LOW/MED/HIGH, kontrol simulator, dan modal kalibrasi |
| `docs/compressor_rpm_monitor.md` | **BARU** | Dokumentasi teknis, keselamatan hardware, dan prosedur kalibrasi |
| `firmware/ac_datalogger/config.h` | **DIUBAH** | Menambahkan definisi pin `PIN_COMPRESSOR_RPM` (GPIO33), `COMPRESSOR_CHANNEL`, dan simulator mode |
| `firmware/config.h` | **DIUBAH** | Sinkronisasi definisi pin RPM |
| `firmware/ac_datalogger/ac_datalogger.ino` | **DIUBAH** | Integrasi `rpmProcessor`, ISR, dan penambahan JSON payload telemetri |
| `firmware/ac_datalogger.ino` | **DIUBAH** | Sinkronisasi sketch utama |
| `supabase/functions/ingest-telemetry/index.ts` | **DIUBAH** | Menangani ingestion telemetri AC + `compressor_rpm_measurements` secara aman |
| `dashboard/src/context/AppContext.jsx` | **DIUBAH** | State `latestRpmReading`, `rpmRealtimeBuffer`, profil kompresor, dan realtime subscription |
| `dashboard/src/components/Header.jsx` | **DIUBAH** | Menambahkan navigasi menu **Compressor RPM** |
| `dashboard/src/App.jsx` | **DIUBAH** | Routing tab `rpm` ke `RpmMonitorPage` |
