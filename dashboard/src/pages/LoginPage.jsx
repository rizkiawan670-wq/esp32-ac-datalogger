// ============================================================================
// LOGIN PAGE
// Pintu masuk autentikasi untuk membedakan dua lingkungan proyek:
// 1. Akun "datalogger" -> Masuk ke Proyek 1 (AC Datalogger True-RMS & SHT31)
// 2. Akun "inverter"   -> Masuk ke Proyek 2 (Inverter Signal Bus Analyzer & Comparator)
// ============================================================================

import React, { useState } from 'react';
import { 
  Activity, 
  Zap, 
  Cpu, 
  Radio, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  User, 
  AlertCircle,
  Sparkles,
  GitCompare,
  Thermometer,
  Gauge
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LoginPage() {
  const { login } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const handleQuickLogin = (roleName) => {
    setErrorMsg(null);
    const res = login(roleName, '');
    if (!res.success) {
      setErrorMsg(res.error);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username) {
      setErrorMsg('Harap masukkan username.');
      return;
    }
    const res = login(username, password);
    if (!res.success) {
      setErrorMsg(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-industrial-950 text-slate-100 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans">
      
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none"></div>

      <div className="max-w-4xl w-full z-10 space-y-8">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-industrial-900 border border-industrial-800 text-slate-400 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-electric-amber animate-pulse"></span>
            <span>ESP32 AC TELEMETRY & INVERTER SIGNAL PLATFORM</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-white">
            PILIH AKUN MASUK SISTEM
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Silakan pilih akun proyek yang ingin Anda buka. Setiap akun memiliki lingkup kerja dan tampilan instrumen khusus.
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-600/60 rounded-xl text-rose-300 text-xs font-mono flex items-center space-x-2 max-w-md mx-auto animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* DUA KARTU PILIHAN AKUN PROYEK */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* 1. AKUN PROYEK 1: AC DATALOGGER */}
          <div className="bg-industrial-900 border border-industrial-800 hover:border-electric-amber/50 rounded-2xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30 text-[11px] font-mono font-bold flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 mr-1 text-electric-amber" />
                  AKUN 1: DATALOGGER
                </span>
                <span className="text-[11px] font-mono text-slate-500">Proyek Pertama</span>
              </div>

              <div>
                <h2 className="text-xl font-bold font-mono text-white group-hover:text-amber-400 transition-colors">
                  VoltAir Datalogger
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Monitoring parameter fisik kelistrikan dan iklim ruangan berbasis sensor hardware eksternal yang terpasang di ESP32.
                </p>
              </div>

              {/* Fitur Inti Proyek 1 */}
              <div className="space-y-2 pt-2 border-t border-industrial-800/80 text-xs text-slate-300 font-mono">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Tegangan Listrik AC True-RMS (ZMPT101B)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span>Suhu Udara & Kelembapan (Sensirion SHT31)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>Evaluasi Titik Embun & Kualitas Jala PLN</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  <span>Agent AI Otomatisasi & Konsultasi Online</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handleQuickLogin('datalogger')}
                className="w-full py-3 px-4 rounded-xl bg-electric-amber hover:bg-amber-400 text-black font-mono font-bold text-xs transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-amber-950/40 cursor-pointer"
              >
                <span>Masuk sebagai Datalogger</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="text-center mt-2 text-[10px] text-slate-500 font-mono">
                User: <code className="text-slate-400">datalogger</code>
              </div>
            </div>
          </div>

          {/* 2. AKUN PROYEK 2: INVERTER SIGNAL BUS ANALYZER & COMPARATOR */}
          <div className="bg-industrial-900 border border-industrial-800 hover:border-cyan-500/50 rounded-2xl p-6 transition-all duration-300 shadow-xl flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono font-bold flex items-center space-x-1">
                  <Radio className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                  AKUN 2: KABEL SINYAL & KOMPARASI
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">Proyek Baru</span>
              </div>

              <div>
                <h2 className="text-xl font-bold font-mono text-white group-hover:text-cyan-400 transition-colors">
                  Inverter Signal Analyzer
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Menyadap komunikasi serial kabel data Terminal 3 (Sharp AH-XP13DPY), membuka data internal unit AC, RPM kompresor, dan komparasi sensor.
                </p>
              </div>

              {/* Fitur Inti Proyek 2 */}
              <div className="space-y-2 pt-2 border-t border-industrial-800/80 text-xs text-slate-300 font-mono">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>Grafik 4-Parameter: Voltase, Suhu, RH & <strong>RPM Kompresor</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Info Lengkap: 5 Thermistor (Discharge, Coil, Ambient) & EEV</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                  <span>Self-Diagnosis, Kode Kerusakan & Raw Hex Packet Sniffer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                  <span><strong>Menu Komparasi Sensor</strong>: ESP32 Fisik vs Kabel Sinyal</span>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => handleQuickLogin('inverter')}
                className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
              >
                <span>Masuk sebagai Inverter Signal Pro</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="text-center mt-2 text-[10px] text-slate-500 font-mono">
                User: <code className="text-slate-400">inverter</code>
              </div>
            </div>
          </div>

        </div>

        {/* Form Login Manual (Opsional) */}
        <div className="bg-industrial-900/60 border border-industrial-850 rounded-xl p-4 text-center">
          {!showManualForm ? (
            <button
              onClick={() => setShowManualForm(true)}
              className="text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 mr-1" />
              <span>Ingin mengetik username & password secara manual? Klik di sini</span>
            </button>
          ) : (
            <form onSubmit={handleManualSubmit} className="max-w-md mx-auto space-y-3 pt-2 text-left">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-mono font-bold text-white">Form Login Kredensial</span>
                <button
                  type="button"
                  onClick={() => setShowManualForm(false)}
                  className="text-[11px] font-mono text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Username:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="datalogger atau inverter"
                    className="w-full bg-industrial-950 border border-industrial-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-amber"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Password:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Opsional / default"
                    className="w-full bg-industrial-950 border border-industrial-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-amber"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-industrial-800 hover:bg-industrial-700 text-white rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors"
              >
                Konfirmasi Masuk
              </button>
            </form>
          )}
        </div>

      </div>

    </div>
  );
}
