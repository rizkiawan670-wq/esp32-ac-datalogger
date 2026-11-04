# ESP32 AC Datalogger Online

Sistem telemetri IoT industri berbasis **ESP32 DevKit V1** untuk pemantauan tegangan listrik jala-jala PLN (True-RMS), suhu udara ruangan, dan kelembapan relatif secara real-time (interval 1 detik) melalui browser HP dan laptop.

Dirancang khusus untuk membantu teknisi pendingin udara (AC) menganalisis performa kelistrikan dan beban termal secara online.

---

## 1. Arsitektur & Teknologi

- **Hardware**: ESP32 DevKit V1 (30-pin / 38-pin), Transduser Tegangan AC Terisolasi Galvanik (GPIO34), Sensor Sensirion SHT31 (I2C: GPIO21 SDA, GPIO22 SCL).
- **Firmware**: C++ (Arduino Core ESP32) dengan algoritma sampling True-RMS, Circular Ring Buffer offline queue, auto-reconnect Wi-Fi, dan transmisi HTTPS.
- **Backend**: Supabase Edge Functions (Deno / TypeScript) dengan otentikasi token perangkat SHA-256 dan proteksi idempotensi batch.
- **Database**: Supabase PostgreSQL dengan Row Level Security (RLS), Supabase Realtime, indeks kinerja, dan fungsi downsampling waktu.
- **Frontend Dashboard**: React + Vite + Tailwind CSS + Lucide Icons + Recharts, bertema _Industrial Dark Mode_ teknisi elektronik.
- **Hosting**: Netlify Ready (SPA routing & environment configuration).
- **Ekspor Data**: CSV kompatibel penuh dengan Microsoft Excel (UTF-8 BOM).

---

## 2. Struktur Direktori Proyek

```text
d:\datalogger/
├── firmware/
│   ├── ac_datalogger.ino          # Firmware utama ESP32 (True-RMS, SHT31, WiFi, Queue)
│   ├── config.h                  # Konfigurasi Wi-Fi, pinout, token, dan faktor kalibrasi
│   └── README.md                 # Panduan kompilasi Arduino IDE & flashing
├── supabase/
│   ├── schema.sql                # Skema PostgreSQL, RLS, Realtime, & Stored Functions
│   └── functions/
│       └── ingest-telemetry/
│           └── index.ts          # Supabase Edge Function penerima data telemetri
├── dashboard/
│   ├── src/
│   │   ├── components/           # Header, StatusCards, RealtimeCharts
│   │   ├── pages/                # Dashboard, History, Analysis, Devices, Settings, Guide
│   │   ├── services/             # Supabase client & health check
│   │   ├── context/              # AppContext & State Manager
│   │   ├── utils/                # CSV Export (Excel BOM) & AC Analytics (Dew Point, Sags/Swells)
│   │   ├── App.jsx               # Root tab navigation
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Tailwind dark-mode styles
│   ├── public/                   # Static assets & Netlify _redirects
│   ├── package.json              # Dependensi npm (React, Recharts, Lucide, Tailwind)
│   ├── .env.example              # Template konfigurasi environment frontend
│   ├── vite.config.js            # Konfigurasi bundler Vite
│   └── netlify.toml              # Konfigurasi deployment hosting Netlify
├── docs/
│   ├── wiring.md                 # Skema pinout & panduan keselamatan isolasi PLN 220V
│   ├── calibration.md            # Teori matematis True-RMS & prosedur kalibrasi multimeter
│   ├── deployment.md             # Panduan deployment Supabase & Netlify
│   └── troubleshooting.md        # Pemecahan masalah I2C, Wi-Fi brownout, dan kuota DB
└── README.md                     # Dokumentasi utama proyek
```

---

## 3. Langkah Instalasi Cepat

### A. Setup Database Supabase

