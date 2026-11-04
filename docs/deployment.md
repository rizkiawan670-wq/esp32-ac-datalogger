# Panduan Deployment Cloud (Supabase & Netlify)

Dokumentasi ini memandu proses deployment sistem **ESP32 AC Datalogger Online** ke infrastruktur cloud publik: **Supabase** (Database PostgreSQL, Realtime, & Edge Functions) dan **Netlify** (Hosting Web Dashboard).

---

## 1. Setup Database & Realtime di Supabase

### Langkah 1: Buat Proyek Supabase
1. Masuk ke [Supabase Dashboard](https://supabase.com).
2. Klik **New Project**, tentukan nama proyek (misal `ac-datalogger`), setel password database yang aman, dan pilih region terdekat (misal `Southeast Asia (Singapore)`).

### Langkah 2: Eksekusi Skema SQL
1. Masuk ke menu **SQL Editor** pada menu sisi kiri Supabase.
2. Klik **New Query**.
3. Salin seluruh isi file [`supabase/schema.sql`](file:///d:/datalogger/supabase/schema.sql) dari proyek ini.
4. Tempel ke dalam editor SQL dan klik tombol **Run** (Ctrl + Enter).
5. Pastikan tabel `devices`, `ac_readings`, `system_settings`, indeks, dan publikasi Realtime berhasil dibuat tanpa pesan galat.

### Langkah 3: Ambil Kunci Kredensial API
1. Buka menu **Project Settings** > **API**.
2. Salin nilai berikut:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon / public key**: Kunci publik untuk frontend dashboard.
   - **service_role key**: Kunci rahasia untuk backend Edge Functions (otomatis tersedia pada runtime Edge Functions, **JANGAN** pernah dibagikan ke publik atau frontend).

---

## 2. Deploy Supabase Edge Function (`ingest-telemetry`)

Edge Function bertindak sebagai API gateway aman yang menerima telemetri 1-detik dari ESP32, memvalidasi token rahasia perangkat, dan menulis data ke tabel `ac_readings` melewati RLS secara aman.

### Langkah 1: Install Supabase CLI
Di terminal komputer pengembang:
```bash
npm install -g supabase
```

### Langkah 2: Login & Tautkan Proyek
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### Langkah 3: Deploy Function
Jalankan perintah deploy dengan flag `--no-verify-jwt`:
```bash
supabase functions deploy ingest-telemetry --no-verify-jwt
```
> **Catatan Teknis**: Flag `--no-verify-jwt` wajib digunakan karena ESP32 mengautentikasi diri menggunakan token khusus perangkat (`x-device-token`) yang di-hash di database, bukan melalui token pengguna JWT Supabase Auth.

---

## 3. Deploy Frontend di Netlify

### Opsi A: Deployment Otomatis via Git (GitHub/GitLab)
1. Push repositori proyek ini ke akun GitHub Anda.
2. Buka dashboard [Netlify](https://app.netlify.com) dan klik **Add new site** > **Import an existing project**.
3. Pilih repositori GitHub Anda.
4. Konfigurasikan build settings:
   - **Base directory**: `dashboard`
   - **Build command**: `npm run build`
   - **Publish directory**: `dashboard/dist`
5. Buka tab **Site configuration** > **Environment variables**, tambahkan variabel berikut:
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...
   VITE_DEFAULT_DEVICE_ID=esp32-ac-01
   VITE_ENABLE_SIMULATION_MODE=false
   ```
6. Klik **Deploy Site**. Netlify akan membuat URL publik HTTPS instan (misal `https://ac-datalogger.netlify.app`).

### Opsi B: Deployment Manual Cepat (Drag & Drop)
1. Jalankan perintah build di folder dashboard:
   ```bash
   cd dashboard
   npm run build
   ```
2. Buka [Netlify Drop](https://app.netlify.com/drop).
3. Seret (*drag & drop*) folder `dashboard/dist` ke browser.
4. Situs akan langsung online dalam beberapa detik. Kredensial Supabase dapat dimasukkan langsung melalui menu **Pengaturan** di dashboard web.

---

## 4. Konfigurasi Sertifikat TLS / SSL pada ESP32

Supabase menggunakan sertifikat HTTPS berstandar industri dari Let's Encrypt atau DigiCert.

1. **Untuk Lingkungan Produksi**:
   - Sertifikat root CA Let's Encrypt (**ISRG Root X1**) dapat disematkan ke dalam memori Flash ESP32 menggunakan `WiFiClientSecure::setCACert()`.
2. **Untuk Tahap Pengujian Awal**:
   - Di file [`firmware/config.h`](file:///d:/datalogger/firmware/config.h), opsi `#define TLS_VERIFY_CERTIFICATE false` diaktifkan untuk kemudahan demonstrasi tanpa konfigurasi CA rumit.
   - Untuk deployment lapangan permanen, ubah menjadi `true` dan muat sertifikat root CA publik.
