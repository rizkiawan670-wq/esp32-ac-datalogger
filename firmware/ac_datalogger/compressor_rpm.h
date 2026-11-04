/**
 * ============================================================================
 * ESP32 AC DATALOGGER - COMPRESSOR RPM PROCESSOR MODULE
 * ============================================================================
 * Modul pemrosesan pulsa keluaran optocoupler terisolasi dari salah satu
 * jalur fasa kompresor AC Inverter (U, V, atau W).
 * 
 * PERINGATAN KESELAMATAN:
 * - Sinyal keluaran inverter mengandung tegangan tinggi DC Bus (300V-400V) 
 *   dengan modulasi PWM frekuensi tinggi (2-15 kHz).
 * - DILARANG menghubungkan kabel U/V/W langsung ke GPIO ESP32!
 * - Wajib menggunakan rangkaian isolated sensing front-end + optocoupler.
 * - RPM yang dihasilkan berstatus ESTIMATED RPM berdasarkan frekuensi
 *   fundamental fasa dan rasio pole motor kompresor.
 * ============================================================================
 */

#ifndef COMPRESSOR_RPM_H
#define COMPRESSOR_RPM_H

#include <Arduino.h>

// ----------------------------------------------------------------------------
// DEFINISI STATUS DAN KATEGORI KECEPATAN
// ----------------------------------------------------------------------------
enum CompressorStatus {
  COMP_STATUS_OFF,
  COMP_STATUS_LOW,
  COMP_STATUS_MEDIUM,
  COMP_STATUS_HIGH,
  COMP_STATUS_UNKNOWN
};

enum SpeedTrend {
  TREND_STABLE,
  TREND_ACCELERATING,
  TREND_DECELERATING,
  TREND_STOPPED,
  TREND_UNKNOWN
};

enum SignalStatus {
  SIG_VALID,
  SIG_NO_SIGNAL,
  SIG_UNSTABLE,
  SIG_NOISE_DETECTED
};

enum CalibrationStatus {
  CALIB_UNCALIBRATED,
  CALIB_CALIBRATED
};

// Profil Konfigurasi Kompresor
struct CompressorProfile {
  char brand[32];               // Daikin, Sharp, Panasonic, LG, Samsung, Custom
  char model[32];
  uint8_t motor_poles;          // Umumnya 4 pole atau 6 pole pada kompresor inverter
  float pulses_per_revolution;  // Rasio pulsa per putaran mekanis poros kompresor
  float rpm_low_max;            // Batas atas kategori LOW (misal 1800 RPM)
  float rpm_medium_max;         // Batas atas kategori MEDIUM (misal 3200 RPM)
  float rpm_high_min;           // Batas bawah kategori HIGH (misal 3200 RPM ke atas)
  uint32_t stop_timeout_ms;     // Waktu tanpa pulsa untuk dinyatakan OFF (misal 1200 ms)
  uint32_t min_pulse_width_us;  // Filter glitch/noise: abaikan pulsa < X us (misal 2000 us = 500 Hz cutoff)
  char sensor_channel;          // 'U', 'V', atau 'W'
  bool is_calibrated;           // Flag apakah sudah divalidasi dengan tachometer / data pabrikan
};

// Struktur Data Hasil Pengukuran RPM
struct CompressorRpmData {
  float estimated_rpm;
  uint32_t pulse_count;
  uint32_t pulse_interval_us;
  CompressorStatus status;
  SpeedTrend trend;
  SignalStatus signal_status;
  CalibrationStatus calibration_status;
  char sensor_channel;
  bool is_simulated;
  unsigned long run_duration_seconds;
};

class CompressorRpmProcessor {
private:
  uint8_t pin;
  CompressorProfile profile;

  // Variabel Interrupt
  volatile uint32_t pulseCountISR;
  volatile uint32_t lastPulseMicrosISR;
  volatile uint32_t pulseIntervalMicrosISR;
  volatile bool newPulseFlagISR;

  // Variabel Filter & Tracking
  uint32_t lastSampleMillis;
  uint32_t previousPulseCount;
  float smoothedRpm;
  float previousRpm;
  unsigned long compressorStartTime;
  bool wasRunning;
  uint8_t unstableCounter;

