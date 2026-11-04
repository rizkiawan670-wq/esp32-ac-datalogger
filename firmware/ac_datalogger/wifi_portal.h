/**
 * ============================================================================
 * ESP32 AC DATALOGGER - WI-FI CAPTIVE PORTAL & CREDENTIAL MANAGER
 * ============================================================================
 * Fitur:
 * 1. Simpan & muat SSID/Password Wi-Fi dari flash NVS internal (Preferences).
 * 2. Jika Wi-Fi gagal terhubung (atau tombol BOOT ditahan 3 detik), otomatis
 *    menyalakan Hotspot Access Point "AC-Datalogger-Config".
 * 3. Captive Portal DNS Server (otomatis muncul pop-up login di smartphone).
 * 4. Halaman web responsif berbahasa Indonesia untuk scan Wi-Fi & input password.
 * 5. Nol dependensi library luar (hanya bawaan resmi ESP32 Core).
 * ============================================================================
 */

#ifndef WIFI_PORTAL_H
#define WIFI_PORTAL_H

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include "config.h"

#define PIN_BOOT_BUTTON       0          // Tombol BOOT pada ESP32 DevKit V1
#define AP_SSID               "AC-Datalogger-Config"
#define DNS_PORT              53
#define BOOT_HOLD_TIME_MS     3000       // Tahan tombol BOOT 3 detik untuk buka portal

static Preferences wifiPrefs;
static WebServer portalServer(80);
static DNSServer dnsServer;

static bool portalActive = false;
static unsigned long bootButtonPressStart = 0;
static bool bootButtonPressed = false;

