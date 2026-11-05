// ============================================================================
// SETTINGS PAGE (PENGATURAN SISTEM)
// Konfigurasi ambang batas alarm (SPLN 220V ±10%), koneksi Supabase,
// kapasitas buffer grafik, dan pengelolaan mode simulasi
// ============================================================================

import React, { useState } from 'react';
import { 
  Settings, 
  Database, 
  Sliders, 
  FlaskConical, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw,
  Shield,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { testSupabaseConnection, resetSupabaseClient } from '../services/supabase';

export default function SettingsPage() {
  const { settings, updateSettings, persistCalibrationToCloud, isSimulating, toggleSimulation, loadInitialData } = useApp();

  const [formSettings, setFormSettings] = useState(() => ({
    voltageTrimOffset: 0.0,
    tempTrimOffset: 0.0,
    humidityTrimOffset: 0.0,
    rpmMultiplier: 1.0,
    ...settings,
  }));

  // Kredensial Supabase
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return localStorage.getItem('ac_datalogger_supabase_url') || import.meta.env.VITE_SUPABASE_URL || 'https://ixgcqgtwzjjfleipdgzz.supabase.co';
  });

  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => {
    return localStorage.getItem('ac_datalogger_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4Z2NxZ3R3empqZmxlaXBkZ3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0Njg1OTYsImV4cCI6MjEwOTA0NDU5Nn0.BoD_md3nbdasrD3-tac3e0Ja6wADA36h82DRUjju2e8';
  });

  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const updated = {
      voltageLow: parseFloat(formSettings.voltageLow),
      voltageHigh: parseFloat(formSettings.voltageHigh),
      voltageTrimOffset: parseFloat(formSettings.voltageTrimOffset || 0),
      tempLow: parseFloat(formSettings.tempLow),
      tempHigh: parseFloat(formSettings.tempHigh),
      tempTrimOffset: parseFloat(formSettings.tempTrimOffset || 0),
      humidityLow: parseFloat(formSettings.humidityLow),
      humidityHigh: parseFloat(formSettings.humidityHigh),
      humidityTrimOffset: parseFloat(formSettings.humidityTrimOffset || 0),
      rpmMultiplier: parseFloat(formSettings.rpmMultiplier || 1.0),
      bufferLimit: parseInt(formSettings.bufferLimit, 10),
    };

    updateSettings(updated);

    // Simpan permanen ke Supabase Cloud & Broadcast ke seluruh perangkat
    if (persistCalibrationToCloud) {
      await persistCalibrationToCloud(updated);
    }

    // Simpan kredensial Supabase (bersihkan URL dari path tambahan)
    const cleanUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    localStorage.setItem('ac_datalogger_supabase_url', cleanUrl);
    setSupabaseUrl(cleanUrl);
    localStorage.setItem('ac_datalogger_supabase_anon_key', supabaseAnonKey.trim());
    resetSupabaseClient();
    loadInitialData();

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Simpan sementara untuk pengujian (bersihkan URL)
    const cleanUrl = supabaseUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
    localStorage.setItem('ac_datalogger_supabase_url', cleanUrl);
    setSupabaseUrl(cleanUrl);
    localStorage.setItem('ac_datalogger_supabase_anon_key', supabaseAnonKey.trim());
    resetSupabaseClient();

    const res = await testSupabaseConnection();
    setTestResult(res);
    setTesting(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg">
        <h2 className="text-base font-bold text-white flex items-center">
          <Settings className="w-5 h-5 mr-2 text-electric-orange" />
          Pengaturan Ambang Batas & Konfigurasi Server
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Sesuaikan toleransi tegangan, batasan suhu/kelembapan, koneksi API Supabase, dan buffer grafik browser.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Pengaturan berhasil disimpan ke penyimpanan lokal browser!</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        
        {/* BAGIAN 1: AMBANG BATAS ALARM KELISTRIKAN & TERMAL */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center border-b border-industrial-800 pb-3">
            <Sliders className="w-4 h-4 mr-2 text-electric-amber" />
            1. Ambang Batas Evaluasi Sensor (Alert Thresholds)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Batas Bawah Tegangan (SPLN -10%) */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Tegangan Minimum Normal (VAC RMS):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={formSettings.voltageLow}
                  onChange={(e) => setFormSettings({ ...formSettings, voltageLow: e.target.value })}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">Volt</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Standar PLN: 198V (220V - 10%)</span>
            </div>

            {/* Batas Atas Tegangan (SPLN +10%) */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Tegangan Maksimum Normal (VAC RMS):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={formSettings.voltageHigh}
                  onChange={(e) => setFormSettings({ ...formSettings, voltageHigh: e.target.value })}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">Volt</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Standar PLN: 242V (220V + 10%)</span>
            </div>

          </div>

          {/* Kalibrasi & Koreksi Offset Sensor (Multi-Device & AI Synced) */}
          <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-industrial-800/80 pb-2.5">
              <div>
                <h4 className="text-xs font-mono font-bold text-amber-400 flex items-center">
                  <Sliders className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Koreksi Offset & Kalibrasi Sensor (Tersinkronisasi Cloud & AI)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Nilai kalibrasi di bawah ini tersimpan permanen di cloud dan otomatis disinkronkan ke seluruh perangkat. Anda juga dapat mengubahnya otomatis via perintah chat di menu AI Diagnosa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormSettings({
                  ...formSettings,
                  voltageTrimOffset: 0.0,
                  tempTrimOffset: 0.0,
                  humidityTrimOffset: 0.0,
                  rpmMultiplier: 1.0,
                })}
                className="px-2.5 py-1 bg-industrial-900 hover:bg-industrial-850 border border-industrial-700 text-slate-300 rounded text-[10px] font-mono cursor-pointer transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                Reset Semua Kalibrasi
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Offset Tegangan AC */}
              <div className="bg-industrial-900/60 p-3 rounded-lg border border-industrial-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Offset Tegangan AC (ZMPT101B):
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
                    {Number(formSettings.voltageTrimOffset || 0) > 0 ? `+${formSettings.voltageTrimOffset}` : formSettings.voltageTrimOffset || 0} V
                  </span>
                </div>
                <div className="relative mb-2">
                  <input
                    type="number"
                    step="0.1"
                    value={formSettings.voltageTrimOffset ?? 0}
                    onChange={(e) => setFormSettings({ ...formSettings, voltageTrimOffset: e.target.value })}
                    className="w-full bg-industrial-950 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-amber-400 font-bold"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1.5 text-xs font-mono text-slate-400">Volt</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, voltageTrimOffset: 5.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    +5.0V
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, voltageTrimOffset: -5.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    -5.0V
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, voltageTrimOffset: 0.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    0.0V
                  </button>
                </div>
              </div>

              {/* Offset Suhu Ruangan */}
              <div className="bg-industrial-900/60 p-3 rounded-lg border border-industrial-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Offset Suhu Udara (SHT31):
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-500/40">
                    {Number(formSettings.tempTrimOffset || 0) > 0 ? `+${formSettings.tempTrimOffset}` : formSettings.tempTrimOffset || 0} °C
                  </span>
                </div>
                <div className="relative mb-2">
                  <input
                    type="number"
                    step="0.1"
                    value={formSettings.tempTrimOffset ?? 0}
                    onChange={(e) => setFormSettings({ ...formSettings, tempTrimOffset: e.target.value })}
                    className="w-full bg-industrial-950 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-rose-400 font-bold"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1.5 text-xs font-mono text-slate-400">°C</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, tempTrimOffset: -2.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    -2.0°C
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, tempTrimOffset: 2.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    +2.0°C
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, tempTrimOffset: 0.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    0.0°C
                  </button>
                </div>
              </div>

              {/* Offset Kelembapan Udara */}
              <div className="bg-industrial-900/60 p-3 rounded-lg border border-industrial-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Offset Kelembapan (SHT31):
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    {Number(formSettings.humidityTrimOffset || 0) > 0 ? `+${formSettings.humidityTrimOffset}` : formSettings.humidityTrimOffset || 0} %RH
                  </span>
                </div>
                <div className="relative mb-2">
                  <input
                    type="number"
                    step="0.5"
                    value={formSettings.humidityTrimOffset ?? 0}
                    onChange={(e) => setFormSettings({ ...formSettings, humidityTrimOffset: e.target.value })}
                    className="w-full bg-industrial-950 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 font-bold"
                    placeholder="0.0"
                  />
                  <span className="absolute right-3 top-1.5 text-xs font-mono text-slate-400">%RH</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, humidityTrimOffset: 5.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    +5.0%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, humidityTrimOffset: -5.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    -5.0%
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, humidityTrimOffset: 0.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    0.0%
                  </button>
                </div>
              </div>

              {/* Faktor Pengali RPM Kompresor */}
              <div className="bg-industrial-900/60 p-3 rounded-lg border border-industrial-800">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-slate-300 font-semibold">
                    Pengali Kecepatan Kompresor:
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/40">
                    x{formSettings.rpmMultiplier || 1.0}
                  </span>
                </div>
                <div className="relative mb-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="5.0"
                    value={formSettings.rpmMultiplier ?? 1.0}
                    onChange={(e) => setFormSettings({ ...formSettings, rpmMultiplier: e.target.value })}
                    className="w-full bg-industrial-950 border border-industrial-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-purple-400 font-bold"
                    placeholder="1.0"
                  />
                  <span className="absolute right-3 top-1.5 text-xs font-mono text-slate-400">Factor</span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, rpmMultiplier: 1.0 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    x1.0 (Standar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, rpmMultiplier: 0.95 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    x0.95 (-5%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSettings({ ...formSettings, rpmMultiplier: 1.05 })}
                    className="px-2 py-0.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-400 rounded text-[10px] font-mono cursor-pointer"
                  >
                    x1.05 (+5%)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Suhu Minimum */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Suhu Udara Minimum Normal (°C):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={formSettings.tempLow}
                  onChange={(e) => setFormSettings({ ...formSettings, tempLow: e.target.value })}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">°C</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Batas supply air atau AC terlampau dingin</span>
            </div>

            {/* Suhu Maksimum */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Suhu Udara Maksimum Peringatan (°C):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={formSettings.tempHigh}
                  onChange={(e) => setFormSettings({ ...formSettings, tempHigh: e.target.value })}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">°C</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Peringatan ruangan panas (ruang server/kamar)</span>
            </div>

            {/* Kelembapan Minimum */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Kelembapan Udara Minimum (%RH):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={formSettings.humidityLow}
                  onChange={(e) => setFormSettings({ ...formSettings, humidityLow: e.target.value })}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">%RH</span>
              </div>
            </div>

            {/* Kelembapan Maksimum */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Kelembapan Udara Maksimum (%RH):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={formSettings.humidityHigh}
                  onChange={(e) => setFormSettings({ ...formSettings, humidityHigh: e.target.value })}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">%RH</span>
              </div>
            </div>

          </div>

          {/* Batas Buffer Titik Grafik */}
          <div className="pt-2 border-t border-industrial-800">
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Kapasitas Buffer Grafik Live (Titik/Detik): {formSettings.bufferLimit} sampel
            </label>
            <input
              type="range"
              min="60"
              max="600"
              step="30"
              value={formSettings.bufferLimit}
              onChange={(e) => setFormSettings({ ...formSettings, bufferLimit: e.target.value })}
              className="w-full accent-electric-orange"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>60 detik (1 Menit)</span>
              <span>180 detik (3 Menit - Disarankan)</span>
              <span>600 detik (10 Menit)</span>
            </div>
          </div>
        </div>

        {/* BAGIAN 2: KONEKSI SUPABASE BACKEND */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center border-b border-industrial-800 pb-3">
            <Database className="w-4 h-4 mr-2 text-electric-orange" />
            2. Kredensial Supabase Project (PostgreSQL & Realtime)
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Project URL (VITE_SUPABASE_URL):
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Public Anon Key (VITE_SUPABASE_ANON_KEY):
              </label>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-electric-orange"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                PERINGATAN: Gunakan anon public key. Jangan pernah menaruh service_role key di frontend!
              </span>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !supabaseUrl || !supabaseAnonKey}
                className="px-3.5 py-1.5 rounded-lg bg-industrial-950 border border-industrial-700 hover:border-slate-500 text-xs font-mono text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {testing ? 'Menguji Koneksi...' : 'Uji Koneksi Database'}
              </button>

              {testResult && (
                <span className={`text-xs font-mono flex items-center ${
                  testResult.ok ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {testResult.ok ? (
                    <CheckCircle className="w-4 h-4 mr-1 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mr-1 text-rose-400" />
                  )}
                  {testResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* BAGIAN 3: MODE SIMULASI & KUOTA DATABASE */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center border-b border-industrial-800 pb-3">
            <FlaskConical className="w-4 h-4 mr-2 text-purple-400" />
            3. Mode Simulasi & Retensi Kuota Data
          </h3>

          <div className="flex items-center justify-between p-3.5 bg-industrial-950 rounded-lg border border-industrial-800">
            <div>
              <span className="text-xs font-bold text-white font-mono block">
                Mode Simulasi Sensor (Data Sintetis 1-Detik)
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Nyalakan jika ESP32 fisik belum online untuk menguji visualisasi grafik dan kalkulasi analitika.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleSimulation()}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                isSimulating
                  ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                  : 'bg-industrial-900 border-industrial-700 text-slate-400'
              }`}
            >
              {isSimulating ? 'SIMULASI AKTIF' : 'SIMULASI MATI'}
            </button>
          </div>

          <div className="p-3.5 bg-industrial-950 rounded-lg border border-industrial-800 text-[11px] text-slate-400 space-y-2">
            <div className="flex items-center text-slate-300 font-bold font-mono">
              <Shield className="w-4 h-4 mr-1.5 text-electric-amber" />
              Perhitungan Kuota Database (86.400 Baris / Hari)
            </div>
            <p>
              Dengan interval transmisi 1 detik, 1 unit ESP32 menghasilkan sekitar <strong>86.400 baris data per hari (~5 MB/hari atau ~150 MB/bulan)</strong>.
              Supabase Free Tier menyediakan penyimpanan database 500 MB (cukup untuk ~3 bulan data kontinu per perangkat).
            </p>
            <p>
              Gunakan fungsi database <code>SELECT public.cleanup_old_readings(30);</code> secara terjadwal untuk membersihkan rekaman yang lebih lama dari 30 hari, atau gunakan fungsi agregasi <code>get_aggregated_readings</code> untuk laporan historis.
            </p>
          </div>
        </div>

        {/* Tombol Simpan Pengaturan */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-electric-orange to-electric-red hover:opacity-90 text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-electric-red/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Semua Pengaturan</span>
          </button>
        </div>

      </form>

    </div>
  );
}