1. Buka [Supabase](https://supabase.com) dan buat proyek baru. pass (Hzvs6t8kPfI83mZa) (datalogger)
2. Buka menu **SQL Editor**, buka file [`supabase/schema.sql`](file:///d:/datalogger/supabase/schema.sql), lalu klik **Run**.
3. Buka **Project Settings** > **API**, salin **Project URL** dan **anon public key**.
https://ixgcqgtwzjjfleipdgzz.supabase.co/rest/v1/ - eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4Z2NxZ3R3empqZmxlaXBkZ3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0Njg1OTYsImV4cCI6MjEwOTA0NDU5Nn0.BoD_md3nbdasrD3-tac3e0Ja6wADA36h82DRUjju2e8
### B. Deploy Supabase Edge Function

Di terminal komputer Anda:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy ingest-telemetry --no-verify-jwt
```

### C. Konfigurasi & Upload Firmware ESP32

1. Buka [`firmware/config.h`](file:///d:/datalogger/firmware/config.h).
2. Masukkan SSID dan Password Wi-Fi Anda.
3. Masukkan URL endpoint Edge Function Supabase:
   ```cpp
   #define SUPABASE_INGEST_URL "https://<PROJECT-REF>.supabase.co/functions/v1/ingest-telemetry"
   ```
4. Buka Arduino IDE, pilih board **ESP32 Dev Module**, lalu upload file [`firmware/ac_datalogger.ino`](file:///d:/datalogger/firmware/ac_datalogger.ino).

### D. Jalankan Frontend Dashboard Secara Lokal

```bash
cd dashboard
npm install
npm run dev
```

Akses dashboard di browser Anda pada alamat: `http://localhost:3000`.

### E. Mode Simulasi (Uji Coba Cepat Tanpa Hardware)

Jika perangkat fisik ESP32 belum selesai dirakit, Anda dapat langsung menguji seluruh fitur dashboard dengan mengklik tombol **Coba Simulasi** di header dashboard atau mengaktifkannya di menu **Pengaturan**. Sistem akan menyimulasikan data sinusoidal tegangan 220V dan kurva pendinginan AC dengan label eksplisit `SIMULASI`.

---

## 4. Prioritas Keselamatan Listrik Tegangan Tinggi PLN

1. **JANGAN PERNAH** menghubungkan kabel fasa (L) atau netral (N) 220 VAC langsung ke pin GPIO ESP32.
2. **DILARANG** merakit jalur PLN 220V menggunakan breadboard plastik tanpa enclosure.
3. Wajib gunakan transduser AC tertutup dengan **isolasi galvanik** (misal transformator ZMPT101B bersertifikasi).
4. Pasang **sekering cepat (fast-blow fuse) 200mA** pada jalur fasa (L).
5. Jangan mengubah konfigurasi kalibrasi menjadi `IS_CALIBRATED = true` sebelum diverifikasi dengan multimeter True-RMS standar.

---

## 5. Fitur Unggulan Dashboard

- **Grafik Real-Time & Multi-Axis**: Memperbarui data setiap 1 detik via Supabase Realtime dengan sumbu ganda (Tegangan VAC pada sumbu kiri, Suhu °C & Kelembapan %RH pada sumbu kanan).
- **Filter Rentang Waktu**: 5 Menit, 15 Menit, 1 Jam, 6 Jam, 24 Jam, dan kontrol Pause/Resume.
- **Ekspor Riwayat ke CSV (Excel)**: Dilengkapi Byte Order Mark (BOM UTF-8) untuk pembukaan langsung di Microsoft Excel dengan kolom tanggal, status validasi, voltase, suhu, dan kelembapan.
- **Analisis Kinerja Kelistrikan**: Deteksi tegangan anjlok (_sag/dip_ &lt; 198V) dan tegangan lebih (_swell_ &gt; 242V), indeks stabilitas jala listrik, laju dinamika termal $\Delta T$, serta estimasi titik embun (_dew point_) untuk memprediksi kondensasi pipa AC.
- **Manajemen Buffer Offline**: Jika koneksi Wi-Fi terputus di lapangan, ESP32 otomatis menyimpan sampel ke RAM circular buffer dan mengurasnya (_drain batch_) begitu internet pulih tanpa membuat data duplikat.
