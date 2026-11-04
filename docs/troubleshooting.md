# Panduan Pemecahan Masalah (Troubleshooting Guide)

Panduan praktis untuk menangani kendala teknis perangkat keras, jaringan Wi-Fi, database Supabase, dan pembacaan sensor pada sistem **ESP32 AC Datalogger Online**.

---

## 1. Masalah Perangkat Keras & Sensor

### A. SHT31 Tidak Merespons (`I2C code 2` atau `CRC Check Gagal`)
- **Gejala**: Serial Monitor menampilkan `[SENSOR ERROR] SHT31 tidak merespons! Periksa wiring SDA/SCL.` atau suhu terbaca `-99.9°C`.
- **Penyebab & Solusi**:
  1. *Salah Pin Wiring*: Pastikan pin `SDA` modul terhubung ke `GPIO21` dan pin `SCL` ke `GPIO22` ESP32.
  2. *Resistor Pull-up Hilang*: Bus I2C membutuhkan resistor pull-up (4.7kΩ) antara SDA ke 3.3V dan SCL ke 3.3V. Beberapa modul breakout SHT31 sudah memiliki resistor SMD pull-up bawaan, namun pastikan nilainya tidak terlalu besar jika kabel panjang (> 30 cm).
  3. *Alamat I2C*: Alamat default SHT31 adalah `0x44`. Jika pin `ADDR` sensor terhubung ke 3.3V, alamatnya berubah menjadi `0x45`. Sesuaikan `#define SHT31_I2C_ADDRESS 0x45` di `config.h`.

### B. Nilai Tegangan AC Terbaca 0 VAC Terus-Menerus
- **Penyebab & Solusi**:
  1. *Offset Titik Tengah DC*: Pastikan tegangan DC pin `GPIO34` berada di sekitar **1.65V**. Jika tegangan DC di pin adalah 0V, ADC tidak dapat membaca bagian setengah gelombang negatif.
  2. *Noise Threshold*: Jika tegangan terukur di bawah nilai `NOISE_THRESHOLD_VOLTS` (default 15V), firmware sengaja mengosongkannya ke 0V untuk mengabaikan induksi liar saat kabel listrik mati.
  3. *Salah GPIO*: Pastikan menggunakan `GPIO34` (Input Only) yang tidak terhubung ke fitur PWM atau pull-up internal.

---

## 2. Masalah Jaringan & Wi-Fi

### A. Wi-Fi Sering Terputus (*Disconnect Loop*)
- **Penyebab & Solusi**:
  1. *Frekuensi 5 GHz vs 2.4 GHz*: ESP32 hanya mendukung jaringan **Wi-Fi 2.4 GHz**. Pastikan router Anda mengaktifkan frekuensi 2.4 GHz (bukan hanya 5 GHz).
  2. *Drop Tegangan Catu Daya (Brownout)*: Modul radio Wi-Fi ESP32 menarik arus puncak hingga 300–500 mA saat transmisi. Jika catu daya 5V/3.3V USB tidak stabil, ESP32 akan mengalami *Brownout Reset*. Gunakan adaptor daya minimal 5V 1A dengan kapasitor elektrolit 470 µF paralel di pin VIN dan GND.

### B. Buffer Offline Mengisi Penuh
- Jika Wi-Fi terputus lebih dari 2 menit, antrean lokal (kapasitas 120 detik) akan menimpa sampel terlama agar memori RAM ESP32 tidak meluap (*drop oldest strategy*). Begitu Wi-Fi kembali online, firmware akan menguras data tertunda dalam kelompok batch (*batch drain*).

---

## 3. Masalah API Supabase & Database

### A. HTTP Error `401 Unauthorized` atau `403 Forbidden`
- **Penyebab & Solusi**:
  1. *Token Perangkat Salah*: Nilai `DEVICE_SECRET_TOKEN` di [`firmware/config.h`](file:///d:/datalogger/firmware/config.h) tidak cocok dengan hash SHA-256 yang tersimpan di kolom `device_token_hash` tabel `devices`.
  2. *Header Hilang*: Pastikan HTTP POST menyertakan header `x-device-id` dan `x-device-token`.
  3. *Otentikasi Edge Function*: Pastikan Edge Function dideploy dengan opsi `--no-verify-jwt`.

### B. Status Realtime di Dashboard Tidak Memperbarui Otomatis
- **Penyebab & Solusi**:
  1. Pastikan tabel `ac_readings` sudah ditambahkan ke publikasi Realtime di Supabase:
     ```sql
     ALTER PUBLICATION supabase_realtime ADD TABLE public.ac_readings;
     ```
  2. Buka console browser (F12) untuk melihat apakah WebSocket terblokir oleh firewall atau ekstensi pemblokir iklan (*ad blocker*).

---

## 4. Manajemen Kuota Database (86.400 Data / Hari)

### Perhitungan Kapasitas:
- 1 Pembacaan / detik = **86.400 baris / hari**.
- Ukuran rata-rata per baris di PostgreSQL = ~60 byte.
- Total penyimpanan per hari = **~5,2 MB / hari** (~155 MB / bulan).
- Kuota Free Tier Supabase: **500 MB** (cukup untuk ~3 bulan pemantauan 1 unit).

### Opsi Pembersihan Otomatis (Maintenance Cron):
Untuk membersihkan data yang lebih lama dari 30 hari secara berkala tanpa menghapus master perangkat:
```sql
-- Jalankan manual di SQL Editor atau jadwalkan via pg_cron:
SELECT public.cleanup_old_readings(30);
```
Dengan memanggil fungsi ini sekali seminggu, penggunaan database akan selalu stabil di kisaran 150 MB.