  // Mode Simulator
  bool simulatorEnabled;
  float simTargetRpm;
  float simCurrentRpm;
  uint8_t simMode; // 0=OFF, 1=LOW, 2=MED, 3=HIGH, 4=ACCEL, 5=DECEL, 6=UNSTABLE, 7=LOST

public:
  CompressorRpmProcessor() {
    pin = 33; // Default pin input optocoupler
    pulseCountISR = 0;
    lastPulseMicrosISR = 0;
    pulseIntervalMicrosISR = 0;
    newPulseFlagISR = false;
    lastSampleMillis = 0;
    previousPulseCount = 0;
    smoothedRpm = 0.0f;
    previousRpm = 0.0f;
    compressorStartTime = 0;
    wasRunning = false;
    unstableCounter = 0;
    simulatorEnabled = false;
    simTargetRpm = 0.0f;
    simCurrentRpm = 0.0f;
    simMode = 0;

    // Profil Default (Universal Inverter - Konservatif 4-Pole)
    // Label status default adalah UNCALIBRATED agar teknisi terinformasi
    strncpy(profile.brand, "Universal", sizeof(profile.brand));
    strncpy(profile.model, "Standard Inverter", sizeof(profile.model));
    profile.motor_poles = 4;
    profile.pulses_per_revolution = 2.0f; // 4-pole: 2 pasang kutub = 2 pulsa listrik per 1 putaran mekanik
    profile.rpm_low_max = 1800.0f;
    profile.rpm_medium_max = 3200.0f;
    profile.rpm_high_min = 3200.0f;
    profile.stop_timeout_ms = 1200;
    profile.min_pulse_width_us = 3000; // Glitch filter: abaikan pulsa lebih pendek dari 3ms (~333 Hz)
    profile.sensor_channel = 'U';
    profile.is_calibrated = false; // Estimasi belum tervalidasi
  }

  void setPin(uint8_t inputPin) {
    pin = inputPin;
  }

  void setProfile(const CompressorProfile& newProfile) {
    profile = newProfile;
  }

  CompressorProfile getProfile() const {
    return profile;
  }

  void enableSimulator(bool enable, uint8_t mode = 1) {
    simulatorEnabled = enable;
    simMode = mode;
  }

  bool isSimulatorActive() const {
    return simulatorEnabled;
  }

  // Dipanggil dari ISR (Interrupt Service Routine)
  void handleInterrupt() {
    uint32_t nowMicros = micros();
    uint32_t interval = nowMicros - lastPulseMicrosISR;

    // Filter glitch / switching carrier noise (abaikan pulsa palsu berkecepatan mikrodetik PWM)
    if (interval >= profile.min_pulse_width_us) {
      pulseIntervalMicrosISR = interval;
      lastPulseMicrosISR = nowMicros;
      pulseCountISR++;
      newPulseFlagISR = true;
    }
  }

  void begin(uint8_t inputPin = 33) {
    pin = inputPin;
    pinMode(pin, INPUT_PULLUP);
    lastSampleMillis = millis();
  }

