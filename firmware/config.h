/**
 * ============================================================================
 * ESP32 AC DATALOGGER ONLINE - CONFIGURATION FILE
 * ============================================================================
 * Pisahkan seluruh konfigurasi perangkat keras, jaringan, dan kalibrasi
 * dari logika program utama.
 * 
 * PERINGATAN KESELAMATAN:
 * - JANGAN PERNAH menghubungkan 220-240 VAC PLN langsung ke pin ESP32!
 * - Gunakan transduser tegangan terisolasi galvanik (misal ZMPT101B / modul terisolasi).
 * - JANGAN ubah IS_CALIBRATED menjadi true sebelum diverifikasi dengan multimeter True-RMS.
 * ============================================================================
 */

#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ----------------------------------------------------------------------------
// 1. KONFIGURASI WI-FI
// ----------------------------------------------------------------------------
#define WIFI_SSID             "CSI_TECH-ext"         // Ganti dengan SSID Wi-Fi 2.4GHz
#define WIFI_PASSWORD         "Csitech12345"     // Ganti dengan Password Wi-Fi
#define WIFI_RECONNECT_MS     5000                     // Interval percobaan koneksi ulang jika terputus

// ----------------------------------------------------------------------------
// 2. IDENTITAS PERANGKAT & SUPABASE EDGE FUNCTION
// ----------------------------------------------------------------------------
#define DEVICE_ID             "esp32-ac-01"            // Harus sesuai dengan kolom device_id di DB
#define DEVICE_SECRET_TOKEN   "esp32-secret-token-ac-01" // Token rahasia yang di-hash di DB

// URL Supabase Edge Function Anda
// Format lengkap: https://<PROJECT_REF>.supabase.co/functions/v1/ingest-telemetry
#define SUPABASE_INGEST_URL   "https://ixgcqgtwzjjfleipdgzz.supabase.co/functions/v1/ingest-telemetry"

// Timeout request HTTP dalam milidetik (5000 ms: responsif, mencegah freeze loop)
#define HTTP_TIMEOUT_MS       5000

// Verifikasi SSL/TLS:
// Atur true untuk produksi dengan menyertakan Root CA certificate (misal Let's Encrypt ISRG Root X1)
// Atur false HANYA untuk tahap pengujian awal / prototipe laboratorium.
#define TLS_VERIFY_CERTIFICATE false

// ----------------------------------------------------------------------------
// 3. PINOUT HARDWARE (ESP32 DevKit V1)
// ----------------------------------------------------------------------------
// SHT31 I2C Bus:
#define PIN_I2C_SDA           21                       // GPIO21 untuk SDA I2C
#define PIN_I2C_SCL           22                       // GPIO22 untuk SCL I2C
#define SHT31_I2C_ADDRESS     0x44                     // Alamat default SHT31 (0x44 atau 0x45)

// Sensor Tegangan AC Analog:
// GPIO34 adalah pin Input-Only (ADC1_CH6), bebas dari noise pull-up internal & Wi-Fi conflict
#define PIN_VOLTAGE_ADC       34                       // GPIO34 untuk input analog transduser AC

// Sensor Pulsa Kompresor Inverter (Optocoupler Terisolasi - Satu Kanal Fasa):
// DILARANG sambung langsung ke kabel kompresor U/V/W! Wajib lewat isolated front-end.
#define PIN_COMPRESSOR_RPM    33                       // GPIO33 untuk input pulsa terisolasi optocoupler
#define COMPRESSOR_CHANNEL    'U'                      // Fasa yang dimonitor: 'U', 'V', atau 'W'
#define ENABLE_RPM_SIMULATOR  false                    // Setel true untuk pengujian simulator tanpa inverter fisik
#define RPM_SIMULATOR_MODE    1                        // 0=OFF, 1=LOW, 2=MED, 3=HIGH, 4=ACCEL, 5=DECEL, 6=UNSTABLE, 7=LOST

// ----------------------------------------------------------------------------
// 3.1 PENYADAP KABEL DATA SINYAL TERMINAL 3 (OPTOCOUPLER 220V TERISOLASI)
// ----------------------------------------------------------------------------
// Sisi AC Optocoupler: Input 1 ke Terminal 3 (Sinyal S), Input 2 ke Terminal 2 (Netral N)
// Sisi DC Optocoupler: VCC ke 3.3V ESP32, GND ke GND, OUT ke GPIO16 (RX2)
#define ENABLE_TERMINAL3_SNIFFER true                  // Aktifkan penyadapan kabel sinyal Terminal 3
#define PIN_SIGNAL_RX         16                       // GPIO16 (Hardware Serial2 RX ESP32)
#define PIN_SIGNAL_TX         -1                       // Mode penyadap pasif (-1, TX tidak digunakan)
#define SIGNAL_BAUDRATE       2400                     // Baudrate standar Sharp J-Tech / Universal (2400 bps)
#define SIGNAL_UART_CONFIG    SERIAL_8E1               // 8 data bits, Even parity, 1 stop bit (Sharp standard)
#define SIGNAL_INVERT         true                     // True = membalik logika transistor optocoupler otomatis

