// ============================================================================
// GEMINI AI & LOCAL DIAGNOSTIC REASONING SERVICE
// Layanan asisten cerdas untuk konsultasi alur proses sistem,
// analisis telemetri realtime, dan diagnosa teknis ESP32 AC Datalogger.
// ============================================================================

// Ambil API Key dari localStorage atau environment variable
export function getStoredGeminiKey() {
  try {
    const raw = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  } catch (e) {
    const raw = import.meta.env.VITE_GEMINI_API_KEY || '';
    return raw.trim().replace(/^["']|["']$/g, '');
  }
}

export function saveStoredGeminiKey(key) {
  try {
    const clean = (key || '').trim().replace(/^["']|["']$/g, '');
    if (!clean) {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('gemini_working_model');
      localStorage.removeItem('gemini_working_version');
    } else {
      localStorage.setItem('gemini_api_key', clean);
    }
  } catch (e) {
    console.warn('Gagal menyimpan Gemini API Key ke localStorage:', e);
  }
}

// ----------------------------------------------------------------------------
// DYNAMIC MODEL DISCOVERY DARI GOOGLE MODELSERVICE.LISTMODELS
// Meminta langsung daftar model resmi yang diizinkan untuk API Key pengguna
// ----------------------------------------------------------------------------
export async function fetchAvailableGeminiModels(apiKey) {
  const cleanKey = (apiKey || getStoredGeminiKey() || '').trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) return [];

  const versions = ['v1beta', 'v1'];
  for (const ver of versions) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${cleanKey}`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || [])
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => ({
            name: m.name.replace(/^models\//, ''),
            fullName: m.name,
            version: ver,
            displayName: m.displayName || m.name
          }));
        if (models.length > 0) {
          return models;
        }
      }
    } catch (e) {
      console.warn(`Gagal memuat list models dari versi ${ver}:`, e.message);
    }
  }
  return [];
}

// ----------------------------------------------------------------------------
// TEST FUNCTION: VERIFIKASI KEABSAHAN GOOGLE GEMINI API KEY
// ----------------------------------------------------------------------------
export async function testGeminiApiKey(key) {
  const cleanKey = (key || getStoredGeminiKey() || '').trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) {
    throw new Error('API Key kosong. Silakan tempelkan kunci dari Google AI Studio.');
  }

  // 1. Minta Google memberikan daftar model yang aktif untuk API Key ini (ListModels)
  const availableModels = await fetchAvailableGeminiModels(cleanKey);

  let candidateModels = [];
  if (availableModels.length > 0) {
    // Urutkan: utamakan flash (ringan dan cepat)
    const flashModels = availableModels.filter(m => m.name.toLowerCase().includes('flash'));
    const otherModels = availableModels.filter(m => !m.name.toLowerCase().includes('flash'));
    candidateModels = [...flashModels, ...otherModels];
  } else {
    // Daftar model alternatif lintas versi v1 dan v1beta jika ListModels terbatas
    candidateModels = [
      { name: 'gemini-1.5-flash', version: 'v1' },
      { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
      { name: 'gemini-2.0-flash', version: 'v1beta' },
      { name: 'gemini-2.0-flash-exp', version: 'v1beta' },
      { name: 'gemini-pro', version: 'v1' },
      { name: 'gemini-1.5-flash', version: 'v1beta' },
      { name: 'gemini-1.5-pro', version: 'v1' }
    ];
  }

  let lastError = null;

  for (const candidate of candidateModels) {
    const ver = candidate.version || 'v1beta';
    const model = candidate.name;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${cleanKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Halo, respon dengan kata AKTIF.' }]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        // Simpan model & versi API yang terbukti berhasil
        localStorage.setItem('gemini_working_model', model);
        localStorage.setItem('gemini_working_version', ver);
        return {
          success: true,
          model: model,
          version: ver,
          message: `Koneksi Berhasil! Model "${model}" (${ver}) aktif dan siap digunakan.`
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal memvalidasi API Key.');
}

// ----------------------------------------------------------------------------
// SISTEM INSTRUKSI PAKAR INSTRUMENTASI & AC INVERTER
// ----------------------------------------------------------------------------
const SYSTEM_INSTRUCTION = `
Anda adalah "AC Datalogger AI Diagnostic Assistant", asisten AI pakar teknik elektro, instrumentasi IoT ESP32, dan sistem pendingin udara (AC Inverter).
Anda bertugas membantu teknisi, engineer, dan pengguna memahami:
1. Alur kerja dan proses internal aplikasi IoT ESP32 AC Datalogger.
2. Analisis kondisi telemetri tegangan AC RMS, suhu, kelembapan, dan putaran motor kompresor (RPM).
3. Pemecahan masalah (troubleshooting) hardware, sensor, koneksi jaringan WiFi, dan database Supabase.

KARAKTERISTIK SISTEM:
- Perangkat: ESP32 Dual-Core 240MHz.
- Sensor Tegangan: ZMPT101B (ADC sampling True-RMS diskret gelombang sinus 50Hz, nominal 220V ±10% / 198V - 242V).
- Sensor Lingkungan: Sensirion SHT31-D via I2C (Address 0x44, bus recovery, auto-retry 2x, valid-reading cache).
- Estimasi RPM Kompresor: Mengukur frekuensi dasar f (Hz) dari inverter driver AC, dihitung dengan rumus RPM = (120 * f) / P (P = 4 poles motor). Rentang: 0 - 4500 RPM.
- Komunikasi: WiFi HTTP/1.1 Keep-Alive persistent connection ke Supabase REST / Edge Functions (mengatasi TIME_WAIT socket exhaustion).
- Database & Web: PostgreSQL Supabase Realtime WebSockets, Netlify React Dashboard.

PEDOMAN JAWABAN:
- Gunakan Bahasa Indonesia yang jelas, profesional, ringkas, dan ramah teknisi.
- Gunakan format Markdown (bold, bullet points, numbered lists, dan code blocks) agar jawaban terstruktur rapi.
- Apabila data telemetri realtime disertakan, ANALISIS SECARA LANGSUNG angka-angka tersebut untuk memberikan penilaian status sistem aktual.
- Jika pengguna menanyakan cara kerja atau proses sistem, jelaskan alur proses langkah demi langkah dari sisi sensor -> firmware ESP32 -> cloud -> dashboard web.
`;

// ----------------------------------------------------------------------------
// LOCAL DIAGNOSTIC REASONER (FALLBACK CERDAS SAAT TANPA API KEY)
// ----------------------------------------------------------------------------
export function runLocalDiagnosticEngine(userPrompt, telemetryContext) {
  const p = userPrompt.toLowerCase();
  const v = telemetryContext?.voltage ?? 0;
  const temp = telemetryContext?.temperature ?? 0;
  const hum = telemetryContext?.humidity ?? 0;
  const rpm = telemetryContext?.rpm ?? 0;
  const isRunning = telemetryContext?.isRunning ?? false;
  const profile = telemetryContext?.profileName || 'Universal 4-Pole Inverter';
  const devId = telemetryContext?.deviceId || 'ESP32_AC_01';

  // 1. Analisis Kondisi Realtime Aktual
  if (p.includes('kondisi') || p.includes('saat ini') || p.includes('analisis') || p.includes('status') || p.includes('aman')) {
    let vStatus = 'NORMAL (Aman)';
    let vCat = 'stabil';
    if (v < 180) { vStatus = 'BAHAYA (Severe Under-Voltage)'; vCat = 'sangat rendah, risiko kompresor macet/trip!'; }
    else if (v < 198) { vStatus = 'PERINGATAN (Under-Voltage)'; vCat = 'di bawah toleransi standar PLN (198V - 242V)'; }
    else if (v > 250) { vStatus = 'BAHAYA (Over-Voltage)'; vCat = 'berisiko merusak modul inverter dan kapasitor!'; }

    let rpmDesc = 'Kompresor dalam keadaan mati (OFF / Standby).';
    if (rpm > 0) {
      rpmDesc = `Kompresor sedang **AKTIF (${rpm.toLocaleString('id-ID')} RPM)**. Status putaran menunjukkan siklus pendinginan aktif.`;
    }

    return `### 📊 Analisis Telemetri Real-Time Perangkat \`${devId}\`

Berdasarkan pembacaan telemetri terbaru saat ini:

* **Tegangan Listrik AC True-RMS**: **${v.toFixed(1)} V** — Status: **${vStatus}**  
  Tegangan jala listrik berada dalam kondisi *${vCat}*.
* **Estimasi Putaran Kompresor**: **${rpm.toLocaleString('id-ID')} RPM** (${isRunning ? 'RUNNING' : 'OFF'})  
  ${rpmDesc} Profil aktif: *${profile}*.
* **Suhu Evaporator / Ruang**: **${temp.toFixed(1)} °C**  
  ${temp > 35 ? '⚠️ Suhu relatif tinggi. Pastikan aliran udara pada kondensor/outdoor tidak terhalang.' : 'Kondisi termal terpantau dalam batas kerja wajar.'}
* **Kelembapan Relatif**: **${hum.toFixed(1)} %RH**  
  ${hum > 75 ? 'Kelembapan tinggi, beban kondensasi uap air di evaporator cukup besar.' : 'Tingkat kelembapan relatif stabil.'}

💡 **Rekomendasi Diagnostik**:
${v < 198 ? '- Segera periksa trafo step-down atau instalasi jalur listrik karena tegangan drop dapat memicu kenaikan arus motor.' : '- Seluruh parameter kelistrikan utama terpantau aman untuk operasional kompresor inverter.'}`;
  }

  // 2. Pertanyaan tentang Alur Kerja / Proses Aplikasi
  if (p.includes('proses') || p.includes('alur') || p.includes('cara kerja') || p.includes('arsitektur') || p.includes('sistem')) {
    return `### 🔄 Alur & Proses Kerja Sistem ESP32 AC Datalogger

Sistem ini dirancang sebagai platform end-to-end pemantauan pendingin udara industri berbasis IoT:

\`\`\`
[Sensor ZMPT101B & SHT31] 
         │ (ADC Sampling & I2C)
         ▼
[ESP32 Microcontroller] ──► Hitung True-RMS, SHT31 bus-recovery, & Estimasi RPM
         │ (WiFi HTTPS Keep-Alive / JSON Payload)
         ▼
[Supabase Cloud Database] ──► Simpan ke tabel 'ac_readings' & 'compressor_rpm_readings'
         │ (PostgreSQL Realtime WebSockets)
         ▼
[Web Dashboard (Netlify)] ──► Visualisasi grafik interaktif & AI Diagnosa
\`\`\`

#### Tahapan Proses:
1. **Sensing & Pengukuran (ESP32)**:
   * **Tegangan AC**: Menggunakan transformator isolasi ZMPT101B. ESP32 mengambil ratusan sampel tegangan per siklus gelombang 50Hz, lalu menghitung nilai *True-RMS* secara presisi.
   * **Suhu & Kelembapan**: Dibaca tiap siklus melalui bus I2C Sensirion SHT31-D dengan proteksi isolasi noise motor.
   * **Estimasi RPM**: Dihitung dari frekuensi modulasi inverter motor kompresor dengan formula $RPM = \\frac{120 \\times f}{P}$.
2. **Pengolahan & Pengiriman Data**:
   * ESP32 membungkus telemetri ke format JSON.
   * Mengirim payload ke Supabase via **HTTP/1.1 Persistent Socket (Keep-Alive)** sehingga tidak menghabiskan socket memori lwIP (mencegah error *Connection Refused*).
3. **Penyimpanan Cloud (Supabase)**:
   * Data masuk ke database PostgreSQL dan mentrigger kanal **Realtime**.
4. **Visualisasi Frontend (React/Vite)**:
   * Dashboard web menerima streaming data seketika tanpa perlu refresh halaman (zero-latency monitoring).`;
  }

  // 3. Pertanyaan tentang True-RMS
  if (p.includes('true-rms') || p.includes('zmpt') || p.includes('tegangan') || p.includes('rms')) {
    return `### ⚡ Bagaimana ESP32 Menghitung Tegangan True-RMS?

Tegangan AC jala-jala listrik PLN berbentuk gelombang sinusoidal 50 Hz (satu siklus penuh = 20 milidetik).

Metode **True-RMS (Root Mean Square)** menghitung nilai efektif tegangan sebenarnya, bahkan jika bentuk gelombangnya terdistorsi harmonisa motor kompresor:

1. **Sampling Cepat (ADC ESP32)**:
   ESP32 membaca sinyal analog dari sensor modul ZMPT101B sebanyak puluhan hingga ratusan kali dalam rentang waktu beberapa siklus gelombang (misalnya 40–100 ms).
2. **Kompensasi Offset DC**:
   Modul ZMPT101B menambahkan tegangan bias $V_{CC}/2$ (sekitar 1.65V) agar gelombang AC negatif dapat dibaca oleh ADC ESP32 (0–3.3V). Firmware mengurangi nilai bias ini:
   $$\\text{Sample}_{\\text{AC}} = \\text{ADC} - \\text{Vbias}$$
3. **Kuadratkan Nilai (Square)**:
   Setiap sampel dikuadratkan: $\\text{Sample}^2$.
4. **Rata-ratakan (Mean)**:
   Seluruh nilai kuadrat dijumlahkan lalu dibagi total jumlah sampel $N$:
   $$\\text{Mean} = \\frac{1}{N} \\sum_{i=1}^{N} \\text{Sample}_i^2$$
5. **Akar Kuadrat (Root)**:
   Nilai RMS diperoleh dengan menarik akar dari rata-rata kuadrat:
   $$V_{\\text{RMS}} = \\sqrt{\\text{Mean}} \\times K_{\\text{kalibrasi}}$$

Hasilnya adalah nilai tegangan riil yang akurat seperti voltmeter True-RMS profesional (saat ini terukur **${v.toFixed(1)} V**).`;
  }

  // 4. Pertanyaan tentang Estimasi RPM Kompresor
  if (p.includes('rpm') || p.includes('kompresor') || p.includes('inverter') || p.includes('putaran')) {
    return `### 🔄 Algoritma Estimasi RPM Kompresor Inverter

Kompresor AC modern menggunakan motor BLDC (*Brushless DC*) atau motor sinkron AC 3-fasa yang dikendalikan oleh modul Inverter (*Variable Frequency Drive / VFD*).

Kecepatan putaran kompresor tidak konstan, melainkan berubah-ubah menyesuaikan beban pendinginan ruangan.

#### 1. Rumus Dasar Putaran Motor Listrik Sinkron:
$$\\text{RPM} = \\frac{120 \\times f}{P}$$
* $f$ = Frekuensi dasar sinyal listrik dari inverter (Hz).
* $P$ = Jumlah kutub motor kompresor (*Poles*), umumnya 4-Pole ($P=4$) untuk kompresor hermetik AC split (1 PK).
* Angka $120$ = Konstanta konversi dari detik ke menit ($60\\text{ s} \\times 2\\text{ half-cycles}$).

#### 2. Kategori Kecepatan pada Sistem:
* **OFF / Standby (< 400 RPM)**: Kompresor berhenti berputar.
* **LOW (400 – 1.800 RPM)**: Suhu ruangan sudah mendekati target (*setpoint*), kompresor bekerja hemat daya.
* **MEDIUM (1.800 – 3.200 RPM)**: Beban pendinginan normal.
* **HIGH (> 3.200 RPM)**: Kompresor bekerja pada kapasitas maksimal (misal saat ruangan baru dinyalakan atau cuaca sangat panas).

Saat ini kompresor membaca **${rpm.toLocaleString('id-ID')} RPM** dengan status **${isRunning ? 'RUNNING' : 'OFF'}** pada profil **${profile}**.`;
  }

  // 5. Pertanyaan tentang Error SHT31 (-99.9)
  if (p.includes('99.9') || p.includes('-99') || p.includes('sht31') || p.includes('suhu error') || p.includes('sensor terputus')) {
    return `### ❄️ Mengapa Sensor SHT31 Sempat Membaca -99.9°C?

Angka **-99.9°C** adalah *sentinel value* (kode penanda error) yang diprogram di firmware jika komunikasi I2C ke sensor SHT31 mengalami kegagalan.

#### Penyebab Utama:
1. **Interferensi Elektromagnetik (EMI) dari Motor Kompresor**:
   Ketika motor kompresor menyala atau melakukan akselerasi, terjadi lonjakan induktif (*inductive switching noise*) pada kabel jala listrik. Jika kabel data I2C (SDA/SCL) berdekatan dengan kabel motor tanpa pelindung (*shielding*), gelombang I2C akan terdistorsi sehingga ESP32 gagal menerima balasan ACK dari sensor.
2. **I2C Bus Lockup**:
   Gangguan derau dapat menyebabkan jalur SDA terkunci rendah (*stuck LOW*).

#### Solusi yang Telah Diterapkan di Firmware Terbaru:
* **2-Attempt Retry dengan Bus Recovery**: Firmware otomatis me-reset bus I2C (\`Wire.begin()\`) jika bacaan pertama gagal.
* **10-Second Valid Cache**: Jika terjadi lonjakan noise sesaat, firmware tetap menggunakan nilai valid terakhir hingga 10 detik sehingga grafik tidak anjlok ke -99.9.
* **Tips Hardware**: Gunakan kabel berpelindung (*shielded twisted pair*) untuk sensor I2C dan pasang kapasitor decoupling 100nF dekat pin VCC-GND SHT31.`;
  }

  // 6. Pertanyaan Umum / Panduan Lainnya
  return `### 🤖 Asisten Diagnostik AC Datalogger

Halo! Saya dapat membantu Anda memahami seluruh proses dan analisis teknis pada sistem monitoring ini:

1. **Analisis Telemetri Saat Ini**: Ketik *"Bagaimana kondisi sistem saat ini?"* untuk evaluasi tegangan (${v.toFixed(1)}V), kompresor (${rpm} RPM), dan suhu (${temp.toFixed(1)}°C).
2. **Alur Kerja Aplikasi**: Ketik *"Jelaskan proses kerja sistem dari ESP32 hingga web dashboard"*.
3. **Pengukuran True-RMS**: Ketik *"Bagaimana cara ESP32 mengukur True-RMS?"*.
4. **Estimasi RPM Kompresor**: Ketik *"Bagaimana cara menghitung putaran motor kompresor?"*.
5. **Solusi Masalah Sensor**: Ketik *"Kenapa sensor SHT31 sempat membaca -99.9?"*.

💡 *Tips*: Anda juga dapat memasukkan **Google Gemini API Key** (gratis dari Google AI Studio) melalui tombol pengaturan di atas untuk mengaktifkan kecerdasan generatif online tanpa batas!`;
}

// ----------------------------------------------------------------------------
// CALL GEMINI GENERATIVE API (DENGAN AUTO-DISCOVERY & ALTERNATING TURNS)
// ----------------------------------------------------------------------------
export async function sendChatMessage({ prompt, history = [], telemetryContext = null, apiKey = null }) {
  const activeKey = (apiKey || getStoredGeminiKey() || '').trim().replace(/^["']|["']$/g, '');

  // Jika tidak ada API key, langsung gunakan Local Diagnostic Engine
  if (!activeKey) {
    const localReply = runLocalDiagnosticEngine(prompt, telemetryContext);
    return {
      text: localReply,
      source: 'local',
      model: 'Local Diagnostic Engine (Offline Mode)',
    };
  }

  // Format Snapshot Telemetri Terkini untuk disisipkan ke context model
  let liveTelemetryBlock = '';
  if (telemetryContext) {
    liveTelemetryBlock = `
SNAPSHOT TELEMETRI SISTEM SAAT INI (REALTIME):
- Device ID: ${telemetryContext.deviceId || 'ESP32_AC_01'}
- Status Konektivitas: ${telemetryContext.isOnline ? 'ONLINE' : 'OFFLINE'}
- Tegangan Listrik AC True-RMS: ${telemetryContext.voltage?.toFixed(1) || 0} Volt (Normal: 198V - 242V)
- Estimasi RPM Kompresor: ${telemetryContext.rpm?.toLocaleString('id-ID') || 0} RPM (Status: ${telemetryContext.isRunning ? 'RUNNING' : 'OFF'})
- Suhu Evaporator/Ruangan: ${telemetryContext.temperature?.toFixed(1) || 0} °C
- Kelembapan Relatif: ${telemetryContext.humidity?.toFixed(1) || 0} %RH
- Profil Kompresor Aktif: ${telemetryContext.profileName || 'Universal Inverter'}
- Batas Tegangan Aman: Low=${telemetryContext.settings?.voltageLow || 190}V, High=${telemetryContext.settings?.voltageHigh || 250}V
`;
  }

  const userFullPrompt = liveTelemetryBlock 
    ? `${liveTelemetryBlock}\nPERTANYAAN PENGGUNA:\n${prompt}`
    : prompt;

  // Susun payload request dengan pergantian role yang ketat (user -> model -> user)
  const cleanHistory = [];
  let expectedRole = 'user';

  for (const item of history) {
    const r = (item.role === 'assistant' || item.role === 'model') ? 'model' : 'user';
    if (r === expectedRole && item.text) {
      cleanHistory.push({
        role: r,
        parts: [{ text: item.text }]
      });
      expectedRole = r === 'user' ? 'model' : 'user';
    }
  }

  if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === 'user') {
    cleanHistory.pop();
  }

  const contents = [
    ...cleanHistory.slice(-4),
    {
      role: 'user',
      parts: [{ text: userFullPrompt }]
    }
  ];

  const requestBody = {
    contents,
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 1500,
    }
  };

  // Tentukan urutan model yang akan dipanggil:
  // 1. Cek apakah ada model yang sebelumnya terbukti berhasil
  let savedWorkingModel = localStorage.getItem('gemini_working_model');
  let savedWorkingVersion = localStorage.getItem('gemini_working_version') || 'v1beta';

  let modelsToTry = [];
  if (savedWorkingModel) {
    modelsToTry.push({ name: savedWorkingModel, version: savedWorkingVersion });
  }

  // 2. Tambahkan model alternatif dari daftar standar v1 & v1beta
  const fallbackList = [
    { name: 'gemini-1.5-flash', version: 'v1' },
    { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' },
    { name: 'gemini-2.0-flash-exp', version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1' },
    { name: 'gemini-1.5-flash', version: 'v1beta' },
    { name: 'gemini-1.5-pro', version: 'v1' }
  ];

  for (const f of fallbackList) {
    if (!modelsToTry.some(m => m.name === f.name && m.version === f.version)) {
      modelsToTry.push(f);
    }
  }

  let lastError = null;

  for (const candidate of modelsToTry) {
    const ver = candidate.version || 'v1beta';
    const model = candidate.name;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (generatedText) {
        localStorage.setItem('gemini_working_model', model);
        localStorage.setItem('gemini_working_version', ver);
        return {
          text: generatedText,
          source: 'gemini',
          model: `Google Gemini (${model} ${ver})`,
        };
      }
    } catch (err) {
      console.warn(`Gagal memanggil model ${model} (${ver}):`, err.message);
      lastError = err;
    }
  }

  // Jika seluruh pemanggilan API gagal, fallback ke Local Reasoner dengan pesan transparan
  const fallbackAnswer = runLocalDiagnosticEngine(prompt, telemetryContext);
  return {
    text: `${fallbackAnswer}\n\n> ⚠️ *Kendala Koneksi Google Gemini API:* \`${lastError?.message || 'Error tidak diketahui'}\`.\n> *Jawaban di atas dialihkan sementara ke Engine Diagnostik Lokal sistem.*`,
    source: 'fallback',
    model: 'Local Diagnostic Engine (API Fallback)',
    error: lastError?.message
  };
}
