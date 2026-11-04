// ============================================================================
// COMPRESSOR BEHAVIOR ANALYSIS COMPONENT
// Analisis perilaku kerja kompresor inverter berdasarkan data telemetri aktual:
// - Deteksi status transisi kecepatan (Akselerasi, Puncak HIGH, Mempertahankan HIGH, Deselerasi, Hunting, Stop)
// - Ringkasan naratif otomatis berbasis data sebenarnya
// - Peringatan tegas: tidak membuat kesimpulan jika data belum mencukupi.
// ============================================================================

import React, { useMemo } from 'react';
import { 
  Info, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Clock, 
  RotateCw, 
  PowerOff, 
  AlertTriangle, 
  CheckCircle2,
  Cpu,
  ShieldAlert
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateCompressorAnalytics, formatSecondsToTime } from '../utils/analytics';

export default function CompressorBehaviorAnalysis() {
  const { 
    rpmRealtimeBuffer, 
    activeCompressorProfile 
  } = useApp();

  const analytics = useMemo(() => {
    return calculateCompressorAnalytics(rpmRealtimeBuffer, activeCompressorProfile);
  }, [rpmRealtimeBuffer, activeCompressorProfile]);

  const { behaviorFlags, isSufficient, narrative } = analytics;

  return (
    <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
      
      {/* Header Perilaku Kompresor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-industrial-800">
        <div className="flex items-center space-x-2">
          <Info className="w-5 h-5 text-electric-orange" />
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            ANALISIS PERILAKU & DINAMIKA MODULASI COMPRESSOR
          </h3>
        </div>
        <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full border ${
          isSufficient 
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' 
            : 'bg-amber-950/60 border-amber-500/40 text-electric-amber'
        }`}>
          {isSufficient ? 'DATA OBSERVASI MEMADAI' : 'MENGUMPULKAN DATA'}
        </span>
      </div>

      {/* 6 INDIKATOR STATUS PERILAKU KOMPRESOR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        
        {/* 1. Mulai Meningkatkan Kecepatan */}
        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
          behaviorFlags.isAccelerating
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-md ring-1 ring-emerald-500/30'
            : 'bg-industrial-950 border-industrial-800 text-slate-500'
        }`}>
          <div className="flex items-center space-x-1.5 mb-1.5">
            <TrendingUp className={`w-4 h-4 ${behaviorFlags.isAccelerating ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span className="font-bold">Akselerasi</span>
          </div>
          <span className="text-[11px] block leading-tight">
            {behaviorFlags.isAccelerating ? 'Mulai menaikkan RPM' : 'Tidak akselerasi'}
          </span>
        </div>

        {/* 2. Mencapai Kecepatan Tinggi */}
        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
          behaviorFlags.reachedHigh
            ? 'bg-rose-950/40 border-rose-500/60 text-rose-300 shadow-md ring-1 ring-rose-500/30'
            : 'bg-industrial-950 border-industrial-800 text-slate-500'
        }`}>
          <div className="flex items-center space-x-1.5 mb-1.5">
            <Flame className={`w-4 h-4 ${behaviorFlags.reachedHigh ? 'text-rose-400' : 'text-slate-600'}`} />
            <span className="font-bold">Kecepatan Tinggi</span>
          </div>
          <span className="text-[11px] block leading-tight">
            {behaviorFlags.reachedHigh ? 'Mencapai batas HIGH' : 'Belum capai HIGH'}
          </span>
        </div>

        {/* 3. Mempertahankan Kecepatan Tinggi */}
        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
          behaviorFlags.sustainingHigh
            ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-md ring-1 ring-amber-500/30'
            : 'bg-industrial-950 border-industrial-800 text-slate-500'
        }`}>
          <div className="flex items-center space-x-1.5 mb-1.5">
            <Clock className={`w-4 h-4 ${behaviorFlags.sustainingHigh ? 'text-amber-400' : 'text-slate-600'}`} />
            <span className="font-bold">Tahan di HIGH</span>
          </div>
          <span className="text-[11px] block leading-tight">
            {behaviorFlags.sustainingHigh ? `Tahan ${formatSecondsToTime(analytics.highSeconds)}` : 'Tidak bertahan lama'}
          </span>
        </div>

        {/* 4. Mulai Menurunkan Kecepatan */}
        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
          behaviorFlags.isDecelerating
            ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300 shadow-md ring-1 ring-cyan-500/30'
            : 'bg-industrial-950 border-industrial-800 text-slate-500'
        }`}>
          <div className="flex items-center space-x-1.5 mb-1.5">
            <TrendingDown className={`w-4 h-4 ${behaviorFlags.isDecelerating ? 'text-cyan-400' : 'text-slate-600'}`} />
            <span className="font-bold">Deselerasi</span>
          </div>
          <span className="text-[11px] block leading-tight">
            {behaviorFlags.isDecelerating ? 'Mulai menurunkan RPM' : 'Tidak deselerasi'}
          </span>
        </div>

        {/* 5. Perubahan RPM Berulang (Hunting / Fluktuatif) */}
        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
          behaviorFlags.isHunting
            ? 'bg-yellow-950/40 border-yellow-500/60 text-yellow-300 shadow-md ring-1 ring-yellow-500/30'
            : 'bg-industrial-950 border-industrial-800 text-slate-500'
        }`}>
          <div className="flex items-center space-x-1.5 mb-1.5">
            <RotateCw className={`w-4 h-4 ${behaviorFlags.isHunting ? 'text-yellow-400' : 'text-slate-600'}`} />
            <span className="font-bold">Perubahan Berulang</span>
          </div>
          <span className="text-[11px] block leading-tight">
            {behaviorFlags.isHunting ? 'Fluktuasi modulasi' : 'Pola kecepatan teratur'}
          </span>
        </div>

        {/* 6. Compressor Berhenti Bekerja */}
        <div className={`p-3 rounded-lg border text-xs font-mono transition-all ${
          behaviorFlags.isStopped
            ? 'bg-slate-800/60 border-slate-600 text-slate-200'
            : 'bg-industrial-950 border-industrial-800 text-slate-500'
        }`}>
          <div className="flex items-center space-x-1.5 mb-1.5">
            <PowerOff className={`w-4 h-4 ${behaviorFlags.isStopped ? 'text-slate-300' : 'text-slate-600'}`} />
            <span className="font-bold">Berhenti Bekerja</span>
          </div>
          <span className="text-[11px] block leading-tight">
            {behaviorFlags.isStopped ? 'Motor berhenti (0 RPM)' : 'Motor sedang berputar'}
          </span>
        </div>

      </div>

      {/* KOTAK RINGKASAN OTOMATIS BERDASARKAN DATA SEBENARNYA */}
      <div className={`p-4 rounded-xl border font-mono text-xs ${
        isSufficient 
          ? 'bg-industrial-950 border-industrial-750 text-slate-200' 
          : 'bg-industrial-950/60 border-industrial-850 text-slate-400'
      }`}>
        <div className="flex items-center space-x-2 text-slate-400 mb-2 border-b border-industrial-850 pb-2">
          <Cpu className="w-4 h-4 text-electric-orange" />
          <span className="font-bold uppercase tracking-wider text-slate-300">
            Kesimpulan Analisis Perilaku Otomatis (Data-Driven Insight):
          </span>
        </div>

        <p className="text-sm leading-relaxed text-slate-100">
          "{narrative}"
        </p>

        {isSufficient && (
          <div className="mt-3 pt-2.5 border-t border-industrial-850/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>Stabilitas Modulasi: <strong>{analytics.stabilityScore}</strong></span>
            <span>Akselerasi: <strong>{analytics.accelCount} kali</strong> | Deselerasi: <strong>{analytics.decelCount} kali</strong></span>
            <span>Siklus Start-Stop: <strong>{analytics.startStopCycles} siklus</strong></span>
          </div>
        )}
      </div>

      {/* CATATAN PANDUAN TEKNISI INVERTER */}
      <div className="p-3 bg-industrial-950 border border-industrial-850 rounded-lg text-xs font-mono text-slate-400 flex items-start space-x-2.5">
        <ShieldAlert className="w-4 h-4 text-electric-amber flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Panduan Diagnosa Lapangan:</strong> Kompresor inverter normal akan menaikkan putaran ke HIGH saat awal beroperasi untuk mengejar set-point suhu, kemudian menurunkan kecepatan secara bertahap ke MEDIUM atau LOW saat suhu tercapai. Jika kompresor tertahan di HIGH terus menerus (&gt;70% durasi), periksa refrigeran, beban panas ruangan, atau kebersihan kondensor/evaporator.
        </div>
      </div>

    </div>
  );
}
