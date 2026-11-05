// ============================================================================
// GEMINI AI FULL ONLINE SERVICE (100% GOOGLE CLOUD AI)
// Layanan asisten cerdas online murni tanpa jawaban lokal/hardcoded.
// Terhubung langsung ke Google Generative Language API (Google Gemini).
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
// TEST FUNCTION: VERIFIKASI KEABSAHAN GOOGLE GEMINI API KEY SECARA ONLINE
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
    // Daftar model default resmi Google Gemini
    candidateModels = [
      { name: 'gemini-2.5-flash', version: 'v1beta' },
      { name: 'gemini-2.0-flash', version: 'v1beta' },
      { name: 'gemini-1.5-flash', version: 'v1' },
      { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
      { name: 'gemini-pro', version: 'v1' }
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
        localStorage.setItem('gemini_working_model', model);
        localStorage.setItem('gemini_working_version', ver);
        return {
          success: true,
          model: model,
          version: ver,
          message: `Koneksi Berhasil! Model Google Gemini "${model}" (${ver}) aktif dan online.`
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal memvalidasi API Key ke server Google Gemini.');
}

// ----------------------------------------------------------------------------
// SISTEM INSTRUKSI PAKAR INSTRUMENTASI & AC INVERTER (ONLINE)
// ----------------------------------------------------------------------------
const SYSTEM_INSTRUCTION = `
Anda adalah "AC Datalogger AI Diagnostic Assistant", asisten AI online bertenaga Google Gemini yang merupakan pakar teknik elektro, instrumentasi IoT ESP32, dan sistem pendingin udara (AC Inverter).

TUGAS UTAMA:
1. Menjawab pertanyaan teknis pengguna secara cerdas, ilmiah, dan mendalam.
2. Menganalisis kondisi data telemetri AC True-RMS, suhu, kelembapan, dan putaran kompresor (RPM) secara real-time.
3. Memberikan panduan troubleshooting akurat untuk hardware ESP32, sensor ZMPT101B, sensor SHT31, jalur WiFi, dan database Supabase.
4. Menjelaskan arsitektur dan alur proses aplikasi dari sensor fisik hingga dashboard web.

KARAKTERISTIK HARDWARE & SISTEM IOT:
- Mikrokontroler: ESP32 Dual-Core 240MHz dengan FreeRTOS.
- Sensor Tegangan Listrik AC: ZMPT101B modul trafo isolasi presisi (sampling True-RMS diskret pada gelombang 50Hz PLN, nominal 220 VAC ±10% / 198V - 242V).
- Sensor Lingkungan: Sensirion SHT31-D via bus I2C (Address 0x44, bus recovery, auto-retry 2x, valid cache).
- Estimasi Kecepatan Kompresor: Mengukur frekuensi modulasi fasa inverter f (Hz) dari optocoupler terisolasi, dihitung dengan formula RPM = (120 * f) / P (P = 4 poles motor). Rentang kerja: 0 - 4500 RPM.
- Komunikasi Data: WiFi HTTP/1.1 Persistent Socket (Keep-Alive) ke Supabase REST / Edge Functions (mencegah socket TIME_WAIT exhaustion).
- Database & Frontend: PostgreSQL Supabase Realtime WebSockets, Netlify React/Vite Dashboard.

PEDOMAN GAYA RESPON:
- Jawab dalam Bahasa Indonesia yang profesional, ramah teknisi, terstruktur, dan solutif.
- Gunakan formatting Markdown yang rapi (bold, bullet points, numbered lists, code blocks, math LaTeX $...$).
- JIKA DATA TELEMETRI REALTIME TERSEDIA PADA PROMPT: Analisis angka-angka tersebut secara langsung untuk memberikan penilaian komprehensif atas status AC.
- Dilarang memberikan jawaban template statis; berikan analisis generatif yang mendalam dan kontekstual.
`;

// ----------------------------------------------------------------------------
// CALL GOOGLE GEMINI API SECARA FULL ONLINE (NO LOCAL ENGINE FALLBACK)
// ----------------------------------------------------------------------------
export async function sendChatMessage({ prompt, history = [], telemetryContext = null, apiKey = null }) {
  const activeKey = (apiKey || getStoredGeminiKey() || '').trim().replace(/^["']|["']$/g, '');

  // Jika tidak ada API key, tolak jawaban lokal dan minta API Key secara transparan
  if (!activeKey) {
    throw new Error('MISSING_API_KEY: Google Gemini API Key belum dikonfigurasi. Sistem AI Diagnosa beroperasi secara Full AI Online. Silakan masukkan Google Gemini API Key Anda untuk mulai berkonsultasi.');
  }

  // Format Snapshot Telemetri Terkini untuk disisipkan ke context AI
  let liveTelemetryBlock = '';
  if (telemetryContext) {
    liveTelemetryBlock = `
SNAPSHOT DATA TELEMETRI REALTIME SISTEM AC:
- Perangkat ID: ${telemetryContext.deviceId || 'ESP32_AC_01'}
- Status Konektivitas: ${telemetryContext.isOnline ? 'ONLINE' : 'OFFLINE'}
- Tegangan AC True-RMS: ${telemetryContext.voltage ? Number(telemetryContext.voltage).toFixed(1) : 0} Volt RMS (Batas Wajar PLN: 198V - 242V)
- Estimasi Kecepatan Kompresor: ${telemetryContext.rpm ? Number(telemetryContext.rpm).toLocaleString('id-ID') : 0} RPM (Status: ${telemetryContext.isRunning ? 'RUNNING' : 'OFF'})
- Suhu Evaporator / Ruangan: ${telemetryContext.temperature ? Number(telemetryContext.temperature).toFixed(1) : 0} °C
- Kelembapan Relatif: ${telemetryContext.humidity ? Number(telemetryContext.humidity).toFixed(1) : 0} %RH
- Profil Kompresor Inverter: ${telemetryContext.profileName || 'Universal Inverter'}
- Ambang Batas Tegangan: Low=${telemetryContext.settings?.voltageLow || 198}V, High=${telemetryContext.settings?.voltageHigh || 242}V
`;
  }

  const userFullPrompt = liveTelemetryBlock 
    ? `${liveTelemetryBlock}\nPERTANYAAN TEKNIS DARI PENGGUNA:\n${prompt}`
    : prompt;

  // Susun riwayat percakapan dengan format alternating turns (user -> model -> user)
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
    ...cleanHistory.slice(-6),
    {
      role: 'user',
      parts: [{ text: userFullPrompt }]
    }
  ];

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    generationConfig: {
      temperature: 0.35,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  };

  // Tentukan daftar model resmi Google Gemini yang akan dipanggil
  let savedWorkingModel = localStorage.getItem('gemini_working_model');
  let savedWorkingVersion = localStorage.getItem('gemini_working_version') || 'v1beta';

  let modelsToTry = [];
  if (savedWorkingModel) {
    modelsToTry.push({ name: savedWorkingModel, version: savedWorkingVersion });
  }

  // Model Google Gemini default (prioritas flash untuk kecepatan & akurasi tinggi)
  const defaultModels = [
    { name: 'gemini-2.5-flash', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1' },
    { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
    { name: 'gemini-pro', version: 'v1' }
  ];

  for (const m of defaultModels) {
    if (!modelsToTry.some(x => x.name === m.name && x.version === m.version)) {
      modelsToTry.push(m);
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
        const errMsg = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (generatedText) {
        localStorage.setItem('gemini_working_model', model);
        localStorage.setItem('gemini_working_version', ver);
        return {
          text: generatedText,
          source: 'gemini',
          model: `Google Gemini Online (${model})`,
        };
      }
    } catch (err) {
      console.warn(`Percobaan model ${model} (${ver}) gagal:`, err.message);
      lastError = err;
    }
  }

  // JIKA GAGAL: Lempar error langsung ke UI, TIDAK ADA fallback jawaban lokal!
  throw new Error(`Google Gemini API Error: ${lastError?.message || 'Gagal menerima respon dari server Google AI'}. Silakan periksa koneksi internet atau kuota API Key Google AI Studio Anda.`);
}
