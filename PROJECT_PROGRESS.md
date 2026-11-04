# DOKUMENTASI PROGRES PENGEMBANGAN: UNIVERSAL INVERTER ANALYZER
## Integrasi Fitur Compressor RPM Monitor ke Dashboard Utama & Grafik Terpadu

Dokumen ini mencatat seluruh status pekerjaan, audit kode, revisi integrasi grafik terpadu, komponen yang dibuat dan diintegrasikan, pengujian, serta verifikasi fungsi sistem.

---

## 1. STATUS PROJECT
- **Status Keseluruhan**: **SELESAI & TERVALIDASI (UNIFIED MONITORING CHART READY)**
- **Versi Build Frontend**: Vite v6.4.5 / React 18.3.1 (Production Build: `dist/` berhasil tanpa error)
- **Kompatibilitas Firmware**: ESP32 DevKit V1 (True-RMS + SHT31 + Single-Channel Isolated Optocoupler)
- **Database & API**: PostgreSQL / Supabase Realtime + Edge Function `ingest-telemetry`
- **Integrasi Grafik**: **SATU GRAFIK UTAMA TERPADU (Unified Multi-Series Chart)**. Seluruh data AC Tegangan RMS, Compressor RPM, Suhu, dan Kelembapan ditampilkan dalam satu timeline yang sama tanpa grafik RPM terpisah.

---

## 2. REVISI UTAMA: GRAFIK MONITORING TERPADU (UNIFIED CHART)