// ----------------------------------------------------------------------------
// 4. PARAMETER PENGUKURAN TEGANGAN AC (RMS)
// ----------------------------------------------------------------------------
#define AC_FREQUENCY_HZ       50                       // Frekuensi listrik PLN Indonesia: 50 Hz (1 siklus = 20 ms)
#define AC_CYCLES_TO_SAMPLE   5                        // Jumlah siklus gelombang yang disampel (5 siklus = 100 ms)
#define SAMPLES_PER_CYCLE     80                       // Jumlah sampel ADC per siklus (4000 Hz sample rate)
#define TOTAL_SAMPLES         (AC_CYCLES_TO_SAMPLE * SAMPLES_PER_CYCLE) // 400 sampel

// ADC ESP32: 12-bit (0 - 4095), rentang referensi ~3.3V dengan ADC_11db
#define ADC_RESOLUTION_BITS   12
#define ADC_MAX_VALUE         4095.0f
#define ADC_REF_VOLTAGE       3.3f                     // Tegangan referensi nominal 3.3V

// ----------------------------------------------------------------------------
// 5. STATUS & FAKTOR KALIBRASI TEGANGAN
// ATURAN KESELAMATAN:
// Tetap setel IS_CALIBRATED = false sampai teknisi memverifikasi pembacaan
// terhadap multimeter True-RMS standar.
// ----------------------------------------------------------------------------
#define IS_CALIBRATED         true                    // True = sensor sudah dikalibrasi; False = "Belum dikalibrasi"

// Nilai tegangan offset DC titik tengah gelombang (disesuaikan dengan modul Anda: 2.390V)
#define ADC_ZERO_OFFSET_VOLTS 2.390f

// Faktor pengali kalibrasi tegangan AC RMS
// Cara kalibrasi ulang:
//   1. Catat pembacaan ESP32 dan multimeter True-RMS secara bersamaan.
//   2. Hitung: FAKTOR_BARU = FAKTOR_LAMA × (V_Multimeter / V_ESP32)
//   3. Contoh jika multimeter = 220V dan ESP32 = 215V:
//      FAKTOR_BARU = 444.84 × (220 / 215) = 455.18
#define VOLTAGE_CALIBRATION_FACTOR 444.84f

// ─── KOREKSI OFFSET LINEAR TEGANGAN (VOLTAGE TRIM OFFSET) ───────────────────
// Gunakan ini untuk memperbaiki selisih tetap antara ESP32 dan multimeter
// TANPA perlu mengubah VOLTAGE_CALIBRATION_FACTOR.
//
// Cara penggunaan:
//   Jika multimeter membaca LEBIH TINGGI dari ESP32 → isi dengan angka POSITIF.
//   Jika multimeter membaca LEBIH RENDAH dari ESP32  → isi dengan angka NEGATIF.
//
// Contoh masalah Anda: ESP32 lebih rendah 5V dari multimeter.
//   → Setel VOLTAGE_TRIM_OFFSET_V = +5.0f
//
// Jika tidak perlu koreksi offset, setel ke 0.0f.
#define VOLTAGE_TRIM_OFFSET_V  5.0f                   // +5.0V: kompensasi selisih ESP32 vs Multimeter

// Ambang batas noise minimal (Volt): jika RMS di bawah nilai ini, dianggap 0 VAC (kabel mati)
#define NOISE_THRESHOLD_VOLTS 10.0f

// ----------------------------------------------------------------------------
// 6. INTERVAL TRANSMISI & BUFFERING OFFLINE
// ----------------------------------------------------------------------------
#define TELEMETRY_INTERVAL_MS 2000                     // Kirim data setiap 2 detik (mencegah TLS flood & connection refused)
#define OFFLINE_QUEUE_CAPACITY 120                     // Kapasitas buffer antrean offline di RAM (120 rekaman / 4 menit)
#define BATCH_DRAIN_SIZE      5                        // Jumlah maksimum rekaman offline yang dikirim per batch (ringan & cepat)

#endif // CONFIG_H
