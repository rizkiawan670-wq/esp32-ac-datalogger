// ============================================================================
// COMPRESSOR RPM SUMMARY COMPONENT
// Menampilkan kartu ringkasan kondisi kompresor terintegrasi di Dashboard utama:
// Estimated RPM, Status Kompresor, Kategori Kecepatan, Arah Perubahan (Trend),
// Status Koneksi ESP32, Status Sensor Sinyal Optocoupler, dan Status Kalibrasi.
// ============================================================================

import React, { useState } from 'react';
import { 
  Gauge, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Wifi, 
  WifiOff, 
  Zap, 
  ShieldCheck, 
  AlertTriangle, 
  Sliders, 
  Activity,
  Flame,
  CheckCircle2,
  Clock,
  Radio
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import CompressorProfileModal from './CompressorProfileModal';

export default function CompressorRpmSummary() {
  const { 
    latestRpmReading, 
    activeCompressorProfile, 
    isDeviceOnline, 
    secondsSinceLastPacket, 
    isSimulating,
    rpmSimMode,
    setRpmSimMode,
    toggleSimulation
  } = useApp();

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Status Kalibrasi
  const isCalibrated = Boolean(activeCompressorProfile.is_calibrated);

  // Sensor Sinyal
  const rawSignalStatus = latestRpmReading?.signal_status;
  const isSignalValid = rawSignalStatus === 'VALID' || (rawSignalStatus === undefined && latestRpmReading !== null);
  const displaySignalStatus = !isSignalValid && rawSignalStatus 
    ? (rawSignalStatus === 'NO_SIGNAL' ? 'NO SIGNAL' : 'SIGNAL INVALID') 
    : (latestRpmReading ? 'VALID' : 'MENUNGGU SINYAL');

  // RPM Nilai
  const rawRpm = latestRpmReading?.estimated_rpm !== undefined ? Number(latestRpmReading.estimated_rpm) : 0;
  const isSignalBroken = rawSignalStatus === 'NO_SIGNAL' || rawSignalStatus === 'UNSTABLE' || rawSignalStatus === 'NOISE_DETECTED';

  // Jika sinyal tidak valid, hindari menampilkan angka RPM palsu
  const currentRpm = isSignalBroken ? 0 : Math.max(0, Math.round(rawRpm));

  // Status Kompresor
  let compressorStatus = 'OFF';
  if (latestRpmReading?.compressor_status) {
    compressorStatus = latestRpmReading.compressor_status;
  } else if (currentRpm >= 400) {
    compressorStatus = 'RUNNING';
  } else {
    compressorStatus = 'OFF';
  }

  // Kategori Kecepatan Berdasarkan Kalibrasi Profil
  const lowMax = activeCompressorProfile.rpm_low_max || 1800;
  const medMax = activeCompressorProfile.rpm_medium_max || 3200;
  const highMin = activeCompressorProfile.rpm_high_min || 3200;

  let speedCategory = 'OFF';
  if (currentRpm < 400 || compressorStatus === 'OFF') {
    speedCategory = 'OFF';
  } else if (currentRpm <= lowMax) {
    speedCategory = 'LOW';
  } else if (currentRpm <= medMax) {
    speedCategory = 'MEDIUM';
  } else {
    speedCategory = 'HIGH';
  }

  // Arah Perubahan RPM (Trend)
  const currentTrend = latestRpmReading?.speed_trend || (currentRpm === 0 ? 'STOPPED' : 'STABLE');

  return (
    <div className="space-y-4">
      {/* Kartu Induk Ringkasan Kondisi Compressor */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg">
        
        {/* Header Baris Pertama: Title, Phase Tag, Calibration Banner, Profile Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-industrial-800">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-electric-orange/20 border border-electric-orange/40 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-electric-orange" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white font-mono tracking-wide flex items-center gap-2">
                RINGKASAN KONDISI COMPRESSOR
                <span className="text-[11px] px-2 py-0.5 rounded bg-industrial-950 text-electric-amber border border-electric-amber/30 font-semibold">
                  FASA: {activeCompressorProfile.sensor_channel || 'U'} (1-CH)
                </span>
              </h2>
              <span className="text-xs text-slate-400">
                Pemantauan frekuensi putaran motor inverter via sensor optocoupler terisolasi
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tombol Kalibrasi Profil */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-industrial-950 hover:bg-industrial-800 border border-industrial-700 text-slate-200 text-xs font-mono rounded-lg transition-colors cursor-pointer"
              title="Konfigurasi Profil Motor & Kalibrasi Ambang Batas RPM"
            >
              <Sliders className="w-3.5 h-3.5 text-electric-orange" />
              <span>Profil: {activeCompressorProfile.brand}</span>
            </button>
          </div>
        </div>

        {/* Peringatan Kalibrasi jika Belum Kalibrasi */}
        {!isCalibrated && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-950/40 border border-amber-600/40 text-amber-300 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                <strong>RPM NOT CALIBRATED:</strong> Menggunakan profil estimasi standar. Verifikasi rasio pole kompresor pada tombol konfigurasi profil untuk kalibrasi presisi.
              </span>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="underline hover:text-white font-bold ml-2 whitespace-nowrap cursor-pointer"
            >
              Kalibrasi Sekarang
            </button>
          </div>
        )}

        {/* Sinyal Tidak Valid Alert Banner */}
        {rawSignalStatus && rawSignalStatus !== 'VALID' && (
          <div className="mt-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-600/50 text-rose-300 text-xs font-mono flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              <strong>SIGNAL INVALID:</strong> {rawSignalStatus === 'NO_SIGNAL' ? 'Sinyal optocoupler tidak terdeteksi (kompresor OFF atau kabel lepas).' : 'Noise frekuensi tinggi terdeteksi pada kabel fasa. Periksa front-end optocoupler.'}
            </span>
          </div>
        )}

        {/* 6 KARTU INFORMASI UTAMA KONDISI COMPRESSOR (Mobile responsive 1-col, sm 2-col, lg 6-col) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          
          {/* 1. ESTIMATED RPM */}
          <div className="bg-industrial-950 p-3.5 rounded-xl border border-industrial-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              ESTIMATED RPM
            </span>
            <div className="flex items-baseline space-x-1.5 my-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                {currentRpm > 0 ? currentRpm.toLocaleString('id-ID') : '0'}
              </span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">RPM</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {currentRpm > 0 ? `${(currentRpm / 60).toFixed(1)} Hz Rotor` : 'Rotor Diam'}
            </span>
          </div>

          {/* 2. STATUS COMPRESSOR */}
          <div className="bg-industrial-950 p-3.5 rounded-xl border border-industrial-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              STATUS
            </span>
            <div className="my-1">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                compressorStatus === 'RUNNING' || compressorStatus === 'HIGH' || compressorStatus === 'MEDIUM' || compressorStatus === 'LOW'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full mr-1.5 ${
                  compressorStatus === 'OFF' ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'
                }`}></span>
                {compressorStatus === 'OFF' ? 'OFF' : 'RUNNING'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {compressorStatus === 'OFF' ? 'Motor Standby' : 'Inverter Memodulasi'}
            </span>
          </div>

          {/* 3. KATEGORI KECEPATAN (SPEED) */}
          <div className="bg-industrial-950 p-3.5 rounded-xl border border-industrial-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              SPEED CATEGORY
            </span>
            <div className="my-1">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                speedCategory === 'HIGH'
                  ? 'bg-rose-950/70 border-rose-500/60 text-rose-300 animate-pulse'
                  : speedCategory === 'MEDIUM'
                  ? 'bg-amber-950/70 border-amber-500/60 text-amber-300'
                  : speedCategory === 'LOW'
                  ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}>
                {speedCategory === 'HIGH' ? 'HIGH (Ngebut)' : speedCategory}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {speedCategory === 'LOW' && `≤ ${lowMax} RPM`}
              {speedCategory === 'MEDIUM' && `${lowMax + 1}-${medMax} RPM`}
              {speedCategory === 'HIGH' && `> ${highMin} RPM`}
              {speedCategory === 'OFF' && '0 RPM'}
            </span>
          </div>

          {/* 4. ARAH PERUBAHAN RPM (TREND) */}
          <div className="bg-industrial-950 p-3.5 rounded-xl border border-industrial-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              TREND
            </span>
            <div className="my-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                currentTrend === 'ACCELERATING'
                  ? 'text-emerald-400'
                  : currentTrend === 'DECELERATING'
                  ? 'text-cyan-400'
                  : currentTrend === 'STABLE'
                  ? 'text-slate-200'
                  : 'text-slate-500'
              }`}>
                {currentTrend === 'ACCELERATING' && <TrendingUp className="w-4 h-4 mr-1 text-emerald-400" />}
                {currentTrend === 'DECELERATING' && <TrendingDown className="w-4 h-4 mr-1 text-cyan-400" />}
                {currentTrend === 'STABLE' && <Minus className="w-4 h-4 mr-1 text-slate-400" />}
                {currentTrend}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {currentTrend === 'ACCELERATING' ? 'Meningkatkan Putaran' : (currentTrend === 'DECELERATING' ? 'Menurunkan Putaran' : 'Laju Putaran Konstan')}
            </span>
          </div>

          {/* 5. STATUS SENSOR OPTOCOUPLER */}
          <div className="bg-industrial-950 p-3.5 rounded-xl border border-industrial-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              SENSOR
            </span>
            <div className="my-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                displaySignalStatus === 'VALID'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
              }`}>
                <Zap className="w-3 h-3 mr-1" />
                {displaySignalStatus}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono truncate" title={`Pulsa: ${latestRpmReading?.pulse_count ?? 0}`}>
              Pulsa: {latestRpmReading?.pulse_count ?? 0}
            </span>
          </div>

          {/* 6. STATUS KALIBRASI */}
          <div className="bg-industrial-950 p-3.5 rounded-xl border border-industrial-800 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              KALIBRASI
            </span>
            <div className="my-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                isCalibrated
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-500/40 text-electric-amber'
              }`}>
                {isCalibrated ? 'CALIBRATED' : 'NOT CALIBRATED'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {activeCompressorProfile.motor_poles} Pole ({activeCompressorProfile.pulses_per_revolution} PPR)
            </span>
          </div>

        </div>

        {/* CONTROLS UJI COBA SIMULATOR (TAMPIL HANYA JIKA MODE SIMULASI DIAKTIFKAN) */}
        {isSimulating && (
          <div className="mt-4 pt-3 border-t border-industrial-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center space-x-1.5 text-purple-300">
              <Flame className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="font-bold">Uji Coba Simulator Compressor RPM:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'OFF', label: 'OFF (0 RPM)', cls: 'text-slate-400' },
                { id: 'LOW', label: 'LOW (~1350)', cls: 'text-cyan-400' },
                { id: 'MEDIUM', label: 'MED (~2550)', cls: 'text-amber-400' },
                { id: 'HIGH', label: 'HIGH (~3900)', cls: 'text-rose-400' },
                { id: 'ACCEL', label: 'Akselerasi ↗', cls: 'text-emerald-400' },
                { id: 'DECEL', label: 'Deselerasi ↘', cls: 'text-indigo-400' },
                { id: 'UNSTABLE', label: 'Fluktuatif', cls: 'text-yellow-400' },
                { id: 'LOST', label: 'Putus Sinyal', cls: 'text-red-400' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setRpmSimMode(m.id)}
                  className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                    rpmSimMode === m.id
                      ? 'bg-purple-900/60 border-purple-400 text-white shadow'
                      : 'bg-industrial-950 border-industrial-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal Kalibrasi */}
      <CompressorProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