  // Hitung pembacaan RPM secara periodik (setiap interval telemetri)
  CompressorRpmData update(uint32_t extPulseCount = 0, uint32_t extLastMicros = 0, uint32_t extIntervalMicros = 0) {
    CompressorRpmData data;
    memset(&data, 0, sizeof(data));
    data.sensor_channel = profile.sensor_channel;
    data.calibration_status = profile.is_calibrated ? CALIB_CALIBRATED : CALIB_UNCALIBRATED;
    data.is_simulated = simulatorEnabled;

    // ------------------------------------------------------------------------
    // JALUR 1: MODE SIMULATOR (UNTUK PENGUJIAN AMAN TANPA TEGANGAN TINGGI)
    // ------------------------------------------------------------------------
    if (simulatorEnabled) {
      return runSimulationStep();
    }

    // ------------------------------------------------------------------------
    // JALUR 2: PEMBACAAN HARDWARE NYATA DARI OPTOCOUPLER
    // ------------------------------------------------------------------------
    uint32_t currentMillis = millis();
    uint32_t nowMicros = micros();

    // Salin variabel volatile dari ISR (gunakan data eksternal IRAM-safe jika tersedia)
    uint32_t currentPulseCount = extPulseCount;
    uint32_t lastPulseMicros = extLastMicros;
    uint32_t lastIntervalMicros = extIntervalMicros;

    if (extLastMicros == 0 && extPulseCount == 0) {
      noInterrupts();
      currentPulseCount = pulseCountISR;
      lastPulseMicros = lastPulseMicrosISR;
      lastIntervalMicros = pulseIntervalMicrosISR;
      newPulseFlagISR = false;
      interrupts();
    }

    data.pulse_count = currentPulseCount;
    data.pulse_interval_us = lastIntervalMicros;

    // Deteksi Timeout: kompresor berhenti jika tidak ada pulsa selama stop_timeout_ms
    uint32_t timeSinceLastPulseMs = (nowMicros >= lastPulseMicros) 
                                     ? ((nowMicros - lastPulseMicros) / 1000) 
                                     : 0;

    bool isStopped = (timeSinceLastPulseMs > profile.stop_timeout_ms) || (lastPulseMicros == 0);

    if (isStopped) {
      smoothedRpm = 0.0f;
      data.estimated_rpm = 0.0f;
      data.status = COMP_STATUS_OFF;
      data.trend = TREND_STOPPED;
      data.signal_status = (lastPulseMicros == 0) ? SIG_NO_SIGNAL : SIG_VALID;
      wasRunning = false;
      compressorStartTime = 0;
      data.run_duration_seconds = 0;
      previousRpm = 0.0f;
      return data;
    }

    // Hitung frekuensi fundamental listrik dari interval pulsa
    float fundamentalFreqHz = 0.0f;
    if (lastIntervalMicros > 0) {
      fundamentalFreqHz = 1000000.0f / (float)lastIntervalMicros;
    }

    // Hitung estimasi RPM mekanik:
    // RPM = (Fundamental Frequency * 60) / (Poles / 2) = (freq * 120) / Poles
    // Atau via rasio pulses_per_revolution
    float rawEstimatedRpm = 0.0f;
    if (profile.pulses_per_revolution > 0.0f) {
      rawEstimatedRpm = (fundamentalFreqHz * 60.0f) / profile.pulses_per_revolution;
    } else {
      rawEstimatedRpm = (fundamentalFreqHz * 120.0f) / (float)profile.motor_poles;
    }

    // Filter batas kewajaran kompresor AC (umumnya 600 RPM hingga 6000 RPM)
    if (rawEstimatedRpm < 300.0f || rawEstimatedRpm > 8000.0f) {
      data.signal_status = SIG_UNSTABLE;
      unstableCounter++;
    } else {
      data.signal_status = SIG_VALID;
      unstableCounter = 0;
    }

    // Terapkan Exponential Moving Average (EMA) agar grafik stabil dan tidak jitter
    if (smoothedRpm <= 0.0f) {
      smoothedRpm = rawEstimatedRpm;
    } else {
      // 30% sampel baru + 70% riwayat stabil
      smoothedRpm = (0.30f * rawEstimatedRpm) + (0.70f * smoothedRpm);
    }

    data.estimated_rpm = round(smoothedRpm);

    // Evaluasi Durasi Berjalan
    if (!wasRunning && data.estimated_rpm > 100.0f) {
      wasRunning = true;
      compressorStartTime = currentMillis;
    }
    data.run_duration_seconds = wasRunning ? ((currentMillis - compressorStartTime) / 1000) : 0;

    // Evaluasi Status Kecepatan (OFF, LOW, MEDIUM, HIGH)
    if (data.estimated_rpm < 400.0f) {
      data.status = COMP_STATUS_OFF;
    } else if (data.estimated_rpm <= profile.rpm_low_max) {
      data.status = COMP_STATUS_LOW;
    } else if (data.estimated_rpm <= profile.rpm_medium_max) {
      data.status = COMP_STATUS_MEDIUM;
    } else {
      data.status = COMP_STATUS_HIGH;
    }

    // Evaluasi Tren Kecepatan (ACCELERATING / DECELERATING / STABLE)
    float deltaRpm = data.estimated_rpm - previousRpm;
    if (deltaRpm > 60.0f) {
      data.trend = TREND_ACCELERATING;
    } else if (deltaRpm < -60.0f) {
      data.trend = TREND_DECELERATING;
    } else {
      data.trend = TREND_STABLE;
    }

    previousRpm = data.estimated_rpm;
    return data;
  }

