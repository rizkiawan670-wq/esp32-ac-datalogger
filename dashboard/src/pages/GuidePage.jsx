// ============================================================================
// GUIDE PAGE (PANDUAN TEKNISI, WIRING & KESELAMATAN PLN)
// Dokumentasi interaktif diagram pengkabelan, prosedur kalibrasi True-RMS,
// dan aturan keselamatan kelistrikan tegangan tinggi 220 VAC
// ============================================================================

import React, { useState } from 'react';
import { 
  BookOpen, 
  ShieldAlert, 
  Zap, 
  Cpu, 
  CheckCircle2, 
  Sliders, 
  AlertTriangle,
  Server,
  CloudUpload
} from 'lucide-react';

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState('safety'); // 'safety' | 'wiring' | 'calibration' | 'deployment'

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-electric-orange" />
            Panduan Komprehensif Teknisi Lapangan
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standar keselamatan listrik PLN 220V, diagram pengkabelan ESP32, tata cara kalibrasi True-RMS & SHT31, dan deployment.
          </p>
        </div>

        {/* Tab Navigasi Panduan */}
        <div className="flex items-center space-x-1 bg-industrial-950 p-1 rounded-lg border border-industrial-800 overflow-x-auto">
          {[
            { id: 'safety', label: '1. Keselamatan PLN' },
            { id: 'wiring', label: '2. Wiring AC' },
            { id: 'calibration', label: '3. Kalibrasi True-RMS' },
            { id: 'deployment', label: '4. Deployment' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-industrial-800 text-electric-orange border border-electric-orange/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: KESELAMATAN TEGANGAN LISTRIK PLN 220V (PRIORITAS UTAMA) */}
      {activeTab === 'safety' && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-600/50 text-rose-200 text-xs shadow-md">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-rose-300 font-mono uppercase">
                  ATURAN KESELAMATAN WAJIB (DEADLY VOLTAGE HAZARD)
                </h3>
                <p className="text-slate-200 leading-relaxed">
                  Tegangan 220–240 VAC jala-jala PLN memiliki energi yang mematikan dan dapat menyebabkan sengatan fatal atau bahaya kebakaran busur api listrik (arc flash). 
                  Seluruh perakitan sisi tegangan tinggi wajib mengikuti standar keamanan instalasi listrik!
                </p>
              </div>
            </div>
          </div>

          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center">
              <Zap className="w-4 h-4 mr-2 text-electric-amber" />
              10 Perintah Keselamatan Pengukuran AC Datalogger:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              
              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-rose-400 block">1. JANGAN PERNAH Hubungkan PLN Langsung ke ESP32</span>
                <p className="text-slate-300">
                  Pin GPIO ESP32 hanya toleran terhadap tegangan DC maksimum 3.3V. Memasukkan AC 220V langsung akan menghancurkan mikrokontroler seketika dan meledakkan komponen.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-amber-400 block">2. DILARANG Menggunakan Breadboard untuk Sisi PLN</span>
                <p className="text-slate-300">
                  Breadboard plastik hanya dirancang untuk sirkuit logika berdaya rendah (&lt;30V). Kontak terminal breadboard longgar dan rawan memicu loncatan bunga api serta kebakaran jika dialiri 220 VAC.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-emerald-400 block">3. Gunakan Transduser Terisolasi Galvanik</span>
                <p className="text-slate-300">
                  Gunakan transformator tegangan presisi tertutup (misal modul ZMPT101B bersertifikasi atau transduser AC industri) yang memiliki isolasi dielektrik minimal 2000 VAC antara primer dan sekunder.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-amber-400 block">4. Jangan Anggap ZMPT101B Otomatis Aman</span>
                <p className="text-slate-300">
                  Beberapa modul ZMPT101B murah di pasaran memiliki jarak jalur (creepage/clearance distance) PCB yang terlalu sempit di bawah 2mm. Periksa ketebalan isolasi PCB sebelum dinyalakan.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-cyan-400 block">5. Pasang Sekering Cepat (Fast-Blow Fuse)</span>
                <p className="text-slate-300">
                  Pasang sekering kaca 250V / 200mA pada jalur fasa (L) sebelum masuk ke terminal transduser tegangan untuk memutus arus seketika jika terjadi korsleting.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-emerald-400 block">6. Gunakan Enclosure Tertutup & Strain Relief</span>
                <p className="text-slate-300">
                  Pasang seluruh rangkaian di dalam kotak plastik berperingkat tahan api (Flame-retardant ABS IP54/IP65) dengan kabel gland strain relief agar kabel tidak mudah tertarik lepas.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-slate-300 block">7. Pemisahan Fisik Zona Tegangan Tinggi & Rendah</span>
                <p className="text-slate-300">
                  Beri jarak fisik minimal 8 milimeter antara jalur tegangan tinggi 220V dan jalur logika ESP32 3.3V/5V di dalam kotak panel.
                </p>
              </div>

              <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 space-y-1">
                <span className="font-mono font-bold text-electric-orange block">8. Verifikasi Multimeter Sebelum Sentuh</span>
                <p className="text-slate-300">
                  Selalu gunakan multimeter CAT III / CAT IV untuk memastikan tidak ada tegangan tersisa sebelum menyentuh sirkuit atau mengubah kabel.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WIRING DIAGRAM & PINOUT */}
      {activeTab === 'wiring' && (
        <div className="space-y-5">
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center">
              <Cpu className="w-4 h-4 mr-2 text-electric-orange" />
              Skema Pengkabelan ESP32 DevKit V1
            </h3>

            {/* Tabel Pinout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-industrial-950 text-slate-400 border-b border-industrial-800">
                  <tr>
                    <th className="py-2.5 px-3">Modul Sensor</th>
                    <th className="py-2.5 px-3">Pin Sensor</th>
                    <th className="py-2.5 px-3">Pin ESP32</th>
                    <th className="py-2.5 px-3">Fungsi / Sinyal</th>
                    <th className="py-2.5 px-3">Keterangan Teknis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-800 text-slate-200">
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-red">SHT31</td>
                    <td className="py-2.5 px-3">VCC</td>
                    <td className="py-2.5 px-3 text-cyan-400">3V3</td>
                    <td className="py-2.5 px-3">Daya Sensor (3.3V)</td>
                    <td className="py-2.5 px-3 text-slate-400">Arus rendah ~100 µA</td>
                  </tr>
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-red">SHT31</td>
                    <td className="py-2.5 px-3">GND</td>
                    <td className="py-2.5 px-3 text-slate-400">GND</td>
                    <td className="py-2.5 px-3">Ground Logika</td>
                    <td className="py-2.5 px-3 text-slate-400">Common Ground</td>
                  </tr>
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-red">SHT31</td>
                    <td className="py-2.5 px-3">SDA</td>
                    <td className="py-2.5 px-3 text-electric-amber font-bold">GPIO21</td>
                    <td className="py-2.5 px-3">I2C Data</td>
                    <td className="py-2.5 px-3 text-slate-400">Pull-up resistor 4.7kΩ ke 3.3V</td>
                  </tr>
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-red">SHT31</td>
                    <td className="py-2.5 px-3">SCL</td>
                    <td className="py-2.5 px-3 text-electric-amber font-bold">GPIO22</td>
                    <td className="py-2.5 px-3">I2C Clock</td>
                    <td className="py-2.5 px-3 text-slate-400">100 kHz standard mode</td>
                  </tr>
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-amber">Transduser AC</td>
                    <td className="py-2.5 px-3">VCC</td>
                    <td className="py-2.5 px-3 text-cyan-400">3V3 / 5V (VIN)</td>
                    <td className="py-2.5 px-3">Daya Op-Amp Sensor</td>
                    <td className="py-2.5 px-3 text-slate-400">Sesuai rating modul transduser</td>
                  </tr>
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-amber">Transduser AC</td>
                    <td className="py-2.5 px-3">GND</td>
                    <td className="py-2.5 px-3 text-slate-400">GND</td>
                    <td className="py-2.5 px-3">Ground Logika</td>
                    <td className="py-2.5 px-3 text-slate-400">Ground terisolasi dari PLN</td>
                  </tr>
                  <tr className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 font-bold text-electric-amber">Transduser AC</td>
                    <td className="py-2.5 px-3">OUT</td>
                    <td className="py-2.5 px-3 text-electric-orange font-bold">GPIO34</td>
                    <td className="py-2.5 px-3">Output Analog Sinus</td>
                    <td className="py-2.5 px-3 text-slate-400">ADC1_CH6 (Input Only, 0-3.3V)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Diagram Blok Konseptual */}
            <div className="p-4 bg-industrial-950 rounded-xl border border-industrial-800 font-mono text-xs text-slate-300">
              <div className="text-electric-amber font-bold mb-2">DIAGRAM BLOK ISOLASI GALVANIK:</div>
              <pre className="text-[11px] leading-relaxed text-slate-400 overflow-x-auto">
{`[ PLN 220V L ] ---[ Sekering 200mA ]---+
                                       |===[ TRAFO ISOLASI ]===|---[ Filter & Op-Amp ]---> GPIO34 (ADC)
[ PLN 220V N ] ------------------------+     (2500V Isolasi)   |--- Bias 1.65V DC
                                                               |--- Ground ESP32
                                                               
[ ESP32 3V3 ]  ---------------------------------------------------> SHT31 VCC
[ ESP32 GND ]  ---------------------------------------------------> SHT31 GND
[ GPIO21 ]     ---------------------------------------------------> SHT31 SDA (I2C)
[ GPIO22 ]     ---------------------------------------------------> SHT31 SCL (I2C)`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROSEDUR KALIBRASI TRUE-RMS */}
      {activeTab === 'calibration' && (
        <div className="space-y-5">
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center">
              <Sliders className="w-4 h-4 mr-2 text-electric-amber" />
              Prosedur Kalibrasi Tegangan AC RMS (Step-by-Step)
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Sebelum mengaktifkan bendera <code>IS_CALIBRATED = true</code> di firmware atau dashboard, ikuti 4 tahap kalibrasi berikut menggunakan Multimeter True-RMS bersertifikasi (misal Fluke 117/179 atau Uni-T True-RMS).
            </p>

            <div className="space-y-4 text-xs font-sans">
              
              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-electric-orange text-sm block">
                  Langkah 1: Penyetelan Titik Nol DC (Zero-Bias 1.65V)
                </span>
                <p className="text-slate-300">
                  Tanpa menghubungkan terminal AC ke PLN (input 0 VAC), ukur tegangan DC pada pin <strong>GPIO34</strong> menggunakan multimeter DC.
                  Tegangan harus berada tepat di sekitar <strong>1.650V</strong> (setengah dari 3.3V). Jika modul memiliki trimpot offset, putar perlahan hingga output tepat 1.65V.
                  Masukkan nilai terukur ke variabel <code>ADC_ZERO_OFFSET_VOLTS</code> di <code>config.h</code>.
                </p>
              </div>

              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-electric-orange text-sm block">
                  Langkah 2: Sambungkan Sumber Tegangan Rendah Terisolasi Terlebih Dahulu
                </span>
                <p className="text-slate-300">
                  Untuk keselamatan, uji coba pertama kali menggunakan trafo step-down AC sekunder (misal 12 VAC atau 24 VAC) sebelum beralih ke 220 VAC.
                  Amati bentuk gelombang di Serial Monitor atau osiloskop untuk memastikan tidak ada pemotongan (clipping) puncak gelombang di atas 3.3V atau di bawah 0V.
                </p>
              </div>

              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-electric-orange text-sm block">
                  Langkah 3: Menghitung Faktor Pengali Kalibrasi (Slope)
                </span>
                <p className="text-slate-300">
                  Hubungkan multimeter True-RMS secara paralel pada terminal AC input. Catat nilai multimeter (misal <strong>221.4 VAC</strong>).
                  Buka Serial Monitor ESP32 dan baca nilai raw RMS yang dihitung tanpa pengali (misal terbaca <strong>215.0 VAC</strong>).
                </p>
                <div className="p-3 bg-industrial-900 rounded font-mono text-xs text-electric-amber">
                  VOLTAGE_CALIBRATION_FACTOR = V_multimeter_TrueRMS / V_ESP32_raw
                  <br />
                  Contoh: 221.4 / 215.0 = 1.0297
                </div>
              </div>

              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-emerald-400 text-sm block">
                  Langkah 4: Verifikasi & Pengaktifan Status
                </span>
                <p className="text-slate-300">
                  Perbarui <code>VOLTAGE_CALIBRATION_FACTOR</code> di <code>config.h</code> dan ubah <code>#define IS_CALIBRATED true</code>.
                  Upload ulang firmware ke ESP32. Di halaman <strong>Perangkat</strong> dashboard, centang <em>"Tandai Sudah Kalibrasi"</em>.
                  Status pada dashboard kini akan berubah menjadi hijau <strong>VALID / NORMAL</strong>.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEPLOYMENT PANDUAN NETLIFY & SUPABASE */}
      {activeTab === 'deployment' && (
        <div className="space-y-5">
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center">
              <CloudUpload className="w-4 h-4 mr-2 text-electric-cyan" />
              Panduan Deployment Cloud (Supabase + Netlify)
            </h3>

            <div className="space-y-4 text-xs font-sans">
              
              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-emerald-400 text-sm block">
                  1. Deploy Database di Supabase
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>Buat proyek baru di <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-electric-orange underline">supabase.com</a>.</li>
                  <li>Buka menu <strong>SQL Editor</strong> di dashboard Supabase.</li>
                  <li>Buka file <code>supabase/schema.sql</code> dari proyek ini, copy seluruh kodenya, paste di SQL Editor, lalu klik <strong>Run</strong>.</li>
                  <li>Database tabel <code>devices</code>, <code>ac_readings</code>, <code>system_settings</code>, RLS, dan Realtime akan aktif otomatis.</li>
                </ol>
              </div>

              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-electric-orange text-sm block">
                  2. Deploy Edge Function (ingest-telemetry)
                </span>
                <p className="text-slate-300">
                  Jalankan Supabase CLI di terminal komputer Anda:
                </p>
                <div className="p-2.5 bg-industrial-900 rounded font-mono text-[11px] text-slate-200">
                  supabase functions deploy ingest-telemetry --no-verify-jwt
                </div>
                <p className="text-slate-400 text-[11px]">
                  Catatan: Flag <code>--no-verify-jwt</code> diperlukan agar ESP32 dapat mengirim data menggunakan header otentikasi token perangkat khusus tanpa token user JWT.
                </p>
              </div>

              <div className="p-4 bg-industrial-950 rounded-lg border border-industrial-800 space-y-2">
                <span className="font-mono font-bold text-cyan-400 text-sm block">
                  3. Deploy Frontend di Netlify
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>Push repositori ke GitHub atau hubungkan folder <code>dashboard</code> ke Netlify.</li>
                  <li>Build Command: <code>npm run build</code></li>
                  <li>Publish Directory: <code>dist</code></li>
                  <li>Tambahkan Environment Variables di Netlify Site Settings:
                    <ul className="list-disc list-inside ml-4 mt-1 font-mono text-[11px] text-slate-400">
                      <li><code>VITE_SUPABASE_URL</code>: URL project Supabase Anda</li>
                      <li><code>VITE_SUPABASE_ANON_KEY</code>: Anon public key Supabase Anda</li>
                    </ul>
                  </li>
                  <li>Deploy selesai! Dashboard dapat diakses dari browser HP dan laptop kapan saja.</li>
                </ol>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
