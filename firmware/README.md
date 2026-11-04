# Panduan Firmware ESP32 AC Datalogger

Firmware ini dirancang khusus untuk **ESP32 DevKit V1** (30-pin atau 38-pin) untuk membaca tegangan AC (RMS) dan sensor suhu/kelembapan SHT31, lalu mengirimkan telemetri setiap 1 detik ke Supabase Edge Functions.

---

## 1. Komponen Hardware & Pinout

| Komponen | Pin ESP32 | Keterangan |
| :--- | :--- | :--- |
| **SHT31 SDA** | `GPIO21` | I2C Data (dilengkapi pull-up internal/eksternal) |
| **SHT31 SCL** | `GPIO22` | I2C Clock |
| **SHT31 VCC** | `3V3` | Sumber daya logika 3.3V |
| **SHT31 GND** | `GND` | Ground bersama (Ground logika) |
| **Transduser AC (Vout)** | `GPIO34` | Input Analog ADC1 (Input Only, bebas noise Wi-Fi) |
| **Transduser AC (VCC)** | `3V3` atau `5V` | Sesuai spesifikasi modul transduser |
| **Transduser AC (GND)** | `GND` | Ground logika ESP32 |

> **PERINGATAN KESELAMATAN PLN:**
> Jangan sekali-kali menghubungkan kabel fasa (L) atau netral (N) PLN 220V ke pin mana pun di ESP32. Sisi tegangan tinggi PLN HANYA boleh terhubung ke terminal input transduser yang terisolasi galvanik (misalnya transformator ZMPT101B tertutup)!

---

## 2. Cara Mengompilasi di Arduino IDE

1. **Install Arduino IDE** (versi 2.x disarankan).
2. **Install ESP32 Board Package**:
   - Buka `File` > `Preferences`.
   - Masukkan URL package board manager:
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Buka `Tools` > `Board` > `Boards Manager`, cari **esp32** oleh Espressif Systems, lalu klik **Install**.
3. **Pilih Board & Port**:
   - Board: `ESP32 Dev Module` atau `DOIT ESP32 DEVKIT V1`
   - Upload Speed: `921600` atau `115200`
   - CPU Frequency: `240MHz (WiFi/BT)`
   - Flash Frequency: `80MHz`
   - Partition Scheme: `Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)`
   - Port: Pilih port COM yang terdeteksi (misal `COM3`, `COM4`).
4. **Dependensi Library**:
   - Firmware menggunakan driver I2C SHT31 internal mandiri (zero-dependency).
   - Tidak memerlukan library pihak ketiga tambahan di luar library bawaan ESP32 Core (`WiFi`, `HTTPClient`, `WiFiClientSecure`, `Wire`).

---

## 3. Langkah Konfigurasi `config.h`

Sebelum melakukan upload, buka file [`config.h`](file:///d:/datalogger/firmware/config.h) dan sesuaikan:

1. **Wi-Fi**:
   ```cpp
   #define WIFI_SSID         "SSID_WIFI_2.4GHZ"
   #define WIFI_PASSWORD     "PASSWORD_WIFI"
   ```
2. **Endpoint Supabase Edge Function**:
   ```cpp
   #define SUPABASE_INGEST_URL "https://<PROJECT-ID>.supabase.co/functions/v1/ingest-telemetry"
   ```
3. **Identitas & Token Perangkat**:
   ```cpp
   #define DEVICE_ID           "esp32-ac-01"
   #define DEVICE_SECRET_TOKEN "esp32-secret-token-ac-01"
   ```
4. **Status Kalibrasi**:
   - Pertahankan `#define IS_CALIBRATED false` untuk pengujian pertama.
   - Setelah tegangan diverifikasi dengan multimeter True-RMS, ubah menjadi `true` dan sesuaikan `VOLTAGE_CALIBRATION_FACTOR`.

---

## 4. Pengujian Awal (Zero-Voltage & Baseline)

1. Lakukan upload pertama kali dengan input `GPIO34` terhubung ke divider tegangan DC 1.65V (atau modul transduser yang belum dicolokkan ke PLN).
2. Buka **Serial Monitor** pada baudrate `115200`.
3. Pastikan output menampilkan:
   - Koneksi Wi-Fi berhasil (`WIFI CONNECTED`).
   - SHT31 membaca suhu normal ruangan (misal 26°C - 30°C) dan kelembapan normal (50% - 75%).
   - Tegangan AC menampilkan `0.0 VAC (BELUM_KALIBRASI)`.
   - Data berhasil terkirim ke Supabase dengan status HTTP `200` atau `201`.