// ----------------------------------------------------------------------------
// HALAMAN WEB CAPTIVE PORTAL (RESPONSIF SMARTPHONE - INDUSTRIAL DARK)
// ----------------------------------------------------------------------------
static String renderPortalHTML() {
  // Lakukan pemindaian Wi-Fi sekitar
  int n = WiFi.scanNetworks();
  String wifiOptions = "";
  
  if (n <= 0) {
    wifiOptions = "<option value=\"\">Tidak ada Wi-Fi terdeteksi (Coba Refresh)</option>";
  } else {
    for (int i = 0; i < n; ++i) {
      String ssid = WiFi.SSID(i);
      if (ssid.length() == 0) continue; // Skip hidden SSID
      int rssi = WiFi.RSSI(i);
      String lock = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "🔓" : "🔒";
      wifiOptions += "<option value=\"" + ssid + "\">" + ssid + " (" + String(rssi) + " dBm " + lock + ")</option>";
    }
  }

  String html = R"rawhtml(
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Setup Wi-Fi AC Datalogger</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #0b1120; color: #f1f5f9; padding: 20px 16px; display: flex; justify-content: center; }
    .card { background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; max-width: 420px; width: 100%; padding: 24px 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .icon { width: 48px; height: 48px; background: linear-gradient(135deg, #f97316, #ef4444); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 12px; }
    h1 { font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px; }
    p.sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .badge { display: inline-block; background-color: #1e293b; color: #fbbf24; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(251, 191, 36, 0.3); margin-top: 8px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    select, input[type="text"], input[type="password"] {
      width: 100%; background-color: #030712; border: 1px solid #374151; border-radius: 10px; padding: 12px; font-size: 14px; color: #ffffff; outline: none; transition: border-color 0.2s;
    }
    select:focus, input:focus { border-color: #f97316; }
    .hint { font-size: 11px; color: #64748b; margin-top: 4px; }
    .btn {
      width: 100%; background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; border: none; border-radius: 10px; padding: 14px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3); margin-top: 8px; transition: opacity 0.2s;
    }
    .btn:active { opacity: 0.85; }
    .btn-secondary {
      background: #1e293b; color: #cbd5e1; border: 1px solid #334155; box-shadow: none; margin-top: 10px; font-weight: 600; padding: 10px;
    }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">⚡</div>
      <h1>PORTAL WI-FI DATALOGGER</h1>
      <p class="sub">Hubungkan alat ke Wi-Fi rumah customer / hotspot</p>
      <span class="badge">Perangkat: )rawhtml" + String(DEVICE_ID) + R"rawhtml(</span>
    </div>

    <form method="POST" action="/save">
      <div class="form-group">
        <label for="ssid_select">Pilih Jaringan Wi-Fi Sekitar:</label>
        <select id="ssid_select" onchange="document.getElementById('ssid_input').value = this.value;">
          <option value="">-- Pilih dari hasil scan --</option>
          )rawhtml" + wifiOptions + R"rawhtml(
        </select>
      </div>

      <div class="form-group">
        <label for="ssid_input">Nama Wi-Fi (SSID):</label>
        <input type="text" id="ssid_input" name="ssid" placeholder="Ketik atau pilih di atas..." required>
        <div class="hint">Pastikan Wi-Fi frekuensi 2.4 GHz (bukan 5 GHz murni)</div>
      </div>

      <div class="form-group">
        <label for="password_input">Kata Sandi (Password):</label>
        <input type="password" id="password_input" name="password" placeholder="Masukkan password Wi-Fi...">
      </div>

      <button type="submit" class="btn">💾 SIMPAN & HUBUNGKAN</button>
    </form>

    <button type="button" class="btn btn-secondary" onclick="window.location.reload();">🔄 Scan Ulang Wi-Fi</button>

    <div class="footer">
      ESP32 AC Datalogger Online &bull; Cloud Telemetry
    </div>
  </div>
</body>
</html>
)rawhtml";

  return html;
}

static String renderSavedHTML(const String& ssid) {
  return R"rawhtml(
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Menyimpan Konfigurasi...</title>
  <style>
    body { background-color: #0b1120; color: #f1f5f9; padding: 40px 20px; font-family: sans-serif; text-align: center; }
    .box { background: #111827; border: 1px solid #10b981; border-radius: 16px; padding: 30px 20px; max-width: 400px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { color: #10b981; font-size: 20px; margin-bottom: 12px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 16px; }
    .spinner { display: inline-block; width: 36px; height: 36px; border: 3px solid rgba(16,185,129,0.3); border-radius: 50%; border-top-color: #10b981; animation: spin 1s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="box">
    <h2>BERHASIL DISIMPAN!</h2>
    <p>ESP32 sedang menghubungkan ke:<br><strong style="color: #ffffff;">)rawhtml" + ssid + R"rawhtml(</strong></p>
    <div class="spinner"></div>
    <p style="margin-top: 16px; font-size: 12px; color: #64748b;">Hotspot alat akan mati otomatis. Anda sekarang dapat kembali menghubungkan HP Anda ke Wi-Fi normal dan membuka Dashboard.</p>
  </div>
</body>
</html>
)rawhtml";
}

// ----------------------------------------------------------------------------
// MULAI CAPTIVE PORTAL HOTSPOT
// ----------------------------------------------------------------------------
inline void startCaptivePortal() {
  Serial.println(F("\n========================================================"));
  Serial.println(F("[PORTAL] Memulai Wi-Fi Hotspot Captive Portal..."));
  Serial.println(F("========================================================"));

  WiFi.disconnect(true);
  delay(100);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID);

  IPAddress apIP = WiFi.softAPIP();
  Serial.printf("[PORTAL] Hotspot Aktif: %s\n", AP_SSID);
  Serial.printf("[PORTAL] Buka di browser HP: http://%s\n", apIP.toString().c_str());

  // DNS Server untuk Captive Portal redirect
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", apIP);

  // Setup Web Routes
  portalServer.on("/", HTTP_GET, []() {
    portalServer.send(200, "text/html", renderPortalHTML());
  });

  portalServer.on("/save", HTTP_POST, []() {
    String newSSID = portalServer.arg("ssid");
    String newPass = portalServer.arg("password");

    newSSID.trim();
    newPass.trim();

    Serial.printf("[PORTAL] Menerima SSID Baru: %s\n", newSSID.c_str());

    wifiPrefs.begin("datalogger", false);
    wifiPrefs.putString("ssid", newSSID);
    wifiPrefs.putString("pass", newPass);
    wifiPrefs.end();

    portalServer.send(200, "text/html", renderSavedHTML(newSSID));
    delay(2000);

    Serial.println(F("[PORTAL] Kredensial disimpan ke NVS. Restart ESP32..."));
    ESP.restart();
  });

  // Redirect umum untuk Captive Portal OS detection (Android, iOS, Windows)
  portalServer.on("/generate_204", HTTP_GET, []() {
    portalServer.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/", true);
    portalServer.send(302, "text/plain", "");
  });
  portalServer.on("/hotspot-detect.html", HTTP_GET, []() {
    portalServer.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/", true);
    portalServer.send(302, "text/plain", "");
  });
  portalServer.onNotFound([]() {
    portalServer.sendHeader("Location", String("http://") + WiFi.softAPIP().toString() + "/", true);
    portalServer.send(302, "text/plain", "");
  });

  portalServer.begin();
  portalActive = true;

  Serial.println(F("[PORTAL] Menunggu koneksi dari teknisi/HP..."));
  while (portalActive) {
    dnsServer.processNextRequest();
    portalServer.handleClient();
    delay(10);
  }
}

// ----------------------------------------------------------------------------
// INISIALISASI WI-FI CERDAS DENGAN FALLBACK CAPTIVE PORTAL
// ----------------------------------------------------------------------------
inline bool setupSmartWiFi() {
  pinMode(PIN_BOOT_BUTTON, INPUT_PULLUP);

  // Cek apakah tombol BOOT sedang ditekan saat alat dinyalakan
  if (digitalRead(PIN_BOOT_BUTTON) == LOW) {
    Serial.println(F("[PORTAL] Tombol BOOT terdeteksi ditekan saat power-on. Masuk mode portal..."));
    startCaptivePortal();
    return false;
  }

  // Muat kredensial dari NVS Flash
  wifiPrefs.begin("datalogger", true);
  String targetSSID = wifiPrefs.getString("ssid", WIFI_SSID);
  String targetPass = wifiPrefs.getString("pass", WIFI_PASSWORD);
  wifiPrefs.end();

  targetSSID.trim();
  targetPass.trim();

  if (targetSSID.length() == 0) {
    Serial.println(F("[WIFI] Belum ada Wi-Fi tersimpan. Membuka portal konfigurasi..."));
    startCaptivePortal();
    return false;
  }

  Serial.printf("\n[WIFI] Menghubungkan ke Wi-Fi: %s ...\n", targetSSID.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true); // Aktifkan auto-reconnect di background oleh ESP-IDF
  WiFi.persistent(true);
  WiFi.setSleep(false);        // Matikan modem-sleep agar koneksi Wi-Fi stabil & tidak diputus router
  WiFi.begin(targetSSID.c_str(), targetPass.c_str());

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttempt) < 15000) {
    delay(500);
    Serial.print(F("."));
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI CONNECTED] Sukses terhubung! IP: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
  } else {
    Serial.printf("\n[WIFI TIMEOUT] Gagal terhubung ke '%s' dalam 15 detik.\n", targetSSID.c_str());
    Serial.println(F("[PORTAL] Otomatis menyalakan Hotspot konfigurasi..."));
    startCaptivePortal();
    return false;
  }
}

// ----------------------------------------------------------------------------
// CEK TOMBOL BOOT DI LOOP UTAMA (TAHAN 3 DETIK UNTUK RESET WI-FI)
// ----------------------------------------------------------------------------
inline void checkBootButton() {
  if (digitalRead(PIN_BOOT_BUTTON) == LOW) {
    if (!bootButtonPressed) {
      bootButtonPressed = true;
      bootButtonPressStart = millis();
    } else {
      if (millis() - bootButtonPressStart >= BOOT_HOLD_TIME_MS) {
        Serial.println(F("\n[PORTAL] Tombol BOOT ditahan 3 detik! Membuka Portal Wi-Fi..."));
        startCaptivePortal();
      }
    }
  } else {
    bootButtonPressed = false;
  }
}

#endif // WIFI_PORTAL_H
