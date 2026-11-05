/**
 * ============================================================================
 * ESP32 AC DATALOGGER ONLINE - MAIN FIRMWARE
 * ============================================================================
 * Target: ESP32 DevKit V1
 * Sensor: SHT31 (I2C) & Transduser Tegangan AC Terisolasi (GPIO34)
 *         Compressor Inverter RPM (Isolated Pulse on GPIO33)
 * Platform: Arduino Core for ESP32
 * 
 * Fitur:
 * 1. True RMS Voltage calculation over multiple AC grid cycles (50 Hz).
 * 2. Suhu (°C) & Kelembapan (%RH) via SHT31 dengan validasi CRC8.
 * 3. Compressor RPM Monitor (single channel optocoupler, glitch filter, estimated RPM).
 * 4. Kirim telemetri real-time setiap 1 detik ke Supabase Edge Functions.
 * 5. Otomatis reconnect Wi-Fi dan manajemen timeout.
 * 6. Antrean buffer offline (RAM Ring Buffer) untuk mencegah kehilangan data.
 * 7. Wi-Fi Captive Portal via HP (Hold BOOT button 3s).
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "config.h"
#include "wifi_portal.h"
#include "compressor_rpm.h"

// ----------------------------------------------------------------------------
// INSTANCE COMPRESSOR RPM PROCESSOR & INTERRUPT SERVICE ROUTINE (IRAM SAFE)
// ----------------------------------------------------------------------------
CompressorRpmProcessor rpmProcessor;

// Variabel ISR murni di DRAM internal agar 100% bebas dari Crash Flash Cache (LoadProhibited)
volatile uint32_t isrPulseCount = 0;
volatile uint32_t isrLastPulseMicros = 0;
volatile uint32_t isrPulseIntervalMicros = 0;

void IRAM_ATTR compressorRpmISR() {
  uint32_t now = micros();
  uint32_t interval = now - isrLastPulseMicros;
  if (interval >= 3000) { // Glitch filter: abaikan pulsa < 3ms (~333 Hz cutoff)
    isrPulseIntervalMicros = interval;
    isrLastPulseMicros = now;
    isrPulseCount++;
  }
}

// Helper konversi enum ke string JSON / Serial
const char* getCompressorStatusStr(CompressorStatus s) {
  switch (s) {
    case COMP_STATUS_OFF: return "OFF";
    case COMP_STATUS_LOW: return "LOW";
    case COMP_STATUS_MEDIUM: return "MEDIUM";
    case COMP_STATUS_HIGH: return "HIGH";
    default: return "UNKNOWN";
  }
}

const char* getSpeedCategoryStr(CompressorStatus s, float rpm = 0) {
  return getCompressorStatusStr(s);
}

const char* getSpeedTrendStr(SpeedTrend t) {
  switch (t) {
    case TREND_STABLE: return "STABLE";
    case TREND_ACCELERATING: return "ACCELERATING";
    case TREND_DECELERATING: return "DECELERATING";
    case TREND_STOPPED: return "STOPPED";
    default: return "UNKNOWN";
  }
}

const char* getSignalStatusStr(SignalStatus sig) {
  switch (sig) {
    case SIG_VALID: return "VALID";
    case SIG_NO_SIGNAL: return "NO_SIGNAL";
    case SIG_UNSTABLE: return "UNSTABLE";
    case SIG_NOISE_DETECTED: return "NOISE_DETECTED";
    default: return "UNKNOWN";
  }
}

const char* getCalibrationStatusStr(CalibrationStatus c) {
  return (c == CALIB_CALIBRATED) ? "CALIBRATED" : "UNCALIBRATED";
}

// ----------------------------------------------------------------------------
// STRUKTUR DATA TELEMETRI & BUFFER OFFLINE
// ----------------------------------------------------------------------------
struct TelemetryRecord {
  float voltage_v;
  bool voltage_valid;
  float temperature_c;
  float humidity_rh;
  unsigned long timestamp_millis; // Digunakan untuk menghitung offset waktu relatif saat reconnect
  // Compressor RPM fields
  float estimated_rpm;
  uint32_t pulse_count;
  uint32_t pulse_interval_us;
  CompressorStatus comp_status;
  SpeedTrend speed_trend;
  SignalStatus signal_status;
  CalibrationStatus calibration_status;
  char sensor_channel;
  bool is_simulated_rpm;
};

// Circular Ring Buffer untuk antrean offline
class TelemetryQueue {
private:
  TelemetryRecord buffer[OFFLINE_QUEUE_CAPACITY];
  int head = 0;
  int tail = 0;
  int count = 0;

public:
  bool push(const TelemetryRecord& item) {
    if (count >= OFFLINE_QUEUE_CAPACITY) {
      // Buffer penuh: timpa elemen tertua (drop oldest) agar data terbaru tetap tercatat
      head = (head + 1) % OFFLINE_QUEUE_CAPACITY;
      count--;
    }
    buffer[tail] = item;
    tail = (tail + 1) % OFFLINE_QUEUE_CAPACITY;
    count++;
    return true;
  }

  bool peek(int index, TelemetryRecord& item) const {
    if (index < 0 || index >= count) return false;
    int idx = (head + index) % OFFLINE_QUEUE_CAPACITY;
    item = buffer[idx];
    return true;
  }

  void discard(int n) {
    if (n > count) n = count;
    head = (head + n) % OFFLINE_QUEUE_CAPACITY;
    count -= n;
  }

  bool pop(TelemetryRecord& item) {
    if (count == 0) return false;
    item = buffer[head];
    head = (head + 1) % OFFLINE_QUEUE_CAPACITY;
    count--;
    return true;
  }

  int size() const {
    return count;
  }

  bool isEmpty() const {
    return count == 0;
  }

  void clear() {
    head = 0;
    tail = 0;
    count = 0;
  }
};

TelemetryQueue offlineQueue;

// ----------------------------------------------------------------------------
// VARIABEL STATUS GLOBAL
// ----------------------------------------------------------------------------
unsigned long lastTelemetryMillis = 0;
unsigned long lastWiFiCheckMillis = 0;
bool sht31Available = false;
bool isOnline = false;
float lastPinVrms = 0.0f;
int lastMinADC = 0;
int lastMaxADC = 0;

// ----------------------------------------------------------------------------
// SHT31 I2C DIRECT DRIVER DENGAN VALIDASI CRC-8
// Mencegah dependensi library pihak ketiga yang rumit
// ----------------------------------------------------------------------------
uint8_t calculateSHT31CRC(const uint8_t* data, size_t len) {
  uint8_t crc = 0xFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t bit = 8; bit > 0; --bit) {
      if (crc & 0x80) {
        crc = (crc << 1) ^ 0x31;
      } else {
        crc = (crc << 1);
      }
    }
  }
  return crc;
}

bool initSHT31() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 100000);
  Wire.beginTransmission(SHT31_I2C_ADDRESS);
  uint8_t err = Wire.endTransmission();
  if (err == 0) {
    Serial.println(F("[SENSOR] SHT31 terdeteksi pada alamat I2C 0x44."));
    return true;
  }
  Serial.printf("[SENSOR ERROR] SHT31 tidak merespons (I2C code %d)! Periksa wiring SDA/SCL.\n", err);
  return false;
}

// Cache pembacaan valid terakhir untuk proteksi transien EMI motor inverter
static float lastValidTemp = 0.0f;
static float lastValidHum = 0.0f;
static unsigned long lastValidShtMillis = 0;
static bool hasValidShtData = false;

bool readSHT31(float &tempC, float &humidityRH) {
  if (!sht31Available) {
    tempC = 0.0f;
    humidityRH = 0.0f;
    return false;
  }

  bool readSuccess = false;

  // Lakukan hingga 2 percobaan untuk menangkal transient EMI/glitch motor kompresor
  for (int attempt = 0; attempt < 2 && !readSuccess; attempt++) {
    if (attempt > 0) {
      delay(8);
      Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 100000); // Reset bus I2C jika terkena spike
    }

    // Kirim perintah: Single Shot Measurement, High Repeatability (0x24, 0x00)
    Wire.beginTransmission(SHT31_I2C_ADDRESS);
    Wire.write(0x24);
    Wire.write(0x00);
    if (Wire.endTransmission() != 0) {
      continue;
    }

    delay(15); // Waktu konversi pengukuran SHT31 ~15ms

    // Baca 6 byte: [T_MSB, T_LSB, T_CRC, H_MSB, H_LSB, H_CRC]
    uint8_t bytesReceived = Wire.requestFrom((uint8_t)SHT31_I2C_ADDRESS, (uint8_t)6);
    if (bytesReceived != 6) {
      continue;
    }

    uint8_t rawData[6];
    for (int i = 0; i < 6; i++) {
      rawData[i] = Wire.read();
    }

    // Validasi CRC byte 0-1 (Suhu) dan byte 3-4 (Kelembapan)
    if (calculateSHT31CRC(&rawData[0], 2) != rawData[2] ||
        calculateSHT31CRC(&rawData[3], 2) != rawData[5]) {
      continue;
    }

    uint16_t rawTemp = ((uint16_t)rawData[0] << 8) | rawData[1];
    uint16_t rawHum  = ((uint16_t)rawData[3] << 8) | rawData[4];

    tempC = -45.0f + 175.0f * ((float)rawTemp / 65535.0f);
    humidityRH = 100.0f * ((float)rawHum / 65535.0f);

    if (humidityRH > 100.0f) humidityRH = 100.0f;
    if (humidityRH < 0.0f) humidityRH = 0.0f;

    lastValidTemp = tempC;
    lastValidHum = humidityRH;
    lastValidShtMillis = millis();
    hasValidShtData = true;
    readSuccess = true;
  }

  // Jika kedua attempt gagal (akibat lonjakan induktif transien saat start motor),
  // gunakan nilai valid terakhir (< 10 detik) agar grafik & log tidak drop ke -99.9
  if (!readSuccess) {
    if (hasValidShtData && (millis() - lastValidShtMillis < 10000)) {
      tempC = lastValidTemp;
      humidityRH = lastValidHum;
      return true;
    }
    return false;
  }

  return true;
}

// ----------------------------------------------------------------------------
// TRUE RMS AC VOLTAGE CALCULATION
// Menghitung nilai tegangan efektif dari integral kuadrat sampel gelombang AC
// ----------------------------------------------------------------------------
void initVoltageADC() {
  analogReadResolution(ADC_RESOLUTION_BITS); // 12-bit (0-4095)
  // Konfigurasi atenuasi untuk pin ADC34 agar rentang ukur 0 - ~3.3V
  analogSetPinAttenuation(PIN_VOLTAGE_ADC, ADC_11db);
  pinMode(PIN_VOLTAGE_ADC, INPUT);
}

float calculateVoltageRMS(bool &isValid) {
  if (!IS_CALIBRATED) {
    isValid = false;
  } else {
    isValid = true;
  }

  // Parameter waktu pengambilan sampel:
  // 50 Hz = 20.000 mikrodetik per siklus.
  // Dengan 80 sampel per siklus, interval tiap sampel adalah 250 mikrodetik (4000 Hz).
  const unsigned long sampleIntervalMicros = (1000000UL / AC_FREQUENCY_HZ) / SAMPLES_PER_CYCLE;
  
  static int16_t adcSamples[TOTAL_SAMPLES];
  int64_t sumADC = 0;
  int minSample = 4095;
  int maxSample = 0;

  // TAHAP 1: Ambil 400 sampel gelombang AC dengan oversampling 2x untuk menyaring noise
  for (int i = 0; i < TOTAL_SAMPLES; i++) {
    unsigned long sampleStart = micros();

    int raw1 = analogRead(PIN_VOLTAGE_ADC);
    int raw2 = analogRead(PIN_VOLTAGE_ADC);
    int rawADC = (raw1 + raw2) >> 1;

    adcSamples[i] = (int16_t)rawADC;
    sumADC += rawADC;

    if (rawADC < minSample) minSample = rawADC;
    if (rawADC > maxSample) maxSample = rawADC;

    while ((micros() - sampleStart) < sampleIntervalMicros) {
      // Busy wait mikrodetik yang presisi
    }
  }

  lastMinADC = minSample;
  lastMaxADC = maxSample;

  // Jika selisih min dan max sangat kecil (< 30 count), artinya kabel AC mati
  int peakToPeak = maxSample - minSample;
  if (peakToPeak < 30) {
    lastPinVrms = 0.0f;
    return 0.0f;
  }

  // TAHAP 2: Hitung Titik Tengah DC Dinamis (Auto DC Tracking)
  // Menghilangkan fluktuasi ripple USB / tegangan 5V yang naik-turun secara otomatis!
  double dynamicMeanADC = (double)sumADC / (double)TOTAL_SAMPLES;

  // TAHAP 3: Hitung True-RMS dari selisih gelombang terhadap titik tengah riil
  double sumSquaredDifferences = 0.0;
  for (int i = 0; i < TOTAL_SAMPLES; i++) {
    double acCount = (double)adcSamples[i] - dynamicMeanADC;
    double pinVolts = (acCount / ADC_MAX_VALUE) * ADC_REF_VOLTAGE;
    sumSquaredDifferences += (pinVolts * pinVolts);
  }

  double pinVrms = sqrt(sumSquaredDifferences / (double)TOTAL_SAMPLES);
  lastPinVrms = (float)pinVrms;

  // Kalibrasikan ke tegangan primer PLN 220 VAC
  float rawCalculatedVrms = (float)(pinVrms * VOLTAGE_CALIBRATION_FACTOR);

  // TAHAP 4: Filter EMA (Exponential Moving Average)
  // Menstabilkan pembacaan agar tenang dan tidak melompat-lompat seperti multimeter digital
  static float smoothedVrms = 0.0f;
  if (rawCalculatedVrms < NOISE_THRESHOLD_VOLTS) {
    smoothedVrms = 0.0f;
  } else {
    if (smoothedVrms <= 0.0f || abs(rawCalculatedVrms - smoothedVrms) > 30.0f) {
      smoothedVrms = rawCalculatedVrms; // Respons cepat jika ada lonjakan nyata > 30V
    } else {
      // Filter redam lonjakan: 25% data baru + 75% data stabil sebelumnya
      smoothedVrms = (0.25f * rawCalculatedVrms) + (0.75f * smoothedVrms);
    }
  }

  // Batas fisik kewajaran PLN Indonesia (0 - 350 VAC)
  if (smoothedVrms > 350.0f) {
    isValid = false;
  }

  // ── Koreksi offset linear (VOLTAGE_TRIM_OFFSET_V dari config.h) ──────────
  // Diterapkan hanya jika ada sinyal tegangan nyata (bukan 0 / noise)
  float correctedVrms = smoothedVrms;
  if (smoothedVrms >= NOISE_THRESHOLD_VOLTS) {
    correctedVrms = smoothedVrms + VOLTAGE_TRIM_OFFSET_V;
    // Jaga agar hasil koreksi tidak keluar batas fisik
    if (correctedVrms < 0.0f)   correctedVrms = 0.0f;
    if (correctedVrms > 350.0f) { correctedVrms = 350.0f; isValid = false; }
  }

  return correctedVrms;
}

// ----------------------------------------------------------------------------
// MANAJEMEN WI-FI DENGAN AUTO-RECONNECT
// ----------------------------------------------------------------------------
void setupWiFi() {
  Serial.printf("\n[WIFI] Menghubungkan ke SSID: %s ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < 10000) {
    delay(500);
    Serial.print(F("."));
  }

  if (WiFi.status() == WL_CONNECTED) {
    isOnline = true;
    Serial.printf("\n[WIFI CONNECTED] IP Address: %s | RSSI: %d dBm\n", 
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    isOnline = false;
    Serial.println(F("\n[WIFI TIMEOUT] Gagal terhubung ke Wi-Fi. Mode offline buffer aktif."));
  }
}

// Instance persistent untuk HTTP Keep-Alive
static WiFiClientSecure persistentClient;
static HTTPClient persistentHttp;
static bool clientConfigured = false;

void checkWiFiReconnect() {
  if (WiFi.status() != WL_CONNECTED) {
    isOnline = false;
    // Bersihkan soket persistent jika Wi-Fi putus
    if (persistentHttp.connected()) {
      persistentHttp.end();
      persistentClient.stop();
    }
    // Beri jeda 10 detik agar negosiasi DHCP tidak terganggu pemanggilan berulang
    if (millis() - lastWiFiCheckMillis > 10000) {
      lastWiFiCheckMillis = millis();
      Serial.println(F("[WIFI] Koneksi terputus. Mencoba reconnect..."));
      WiFi.reconnect(); // Tanpa disconnect() agar DHCP lease & 802.11 keys tidak ter-drop
    }
  } else {
    if (!isOnline) {
      isOnline = true;
      Serial.printf("[WIFI RESTORED] Terhubung kembali ke IP: %s | RSSI: %d dBm\n", 
                    WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
  }
}

// ----------------------------------------------------------------------------
// TRANSMISI DATA VIA HTTPS KE SUPABASE EDGE FUNCTIONS (DENGAN HTTP KEEP-ALIVE)
// Menggunakan persistent socket agar tidak menghabiskan soket TIME_WAIT lwIP
// dan bebas dari heap fragmentation mbedTLS.
// ----------------------------------------------------------------------------
bool sendTelemetryPayload(const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  // 1. Konfigurasi awal WiFiClientSecure satu kali saja
  if (!clientConfigured) {
    if (!TLS_VERIFY_CERTIFICATE) {
      persistentClient.setInsecure();
    }
    persistentClient.setTimeout(5000); // 5 detik timeout cukup untuk Keep-Alive
    clientConfigured = true;
  }

  // 2. Jika belum begin atau koneksi putus dari server, lakukan begin ulang
  if (!persistentHttp.connected()) {
    persistentHttp.end();
    persistentClient.stop();

    if (!persistentHttp.begin(persistentClient, SUPABASE_INGEST_URL)) {
      Serial.println(F("[HTTP ERROR] Inisialisasi HTTP client gagal."));
      return false;
    }
    persistentHttp.setReuse(true); // HTTP Keep-Alive: pertahankan koneksi TLS!
    persistentHttp.setTimeout(5000);
  }

  // 3. Pastikan headers terpasang
  persistentHttp.addHeader("Content-Type", "application/json", false, true);
  persistentHttp.addHeader("x-device-id", DEVICE_ID, false, true);
  persistentHttp.addHeader("x-device-token", DEVICE_SECRET_TOKEN, false, true);

  // 4. Kirim HTTP POST
  int httpCode = persistentHttp.POST(jsonPayload);
  bool success = false;

  if (httpCode > 0) {
    // Wajib baca response body untuk mengosongkan stream soket (prasyarat HTTP Keep-Alive)
    String resp = persistentHttp.getString();
    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      success = true;
    } else {
      Serial.printf("[HTTP SERVER WARN] HTTP Code: %d | Response: %s\n", httpCode, resp.c_str());
    }
  } else {
    Serial.printf("[HTTP FAIL] Error: %s (code %d)\n", persistentHttp.errorToString(httpCode).c_str(), httpCode);
    // Jika gagal, reset soket agar request berikutnya membuat koneksi baru
    persistentHttp.end();
    persistentClient.stop();
  }

  return success;
}

// Kirim data pembacaan langsung saat online (termasuk modul Compressor RPM)
bool transmitLiveReading(float voltageV, bool voltageValid, float tempC, float humRH, const CompressorRpmData& rpm) {
  // Format JSON payload lengkap
  char jsonBuffer[512];
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{\"voltage_v\":%.2f,\"voltage_valid\":%s,\"temperature_c\":%.2f,\"humidity_rh\":%.2f,"
    "\"compressor_rpm\":{\"estimated_rpm\":%.0f,\"pulse_count\":%lu,\"pulse_interval_us\":%lu,"
    "\"compressor_status\":\"%s\",\"speed_category\":\"%s\",\"speed_trend\":\"%s\",\"signal_status\":\"%s\","
    "\"calibration_status\":\"%s\",\"sensor_channel\":\"%c\",\"data_source\":\"%s\"}}",
    voltageV,
    voltageValid ? "true" : "false",
    tempC,
    humRH,
    rpm.estimated_rpm,
    rpm.pulse_count,
    rpm.pulse_interval_us,
    getCompressorStatusStr(rpm.status),
    getSpeedCategoryStr(rpm.status, rpm.estimated_rpm),
    getSpeedTrendStr(rpm.trend),
    getSignalStatusStr(rpm.signal_status),
    getCalibrationStatusStr(rpm.calibration_status),
    rpm.sensor_channel,
    rpm.is_simulated ? "SIMULATOR" : "REAL"
  );

  return sendTelemetryPayload(String(jsonBuffer));
}

// Drain antrean buffer offline dalam batch saat koneksi pulih
void drainOfflineQueue() {
  if (offlineQueue.isEmpty() || WiFi.status() != WL_CONNECTED) {
    return;
  }

  int batchCount = 0;
  String batchJson = "{\"readings\":[";
  TelemetryRecord rec;

  while (batchCount < BATCH_DRAIN_SIZE && offlineQueue.peek(batchCount, rec)) {
    if (batchCount > 0) batchJson += ",";

    char itemBuf[384];
    snprintf(itemBuf, sizeof(itemBuf),
      "{\"voltage_v\":%.2f,\"voltage_valid\":%s,\"temperature_c\":%.2f,\"humidity_rh\":%.2f,"
      "\"compressor_rpm\":{\"estimated_rpm\":%.0f,\"pulse_count\":%lu,\"pulse_interval_us\":%lu,"
      "\"compressor_status\":\"%s\",\"speed_category\":\"%s\",\"speed_trend\":\"%s\",\"signal_status\":\"%s\","
      "\"calibration_status\":\"%s\",\"sensor_channel\":\"%c\",\"data_source\":\"%s\"}}",
      rec.voltage_v,
      rec.voltage_valid ? "true" : "false",
      rec.temperature_c,
      rec.humidity_rh,
      rec.estimated_rpm,
      (unsigned long)rec.pulse_count,
      (unsigned long)rec.pulse_interval_us,
      getCompressorStatusStr(rec.comp_status),
      getSpeedCategoryStr(rec.comp_status, rec.estimated_rpm),
      getSpeedTrendStr(rec.speed_trend),
      getSignalStatusStr(rec.signal_status),
      getCalibrationStatusStr(rec.calibration_status),
      rec.sensor_channel,
      rec.is_simulated_rpm ? "SIMULATOR" : "REAL"
    );
    batchJson += itemBuf;
    batchCount++;
  }
  batchJson += "]}";

  if (batchCount == 0) return;

  Serial.printf("[SYNC] Mengirim %d data offline yang tertunda...\n", batchCount);
  bool sent = sendTelemetryPayload(batchJson);

  if (!sent) {
    Serial.println(F("[SYNC WARN] Gagal mengunggah batch offline. Data tetap aman di antrean."));
  } else {
    offlineQueue.discard(batchCount); // HANYA buang antrean setelah sukses terkirim!
    Serial.printf("[SYNC OK] Berhasil mengosongkan batch. Sisa antrean: %d\n", offlineQueue.size());
  }
}

// ----------------------------------------------------------------------------
// TERMINAL 3 SIGNAL BUS SNIFFER (OPTOCOUPLER 220V PADA GPIO16 / SERIAL2)
// Menyadap data serial UART dari kabel komunikasi Indoor-Outdoor (Terminal 3)
// ----------------------------------------------------------------------------
#if ENABLE_TERMINAL3_SNIFFER
static uint8_t signalPacketBuf[64];
static uint8_t signalBufIdx = 0;
static unsigned long lastSignalByteMillis = 0;
static String lastSignalHex = "";
static float decodedSignalRpm = 0.0f;
static bool hasValidSignalFrame = false;

void initTerminal3Sniffer() {
  Serial2.begin(SIGNAL_BAUDRATE, SIGNAL_UART_CONFIG, PIN_SIGNAL_RX, PIN_SIGNAL_TX, SIGNAL_INVERT);
  Serial.printf("[SIGNAL SNIFFER] Penyadapan Terminal 3 aktif pada GPIO%d (Baud: %d, 8E1, Invert: %s)\n",
    PIN_SIGNAL_RX, SIGNAL_BAUDRATE, SIGNAL_INVERT ? "TRUE" : "FALSE");
}

void processTerminal3Signal() {
  while (Serial2.available()) {
    uint8_t b = Serial2.read();
    lastSignalByteMillis = millis();
    if (signalBufIdx < sizeof(signalPacketBuf)) {
      signalPacketBuf[signalBufIdx++] = b;
    }
  }

  // Jika paket selesai diterima (jeda > 15ms setelah byte terakhir pada 2400 baud)
  if (signalBufIdx > 0 && (millis() - lastSignalByteMillis > 15)) {
    lastSignalHex = "";
    for (int i = 0; i < signalBufIdx; i++) {
      if (signalPacketBuf[i] < 0x10) lastSignalHex += "0";
      lastSignalHex += String(signalPacketBuf[i], HEX);
      lastSignalHex += " ";
    }
    lastSignalHex.toUpperCase();
    lastSignalHex.trim();

    Serial.printf("[TERMINAL 3 SNIFFER] %d Bytes: %s\n", signalBufIdx, lastSignalHex.c_str());

    // Decode frekuensi / RPM kompresor inverter jika terdeteksi (Sharp J-Tech / Universal Frame)
    if (signalBufIdx >= 5) {
      uint8_t freqByte = signalPacketBuf[3];
      if (freqByte >= 15 && freqByte <= 140) {
        decodedSignalRpm = (float)freqByte * 30.0f; // Estimasi RPM = Frekuensi Hz * 30 (Motor 4-pole)
        hasValidSignalFrame = true;
      }
    }

    signalBufIdx = 0; // Bersihkan buffer untuk paket berikutnya
  }
}
#endif

// ----------------------------------------------------------------------------
// ARDUINO SETUP & LOOP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println(F("\n========================================================"));
  Serial.println(F("   ESP32 AC DATALOGGER ONLINE - INDUSTRIAL FIRMWARE     "));
  Serial.println(F("========================================================"));
  Serial.printf("Perangkat: %s\n", DEVICE_ID);
  Serial.printf("Frekuensi Jala-jala: %d Hz\n", AC_FREQUENCY_HZ);
  Serial.printf("Interval Pengiriman: %d ms\n", TELEMETRY_INTERVAL_MS);

  // Status kalibrasi
  if (!IS_CALIBRATED) {
    Serial.println(F("--------------------------------------------------------"));
    Serial.println(F("[PERINGATAN KESELAMATAN] Sensor Tegangan BELUM DIKALIBRASI!"));
    Serial.println(F("Status: 'Belum dikalibrasi'. Tegangan ditandai INVALID."));
    Serial.println(F("Jangan gunakan untuk keputusan teknis sebelum kalibrasi."));
    Serial.println(F("--------------------------------------------------------"));
  } else {
    Serial.printf("[STATUS] Kalibrasi AKTIF. Faktor Kalibrasi: %.4f\n", VOLTAGE_CALIBRATION_FACTOR);
  }

  // Inisialisasi sensor I2C & ADC
  sht31Available = initSHT31();
  initVoltageADC();

  // Inisialisasi Modul Compressor RPM Monitor
  rpmProcessor.begin(PIN_COMPRESSOR_RPM);
  CompressorProfile compProf = rpmProcessor.getProfile();
  compProf.sensor_channel = COMPRESSOR_CHANNEL;
  rpmProcessor.setProfile(compProf);
  rpmProcessor.enableSimulator(ENABLE_RPM_SIMULATOR, RPM_SIMULATOR_MODE);

  if (!ENABLE_RPM_SIMULATOR) {
    attachInterrupt(digitalPinToInterrupt(PIN_COMPRESSOR_RPM), compressorRpmISR, FALLING);
    Serial.printf("[RPM] Input pulsa aktif pada GPIO%d (Fasa: %c). Isolated front-end required!\n", PIN_COMPRESSOR_RPM, COMPRESSOR_CHANNEL);
  } else {
    Serial.printf("[RPM SIMULATOR] Simulator RPM Aktif (Mode %d). Data ditandai SIMULATOR.\n", RPM_SIMULATOR_MODE);
  }

  // Inisialisasi Terminal 3 Signal Bus Sniffer (Hardware Serial2 Optocoupler 220V)
  #if ENABLE_TERMINAL3_SNIFFER
  initTerminal3Sniffer();
  #endif

  // Koneksi jaringan Wi-Fi cerdas (dengan memori Flash & Fallback Web Portal)
  isOnline = setupSmartWiFi();

  Serial.println(F("[SYSTEM] Memulai siklus telemetri 1 detik..."));
  Serial.println(F("[TIP] Tahan tombol BOOT (GPIO0) 3 detik untuk membuka Web Portal Wi-Fi kapan saja."));
}

void loop() {
  // 0. Deteksi tombol BOOT (tahan 3 detik untuk buka Web Portal ganti Wi-Fi)
  checkBootButton();

  // 1. Cek kesehatan koneksi Wi-Fi secara berkala
  checkWiFiReconnect();

  // 1.1 Penyadapan paket data serial Terminal 3 kabel sinyal AC secara non-blocking
  #if ENABLE_TERMINAL3_SNIFFER
  processTerminal3Signal();
  #endif

  // 2. Siklus eksekusi setiap TELEMETRY_INTERVAL_MS (1 detik)
  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryMillis >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMillis = currentMillis;

    // A. Baca Sensor SHT31
    float temperatureC = 0.0f;
    float humidityRH = 0.0f;
    bool shtOk = readSHT31(temperatureC, humidityRH);

    // B. Baca & Hitung Tegangan AC RMS
    bool voltageValid = false;
    float voltageRMS = calculateVoltageRMS(voltageValid);

    // C. Baca & Olah Pulsa Compressor Inverter RPM secara atomik & IRAM-Safe
    noInterrupts();
    uint32_t snapPulseCount = isrPulseCount;
    uint32_t snapLastMicros = isrLastPulseMicros;
    uint32_t snapIntervalMicros = isrPulseIntervalMicros;
    interrupts();

    CompressorRpmData rpmData = rpmProcessor.update(snapPulseCount, snapLastMicros, snapIntervalMicros);

    #if ENABLE_TERMINAL3_SNIFFER
    // Jika kabel sinyal Terminal 3 aktif dan terdeteksi RPM dari bus digital
    if (hasValidSignalFrame && decodedSignalRpm > 0) {
      rpmData.estimated_rpm = decodedSignalRpm;
      rpmData.status = decodedSignalRpm > 400 ? COMP_STATUS_MEDIUM : COMP_STATUS_OFF;
      rpmData.signal_status = SIG_VALID;
    }
    #endif

    // D. Cetak diagnostik ke Serial Monitor (termasuk status Free Heap & Wi-Fi)
    Serial.printf("[%lu ms] V: %5.1f VAC | T: %5.1f C | RH: %5.1f %% | RPM: %4.0f (%s, %s, %s) | Heap: %lu KB | WiFi: %s\n",
      currentMillis,
      voltageRMS,
      shtOk ? temperatureC : -99.9f,
      shtOk ? humidityRH : -99.9f,
      rpmData.estimated_rpm,
      getCompressorStatusStr(rpmData.status),
      getSpeedTrendStr(rpmData.trend),
      getSignalStatusStr(rpmData.signal_status),
      (unsigned long)(ESP.getFreeHeap() / 1024),
      (WiFi.status() == WL_CONNECTED) ? "ONLINE" : "OFFLINE"
    );

    // E. Transmisi ke Server atau Simpan ke Buffer Offline
    TelemetryRecord currentReading;
    currentReading.voltage_v = voltageRMS;
    currentReading.voltage_valid = voltageValid;
    currentReading.temperature_c = shtOk ? temperatureC : 0.0f;
    currentReading.humidity_rh = shtOk ? humidityRH : 0.0f;
    currentReading.timestamp_millis = currentMillis;
    // Salin data RPM
    currentReading.estimated_rpm = rpmData.estimated_rpm;
    currentReading.pulse_count = rpmData.pulse_count;
    currentReading.pulse_interval_us = rpmData.pulse_interval_us;
    currentReading.comp_status = rpmData.status;
    currentReading.speed_trend = rpmData.trend;
    currentReading.signal_status = rpmData.signal_status;
    currentReading.calibration_status = rpmData.calibration_status;
    currentReading.sensor_channel = rpmData.sensor_channel;
    currentReading.is_simulated_rpm = rpmData.is_simulated;

    if (WiFi.status() == WL_CONNECTED) {
      bool sent = transmitLiveReading(voltageRMS, voltageValid, currentReading.temperature_c, currentReading.humidity_rh, rpmData);
      if (!sent) {
        // Gagal kirim via HTTPS -> simpan ke antrean offline
        offlineQueue.push(currentReading);
        Serial.printf("[OFFLINE BUFFER] Gagal kirim live. Disimpan ke buffer. Total antrean: %d\n", offlineQueue.size());
      } else {
        // Jika antrean offline memiliki data tertunda, kuras secara bertahap dengan jeda
        if (!offlineQueue.isEmpty()) {
          delay(200);
          drainOfflineQueue();
        }
      }
    } else {
      // Wi-Fi offline -> simpan ke antrean offline
      offlineQueue.push(currentReading);
      Serial.printf("[OFFLINE BUFFER] Wi-Fi putus. Disimpan ke buffer. Total antrean: %d\n", offlineQueue.size());
    }
  }
}