Sesuai instruksi revisi:
1. **Penghapusan Total Grafik RPM Terpisah**:
   - Menghapus komponen `CompressorRpmChart.jsx`.
   - Menggabungkan seri Compressor RPM ke dalam komponen grafik utama yang sudah ada ([`RealtimeCharts.jsx`](file:///d:/datalogger/dashboard/src/components/RealtimeCharts.jsx)).
2. **Sistem Multi-Series & Multi-Axis dalam Satu Grafik**:
   - **X-Axis (Waktu)**: Menggunakan sumbu waktu seragam yang sinkron untuk semua seri telemetri.
   - **Y-Axis Kiri (`yAxisId="voltage"`)**: Skala Tegangan Listrik AC True-RMS (160V - 260V, warna Amber `#f59e0b`, unit `V`).
   - **Y-Axis Kanan 1 (`yAxisId="rpm"`)**: Skala Compressor Estimated RPM (0 - 4800 RPM, warna Electric Orange `#f97316`, unit ` RPM`).
   - **Y-Axis Kanan 2 (`yAxisId="environmental"`)**: Skala Suhu Evaporator (warna Red `#ef4444`, unit `°C`) dan Kelembapan Relatif (warna Cyan `#06b6d4`, unit `%RH`).
3. **Legend Interaktif (Toggle On/Off Seri Data)**:
   - Teknisi dapat mengklik tombol badge pada legend untuk menyembunyikan atau menampilkan masing-masing seri (`[✓] Compressor RPM`, `[✓] Tegangan AC RMS`, `[✓] Suhu Udara`, `[✓] Kelembapan`).
   - Sumbu Y terkait otomatis disesuaikan atau disembunyikan saat serinya dinonaktifkan.
4. **Analisis Langsung & Statistik Cepat pada Grafik Utama**:
   - Menampilkan baris statistik RPM di header grafik:
     - **RPM Saat Ini** & Status (`RUNNING` / `OFF`)
     - **Kategori Kecepatan** (`LOW` / `MEDIUM` / `HIGH`)
     - **Arah Tren** (`ACCELERATING ↗` / `DECELERATING ↘` / `STABLE`)
     - **RPM Minimum** periode observasi
     - **RPM Rata-rata** periode observasi
     - **RPM Maksimum (Puncak)** periode observasi
5. **Penanda Timeline Event Kompresor (Reference Dots)**:
   - Penanda visual otomatis saat:
     - *Mulai Bekerja* (Start dari 0 ke >400 RPM, hijau)
     - *Mencapai Kategori HIGH* (> batas kalibrasi HIGH, merah)
     - *Akselerasi Cepat* (Tren naik, oranye)
     - *Deselerasi* (Tren turun, cyan)
     - *Kompresor Berhenti* (Drop ke 0 RPM, abu-abu)
6. **Tooltip Komprehensif Lintas Parameter**:
   - Saat kursor diarahkan atau disentuh di smartphone, tooltip menampilkan seluruh data pada detik yang sama:
     - Waktu pengukuran
     - Compressor RPM (dengan badge kategori LOW/MED/HIGH dan arah tren)
     - Tegangan AC (V RMS)
     - Suhu udara (°C)
     - Kelembapan relatif (%RH)
7. **Sinkronisasi Timestamp**:
   - Data disinkronkan berbasis resolusi detik (1-second time bucket).
   - Tidak ada pengisian data palsu. Parameter yang tidak tersedia pada detik tertentu tetap bernilai `null` tanpa merusak kurva data lain.
8. **Filter Waktu Terpadu**:
   - Pilihan filter waktu simultan untuk seluruh seri: `Live (Buffer)`, `1 Jam`, `6 Jam`, `12 Jam`, `24 Jam`, `7 Hari`, dan `Rentang Tanggal Khusus`.

---

## 3. SUSUNAN LAYOUT DASHBOARD UTAMA
Struktur halaman [`DashboardPage.jsx`](file:///d:/datalogger/dashboard/src/pages/DashboardPage.jsx):
1. **Ringkasan Kondisi AC** ([`StatusCards.jsx`](file:///d:/datalogger/dashboard/src/components/StatusCards.jsx)): Tegangan AC RMS, Suhu, Kelembapan, dan Titik Embun.
2. **Ringkasan RPM Compressor** ([`CompressorRpmSummary.jsx`](file:///d:/datalogger/dashboard/src/components/CompressorRpmSummary.jsx)): Estimated RPM, Status, Kategori Speed, Trend, Status Sensor, Kalibrasi.
3. **GRAFIK MONITORING UTAMA TERPADU** ([`RealtimeCharts.jsx`](file:///d:/datalogger/dashboard/src/components/RealtimeCharts.jsx)): Grafik multi-axis gabungan Tegangan RMS, RPM, Suhu, dan Kelembapan.
4. **Distribusi Kecepatan LOW/MEDIUM/HIGH** ([`CompressorSpeedAnalysis.jsx`](file:///d:/datalogger/dashboard/src/components/CompressorSpeedAnalysis.jsx)): Durasi, persentase waktu, Min/Max/Avg RPM berbasis batas kalibrasi.
5. **Analisis Perilaku Compressor** ([`CompressorBehaviorAnalysis.jsx`](file:///d:/datalogger/dashboard/src/components/CompressorBehaviorAnalysis.jsx)): Indikator status dinamika dan narasi otomatis.
6. **Riwayat Pengukuran Telemetri & Log RPM** ([`CompressorHistoryLog.jsx`](file:///d:/datalogger/dashboard/src/components/CompressorHistoryLog.jsx)): Tabel rekaman telemetri terpadu dengan tombol ekspor CSV.
7. **Statistik Sesi Berjalan Listrik AC & Fluktuasi Terdeteksi**: Ringkasan dip/sag dan lonjakan tegangan PLN.

---

## 4. DAFTAR FILE YANG DIUBAH / DIHAPUS PADA REVISI INI

| No | File Path | Status | Deskripsi |
|---|---|---|---|
| 1 | `dashboard/src/components/RealtimeCharts.jsx` | Dimodifikasi | Mengintegrasikan seri Compressor RPM ke grafik utama dengan multi-axis, legend toggle, event markers, filter waktu, dan tooltip terpadu. |
| 2 | `dashboard/src/pages/DashboardPage.jsx` | Dimodifikasi | Menghapus import dan pemanggilan grafik RPM terpisah; menempatkan `RealtimeCharts` sebagai satu-satunya grafik utama. |
| 3 | `dashboard/src/components/CompressorRpmChart.jsx` | Dihapus | Dihapus secara permanen agar tidak ada grafik RPM yang berdiri sendiri. |
| 4 | `PROJECT_PROGRESS.md` | Dimodifikasi | Memperbarui dokumentasi revisi grafik monitoring terpadu. |
| 5 | `dashboard/src/pages/HistoryPage.jsx` | Dimodifikasi | Memperbaiki bug pergantian mode (Terpadu, Log RPM, Listrik & Suhu), join data AC + RPM, anti-flicker key unik, dan animasi slide-down baris baru. |
| 6 | `dashboard/src/index.css` | Dimodifikasi | Menambahkan animasi `@keyframes rowSlideDown` yang halus tanpa flicker dan `contain: layout`. |
| 7 | `firmware/ac_datalogger/config.h` & `firmware/config.h` | Dimodifikasi | Menambahkan parameter `#define VOLTAGE_TRIM_OFFSET_V 5.0f` untuk kompensasi selisih 5V lebih rendah terhadap Multimeter True-RMS. |
| 8 | `firmware/ac_datalogger/ac_datalogger.ino` & `firmware/ac_datalogger.ino` | Dimodifikasi | Menerapkan `VOLTAGE_TRIM_OFFSET_V` pada hasil perhitungan True-RMS sebelum transmisi telemetri. |
| 9 | `dashboard/src/context/AppContext.jsx` & `SettingsPage.jsx` | Dimodifikasi | Menambahkan opsi `voltageTrimOffset` pada pengaturan web untuk kalibrasi instan tanpa perlu re-flash via USB. |

---

## 5. PENGUJIAN & VALIDASI

1. **Vite Production Build**:
   - Perintah: `npm --prefix d:\datalogger\dashboard run build`
   - Hasil: Berhasil 100% tanpa error (`✓ 2268 modules transformed. built in 3.45s`).
2. **Pengujian Multi-Series & Legend Toggle**:
   - Seri RPM, Tegangan RMS, Suhu, dan Kelembapan berhasil di-toggle on/off secara independen melalui legend.
3. **Pengujian Sinkronisasi Timeline**:
   - Seluruh seri berbagi sumbu X waktu yang sama.
   - Tooltip menampilkan data seluruh parameter pada titik waktu yang sama.
4. **Pengujian Responsivitas Mobile & Expand View**:
   - Tombol pembesar grafik (Expand Mode) berfungsi meluaskan tinggi grafik dari 384px menjadi 480px.
   - Grafik tetap responsif pada layar kecil smartphone (vertikal layout).
