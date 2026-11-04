// ============================================================================
// COMPRESSOR SPEED ANALYSIS COMPONENT
// Analisis pembagian kategori kecepatan kompresor:
// - LOW: kompresor bekerja pelan
// - MEDIUM: kompresor bekerja sedang
// - HIGH: kompresor bekerja kecepatan tinggi (ngebut)
// Menampilkan durasi, persentase waktu, RPM minimum, maksimum, rata-rata,
// di mana batas kategori berasal langsung dari profil kalibrasi kompresor.
// ============================================================================

import React, { useMemo } from 'react';
import { 
  Gauge, 
  Clock, 
  Activity, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  Flame,
  BarChart2,
  TrendingUp,
  Percent
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateCompressorAnalytics, formatSecondsToTime } from '../utils/analytics';

export default function CompressorSpeedAnalysis() {
  const { 
    rpmRealtimeBuffer, 
    activeCompressorProfile 
  } = useApp();

  const analytics = useMemo(() => {
    return calculateCompressorAnalytics(rpmRealtimeBuffer, activeCompressorProfile);
  }, [rpmRealtimeBuffer, activeCompressorProfile]);

  const lowMax = activeCompressorProfile.rpm_low_max || 1800;
  const medMax = activeCompressorProfile.rpm_medium_max || 3200;
  const highMin = activeCompressorProfile.rpm_high_min || 3200;

  return (
    <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      
      {/* Header Analisis Kecepatan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-industrial-800">
        <div className="flex items-center space-x-2">
          <BarChart2 className="w-5 h-5 text-electric-orange" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            ANALISIS DISTRIBUSI KECEPATAN COMPRESSOR
          </h3>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Pengamatan Sesi: <strong>{formatSecondsToTime(analytics.totalSeconds)}</strong>
        </div>
      </div>

      {/* Catatan Batas Kalibrasi Dinamis */}
      <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            Batas kalibrasi aktif ({activeCompressorProfile.brand} - {activeCompressorProfile.motor_poles} Pole):
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="text-cyan-400 font-bold">LOW: &le; {lowMax} RPM</span>
          <span className="text-amber-400 font-bold">MEDIUM: {lowMax + 1} - {medMax} RPM</span>
          <span className="text-rose-400 font-bold">HIGH: &gt; {highMin} RPM</span>
        </div>
      </div>

      {/* 3 KARTU KATEGORI KECEPATAN: LOW, MEDIUM, HIGH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* KATEGORI 1: LOW (Bekerja Pelan) */}
        <div className="p-4 rounded-xl border border-cyan-800/40 bg-gradient-to-b from-cyan-950/20 to-industrial-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono text-cyan-300 uppercase tracking-wide flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 mr-2"></span>
                KATEGORI LOW
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-600/40 text-cyan-300 font-bold">
                {analytics.lowPct}% Waktu
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mb-3">
              Compressor bekerja pelan (hemat daya / modulasi rendah).
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-industrial-800/80 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Durasi:</span>
              <span className="text-white font-bold text-sm">
                {formatSecondsToTime(analytics.lowSeconds)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Batas Kalibrasi:</span>
              <span className="text-cyan-400 font-semibold">&le; {lowMax} RPM</span>
            </div>
          </div>
        </div>

        {/* KATEGORI 2: MEDIUM (Kecepatan Sedang) */}
        <div className="p-4 rounded-xl border border-amber-800/40 bg-gradient-to-b from-amber-950/20 to-industrial-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono text-amber-300 uppercase tracking-wide flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2"></span>
                KATEGORI MEDIUM
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950 border border-amber-600/40 text-amber-300 font-bold">
                {analytics.medPct}% Waktu
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mb-3">
              Compressor bekerja dengan kecepatan sedang (beban ruangan stabil).
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-industrial-800/80 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Durasi:</span>
              <span className="text-white font-bold text-sm">
                {formatSecondsToTime(analytics.medSeconds)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Batas Kalibrasi:</span>
              <span className="text-amber-400 font-semibold">{lowMax + 1} - {medMax} RPM</span>
            </div>
          </div>
        </div>

        {/* KATEGORI 3: HIGH (Kecepatan Tinggi / Ngebut) */}
        <div className="p-4 rounded-xl border border-rose-800/40 bg-gradient-to-b from-rose-950/20 to-industrial-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono text-rose-300 uppercase tracking-wide flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2 animate-pulse"></span>
                KATEGORI HIGH
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-950 border border-rose-600/40 text-rose-300 font-bold">
                {analytics.highPct}% Waktu
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mb-3">
              Compressor bekerja kecepatan tinggi (pendinginan maksimal / beban berat).
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-industrial-800/80 font-mono text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Durasi:</span>
              <span className="text-white font-bold text-sm">
                {formatSecondsToTime(analytics.highSeconds)}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Batas Kalibrasi:</span>
              <span className="text-rose-400 font-semibold">&gt; {highMin} RPM</span>
            </div>
          </div>
        </div>

      </div>

      {/* VISUAL BAR DISTRIBUSI WAKTU */}
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span>Distribusi Durasi Waktu Aktif:</span>
          <span>{formatSecondsToTime(analytics.activeSeconds)} aktif | {formatSecondsToTime(analytics.offSeconds)} berhenti</span>
        </div>
        <div className="w-full h-3 bg-industrial-950 rounded-full overflow-hidden flex border border-industrial-800">
          <div 
            style={{ width: `${analytics.lowPct}%` }} 
            className="bg-cyan-500 h-full transition-all"
            title={`LOW: ${analytics.lowPct}%`}
          />
          <div 
            style={{ width: `${analytics.medPct}%` }} 
            className="bg-amber-500 h-full transition-all"
            title={`MEDIUM: ${analytics.medPct}%`}
          />
          <div 
            style={{ width: `${analytics.highPct}%` }} 
            className="bg-rose-500 h-full transition-all"
            title={`HIGH: ${analytics.highPct}%`}
          />
        </div>
      </div>

      {/* BARIS STATISTIK RPM: MINIMUM, MAKSIMUM, RATA-RATA */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-industrial-800">
        
        {/* RPM MINIMUM */}
        <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-mono">RPM MINIMUM</span>
            <span className="font-mono text-lg font-bold text-cyan-400">
              {analytics.minRpm.toLocaleString('id-ID')} RPM
            </span>
          </div>
          <Activity className="w-5 h-5 text-cyan-400/50" />
        </div>

        {/* RPM RATA-RATA */}
        <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-mono">RPM RATA-RATA</span>
            <span className="font-mono text-lg font-bold text-emerald-400">
              {analytics.avgRpm.toLocaleString('id-ID')} RPM
            </span>
          </div>
          <Gauge className="w-5 h-5 text-emerald-400/50" />
        </div>

        {/* RPM MAKSIMUM */}
        <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 block font-mono">RPM MAKSIMUM (PUNCAK)</span>
            <span className="font-mono text-lg font-bold text-rose-400">
              {analytics.maxRpm.toLocaleString('id-ID')} RPM
            </span>
          </div>
          <Flame className="w-5 h-5 text-rose-400/50" />
        </div>

      </div>

    </div>
  );
}