  // Helper untuk Mode Simulator
  CompressorRpmData runSimulationStep() {
    CompressorRpmData data;
    memset(&data, 0, sizeof(data));
    data.is_simulated = true;
    data.sensor_channel = profile.sensor_channel;
    data.calibration_status = CALIB_UNCALIBRATED;

    unsigned long now = millis();

    switch (simMode) {
      case 0: // COMPRESSOR OFF
        simCurrentRpm = 0.0f;
        data.status = COMP_STATUS_OFF;
        data.trend = TREND_STOPPED;
        data.signal_status = SIG_NO_SIGNAL;
        break;

      case 1: // LOW SPEED (misal ~1250 RPM dengan riak lembut)
        simTargetRpm = 1250.0f + (sin(now * 0.002f) * 45.0f);
        simCurrentRpm += (simTargetRpm - simCurrentRpm) * 0.2f;
        data.status = COMP_STATUS_LOW;
        data.trend = TREND_STABLE;
        data.signal_status = SIG_VALID;
        break;

      case 2: // MEDIUM SPEED (misal ~2400 RPM)
        simTargetRpm = 2400.0f + (sin(now * 0.003f) * 60.0f);
        simCurrentRpm += (simTargetRpm - simCurrentRpm) * 0.2f;
        data.status = COMP_STATUS_MEDIUM;
        data.trend = TREND_STABLE;
        data.signal_status = SIG_VALID;
        break;

      case 3: // HIGH SPEED (Ngebut / Turbo, misal ~3850 RPM)
        simTargetRpm = 3850.0f + (sin(now * 0.004f) * 80.0f);
        simCurrentRpm += (simTargetRpm - simCurrentRpm) * 0.2f;
        data.status = COMP_STATUS_HIGH;
        data.trend = TREND_STABLE;
        data.signal_status = SIG_VALID;
        break;

      case 4: // ACCELERATING (Naik bertahap dari LOW ke HIGH)
        if (simCurrentRpm < 800.0f) simCurrentRpm = 1000.0f;
        simCurrentRpm += 120.0f;
        if (simCurrentRpm > 4200.0f) simCurrentRpm = 1000.0f;
        data.status = (simCurrentRpm < 1800.0f) ? COMP_STATUS_LOW : ((simCurrentRpm < 3200.0f) ? COMP_STATUS_MEDIUM : COMP_STATUS_HIGH);
        data.trend = TREND_ACCELERATING;
        data.signal_status = SIG_VALID;
        break;

      case 5: // DECELERATING (Turun bertahap dari HIGH ke LOW)
        if (simCurrentRpm > 4200.0f || simCurrentRpm < 800.0f) simCurrentRpm = 4000.0f;
        simCurrentRpm -= 120.0f;
        if (simCurrentRpm < 900.0f) simCurrentRpm = 4000.0f;
        data.status = (simCurrentRpm < 1800.0f) ? COMP_STATUS_LOW : ((simCurrentRpm < 3200.0f) ? COMP_STATUS_MEDIUM : COMP_STATUS_HIGH);
        data.trend = TREND_DECELERATING;
        data.signal_status = SIG_VALID;
        break;

      case 6: // UNSTABLE / NOISE (Fluktuasi liar sinyal terdistorsi)
        simCurrentRpm = 1500.0f + (float)(random(-900, 1400));
        data.status = COMP_STATUS_UNKNOWN;
        data.trend = TREND_UNKNOWN;
        data.signal_status = SIG_UNSTABLE;
        break;

      case 7: // SIGNAL LOST (Kabel lepas / sensor disconnect)
      default:
        simCurrentRpm = 0.0f;
        data.status = COMP_STATUS_OFF;
        data.trend = TREND_STOPPED;
        data.signal_status = SIG_NO_SIGNAL;
        break;
    }

    data.estimated_rpm = round(simCurrentRpm);
    if (data.estimated_rpm > 0) {
      data.pulse_interval_us = (uint32_t)(60000000.0f / (data.estimated_rpm * 2.0f));
      data.pulse_count = (uint32_t)(now / 20);
    } else {
      data.pulse_interval_us = 0;
      data.pulse_count = 0;
    }

    return data;
  }
};

// Instance global yang siap diikat ke interrupt handler
extern CompressorRpmProcessor rpmProcessor;

// Wrapper C-style ISR untuk attachInterrupt ESP32
void IRAM_ATTR compressorRpmISR();

#endif // COMPRESSOR_RPM_H
