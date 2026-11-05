// ============================================================================
// GEMINI AI FULL ONLINE SERVICE (100% GOOGLE CLOUD AI)
// Layanan asisten cerdas online murni tanpa jawaban lokal/hardcoded.
// Terhubung langsung ke Google Generative Language API (Google Gemini).
// ============================================================================

// Kredensial default bawaan sistem untuk integrasi online instan
const DEFAULT_KEY_B64 = 'QVEuQWI4Uk42TGtucUVPQ2lnZWcwSEp3Z0RodDFfbEVsMzV2SUNBcW9EOXZIdGdsbV83UVE=';
export const DEFAULT_GEMINI_API_KEY = typeof atob === 'function' ? atob(DEFAULT_KEY_B64) : '';

// Ambil API Key dari localStorage, environment variable, atau default sistem
export function getStoredGeminiKey() {
  try {
    const raw = localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY;
    return raw.trim().replace(/^["']|["']$/g, '');
  } catch (e) {
    const raw = import.meta.env.VITE_GEMINI_API_KEY || DEFAULT_GEMINI_API_KEY;
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
  const cleanKey = (apiKey || getStoredGeminiKey() || DEFAULT_GEMINI_API_KEY).trim().replace(/^["']|["']$/g, '');
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
  const cleanKey = (key || getStoredGeminiKey() || DEFAULT_GEMINI_API_KEY).trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) {
    throw new Error('API Key kosong. Silakan tempelkan kunci dari Google AI Studio.');
  }

  // Daftar model Google Gemini yang diprioritaskan
  const candidateModels = [
    { name: 'gemini-3.5-flash', version: 'v1beta' },
    { name: 'gemini-3.8-flash', version: 'v1beta' },
    { name: 'gemini-flash-latest', version: 'v1beta' },
    { name: 'gemini-3.1-flash-lite', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1' },
    { name: 'gemini-pro', version: 'v1' }
  ];

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
          message: `Koneksi Berhasil! Agent AI aktif dan online.`
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal memvalidasi API Key ke server Agent AI.');
}

// ----------------------------------------------------------------------------
// TOOL / FUNCTION CALL DECLARATIONS UNTUK KALIBRASI OTOMATIS OLEH GEMINI AI
// Memungkinkan agen AI online melakukan kalibrasi sensor langsung atas perintah chat
// ----------------------------------------------------------------------------
export const CALIBRATION_TOOLS = [
  {
    name: 'calibrate_voltage',
    description: 'Kalibrasi pembacaan tegangan listrik AC True-RMS dengan offset (Volt). Panggil fungsi ini saat pengguna meminta kalibrasi/koreksi tegangan, melaporkan selisih dengan multimeter, atau ingin mengatur offset voltase.',
    parameters: {
      type: 'OBJECT',
      properties: {
        offset_volts: {
          type: 'NUMBER',
          description: 'Nilai offset koreksi tegangan dalam Volt (+/-). Contoh: jika multimeter 225V dan sensor 220V, maka offset adalah +5.0. Jika multimeter 218V dan sensor 222V, maka offset adalah -4.0.'
        },
        target_volts: {
          type: 'NUMBER',
          description: 'Nilai tegangan acuan standar / multimeter aktual pengguna (Volt).'
        },
        explanation: {
          type: 'STRING',
          description: 'Penjelasan singkat alasan teknis dan perhitungan offset kalibrasi voltase.'
        }
      },
      required: ['offset_volts']
    }
  },
  {
    name: 'calibrate_temperature',
    description: 'Kalibrasi pembacaan sensor suhu udara ruangan / evaporator SHT31 dengan offset (°C). Panggil fungsi ini saat pengguna meminta penyesuaian suhu atau melaporkan selisih dengan termometer ruangan.',
    parameters: {
      type: 'OBJECT',
      properties: {
        offset_celsius: {
          type: 'NUMBER',
          description: 'Nilai offset koreksi suhu dalam derajat Celsius (+/-). Contoh: jika termometer 24°C dan sensor 26.5°C, maka offset adalah -2.5. Jika termometer 27°C dan sensor 25°C, maka offset adalah +2.0.'
        },
        target_temp: {
          type: 'NUMBER',
          description: 'Nilai suhu acuan standar / termometer aktual pengguna (°C).'
        },
        explanation: {
          type: 'STRING',
          description: 'Penjelasan singkat alasan teknis dan perhitungan offset kalibrasi suhu.'
        }
      },
      required: ['offset_celsius']
    }
  },
  {
    name: 'calibrate_humidity',
    description: 'Kalibrasi pembacaan kelembapan relatif udara SHT31 dengan offset (%RH). Panggil fungsi ini saat pengguna meminta penyesuaian kelembapan atau melaporkan selisih dengan higrometer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        offset_humidity: {
          type: 'NUMBER',
          description: 'Nilai offset koreksi kelembapan dalam %RH (+/-). Contoh: jika higrometer 60% dan sensor 55%, maka offset adalah +5.0.'
        },
        target_humidity: {
          type: 'NUMBER',
          description: 'Nilai kelembapan acuan standar / higrometer aktual pengguna (%RH).'
        },
        explanation: {
          type: 'STRING',
          description: 'Penjelasan singkat alasan teknis dan perhitungan offset kalibrasi kelembapan.'
        }
      },
      required: ['offset_humidity']
    }
  },
  {
    name: 'reset_calibration',
    description: 'Mereset nilai kalibrasi (offset voltase, suhu, dan kelembapan) kembali ke pengaturan standar/pabrik (0.0 atau default).',
    parameters: {
      type: 'OBJECT',
      properties: {
        parameter: {
          type: 'STRING',
          description: 'Parameter yang ingin di-reset: "all", "voltage", "temperature", atau "humidity".'
        },
        explanation: {
          type: 'STRING',
          description: 'Alasan reset kalibrasi.'
        }
      },
      required: ['parameter']
    }
  }
];

// ----------------------------------------------------------------------------
// SISTEM INSTRUKSI PAKAR INSTRUMENTASI & AC INVERTER (ONLINE)
// ----------------------------------------------------------------------------
const SYSTEM_INSTRUCTION = `
Anda adalah "Agent AI", asisten AI online cerdas yang merupakan pakar teknik elektro, instrumentasi IoT ESP32, dan sistem pendingin udara (AC Inverter).

TUGAS UTAMA:
1. Menjawab pertanyaan teknis pengguna secara cerdas, ilmiah, dan mendalam.
2. Menganalisis kondisi data telemetri AC True-RMS, suhu udara, kelembapan relatif, dan titik embun (dew point) secara real-time.
3. Memberikan panduan troubleshooting akurat untuk hardware ESP32, sensor ZMPT101B, sensor SHT31, jalur WiFi, dan database Supabase.
4. Menjelaskan arsitektur dan alur proses aplikasi dari sensor fisik hingga dashboard web.
5. MENGKALIBRASI SENSOR SECARA OTOMATIS: Pengguna dapat meminta kalibrasi voltase, suhu, atau kelembapan langsung melalui percakapan tanpa membuka laptop atau mengedit kodingan!

KEMAMPUAN KALIBRASI OTOMATIS (TOOLS):
Anda memiliki tool resmi untuk mengkalibrasi sensor secara langsung:
- \`calibrate_voltage\`: Panggil fungsi ini jika pengguna melaporkan selisih tegangan dengan multimeter atau meminta penyesuaian voltase. Hitung offset yang diperlukan (misal: multimeter 224V, dashboard 218V -> offset = +6.0V).
- \`calibrate_temperature\`: Panggil fungsi ini jika ada selisih suhu dengan termometer ruangan (misal: termometer 24°C, dashboard 26.5°C -> offset = -2.5°C).
- \`calibrate_humidity\`: Panggil fungsi ini jika ada selisih kelembapan dengan higrometer (misal: higrometer 62%, dashboard 58% -> offset = +4.0%RH).
- \`reset_calibration\`: Panggil fungsi ini jika pengguna ingin mereset kalibrasi ke nilai standar (0.0).

Hasil kalibrasi dari pemanggilan fungsi akan disimpan PERMANEN ke Supabase Cloud dan disiarkan (broadcast) secara instan ke SEMUA layar dan perangkat yang sedang terhubung!

KARAKTERISTIK HARDWARE & SISTEM IOT:
- Mikrokontroler: ESP32 Dual-Core 240MHz dengan FreeRTOS.
- Sensor Tegangan Listrik AC: ZMPT101B modul trafo isolasi presisi (sampling True-RMS diskret pada gelombang 50Hz PLN, nominal 220 VAC ±10% / 198V - 242V).
- Sensor Lingkungan: Sensirion SHT31-D via bus I2C (Address 0x44, bus recovery, auto-retry 2x, valid cache).
- Analisis Titik Embun: Perhitungan Dew Point menggunakan aproksimasi Magnus-Tetens untuk mendeteksi ambang batas kondensasi termal.
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
  const activeKey = (apiKey || getStoredGeminiKey() || DEFAULT_GEMINI_API_KEY).trim().replace(/^["']|["']$/g, '');

  if (!activeKey) {
    throw new Error('MISSING_API_KEY: API Key belum dikonfigurasi. Sistem Agent AI beroperasi secara Full AI Online. Silakan masukkan API Key Anda untuk mulai berkonsultasi.');
  }

  // Format Snapshot Telemetri Terkini untuk disisipkan ke context AI
  let liveTelemetryBlock = '';
  if (telemetryContext) {
    liveTelemetryBlock = `
SNAPSHOT DATA TELEMETRI REALTIME SISTEM AC:
- Perangkat ID: ${telemetryContext.deviceId || 'ESP32_AC_01'}
- Status Konektivitas: ${telemetryContext.isOnline ? 'ONLINE' : 'OFFLINE'}
- Tegangan AC True-RMS: ${telemetryContext.voltage ? Number(telemetryContext.voltage).toFixed(1) : 0} Volt RMS (Offset Kalibrasi: ${telemetryContext.settings?.voltageTrimOffset || 0}V)
- Suhu Sensor Fisik ESP32: ${telemetryContext.temperature ? Number(telemetryContext.temperature).toFixed(1) : 0} °C (Offset: ${telemetryContext.settings?.tempTrimOffset || 0}°C)
- Kelembapan Relatif ESP32: ${telemetryContext.humidity ? Number(telemetryContext.humidity).toFixed(1) : 0} %RH (Offset: ${telemetryContext.settings?.humidityTrimOffset || 0}%RH)
- Titik Embun (Dew Point): ${telemetryContext.dewPoint !== null && telemetryContext.dewPoint !== undefined ? Number(telemetryContext.dewPoint).toFixed(1) : '--'} °C
- Ambang Batas Tegangan: Low=${telemetryContext.settings?.voltageLow || 198}V, High=${telemetryContext.settings?.voltageHigh || 242}V
`;

    if (telemetryContext.signalData) {
      const s = telemetryContext.signalData;
      liveTelemetryBlock += `
DATA DEKODE KABEL SINYAL INVERTER (TERMINAL 3):
- RPM Kompresor: ${s.compressor_rpm || 0} RPM (Target: ${s.target_rpm || 0} RPM, Frekuensi: ${s.inverter_freq_hz || 0} Hz)
- Suhu Ruangan (Thermistor AC): ${s.room_temp !== undefined ? s.room_temp : '--'} °C
- Suhu Pipa Discharge: ${s.discharge_pipe_temp !== undefined ? s.discharge_pipe_temp : '--'} °C
- Suhu Evaporator Indoor Coil: ${s.indoor_coil_temp !== undefined ? s.indoor_coil_temp : '--'} °C
- Suhu Kondensor Outdoor Coil: ${s.outdoor_coil_temp !== undefined ? s.outdoor_coil_temp : '--'} °C
- Katup Ekspansi Elektronik (EEV): ${s.eev_steps || '--'} langkah
- Kipas Indoor: ${s.indoor_fan_rpm || '--'} RPM | Outdoor: ${s.outdoor_fan_rpm || '--'} RPM
- Kode Status / Self-Diagnosis: ${s.error_code || '00'} (${s.error_code === '00' ? 'Normal' : 'Error Terdeteksi'})
- Mode Operasi: ${s.mode || 'COOL'}
`;
    }
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
    tools: [
      {
        functionDeclarations: CALIBRATION_TOOLS
      }
    ],
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
    { name: 'gemini-3.5-flash', version: 'v1beta' },
    { name: 'gemini-3.8-flash', version: 'v1beta' },
    { name: 'gemini-flash-latest', version: 'v1beta' },
    { name: 'gemini-3.1-flash-lite', version: 'v1beta' },
    { name: 'gemini-2.0-flash', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1' },
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
      const candidateObj = data.candidates?.[0];
      const parts = candidateObj?.content?.parts || [];

      // Cek apakah Google Gemini memanggil Function / Tool Kalibrasi
      const functionCallPart = parts.find(p => p.functionCall);
      if (functionCallPart && functionCallPart.functionCall) {
        const textPart = parts.find(p => p.text);
        localStorage.setItem('gemini_working_model', model);
        localStorage.setItem('gemini_working_version', ver);
        return {
          functionCall: functionCallPart.functionCall,
          text: textPart?.text || null,
          source: 'gemini_tool',
          model: 'Agent AI',
        };
      }

      const generatedText = parts.find(p => p.text)?.text;

      if (generatedText) {
        localStorage.setItem('gemini_working_model', model);
        localStorage.setItem('gemini_working_version', ver);
        return {
          text: generatedText,
          source: 'gemini',
          model: 'Agent AI',
        };
      }
    } catch (err) {
      console.warn(`Percobaan model ${model} (${ver}) gagal:`, err.message);
      lastError = err;
    }
  }

  // JIKA GAGAL: Lempar error langsung ke UI, TIDAK ADA fallback jawaban lokal!
  throw new Error(`Koneksi Agent AI Error: ${lastError?.message || 'Gagal menerima respon dari server AI'}. Silakan periksa koneksi internet atau kuota API Key Anda.`);
}
