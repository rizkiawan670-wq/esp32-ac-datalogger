// ============================================================================
// DASHBOARD PAGE (UNIVERSAL INVERTER ANALYZER)
// Halaman utama terpadu:
// 1. Ringkasan Kondisi AC (StatusCards)
// 2. Ringkasan RPM Compressor (CompressorRpmSummary)
// 3. GRAFIK MONITORING TERPADU (Unified Monitoring Chart - RealtimeCharts)
//    Menampilkan Tegangan RMS, Compressor RPM, Suhu, & Kelembapan dalam satu grafik
// 4. Distribusi Kecepatan LOW/MED/HIGH (CompressorSpeedAnalysis)
// 5. Analisis Perilaku Compressor (CompressorBehaviorAnalysis)
// 6. Riwayat Pengukuran Telemetri & Log (CompressorHistoryLog)
// 7. Fluktuasi Terdeteksi & Statistik Sesi
// ============================================================================

import React from 'react';
import StatusCards from '../components/StatusCards';
import CompressorRpmSummary from '../components/CompressorRpmSummary';
import RealtimeCharts from '../components/RealtimeCharts';
import CompressorSpeedAnalysis from '../components/CompressorSpeedAnalysis';
import CompressorBehaviorAnalysis from '../components/CompressorBehaviorAnalysis';
import CompressorHistoryLog from '../components/CompressorHistoryLog';
import { useApp } from '../context/AppContext';
import { 
  Zap, 
  AlertTriangle, 
  CheckCircle 
} from 'lucide-react';
import { calculateStatistics } from '../utils/analytics';

export default function DashboardPage() {
  const { realtimeBuffer, settings, selectedDeviceId } = useApp();

  const stats = React.useMemo(() => {
    return calculateStatistics(realtimeBuffer, settings.voltageLow, settings.voltageHigh);
  }, [realtimeBuffer, settings]);

  return (
    <div className="space-y-6">

      {/* ================================================================== */}
      {/* 1. RINGKASAN METRIK UTAMA (TEGANGAN RMS, SUHU, KELEMBAPAN, ESTIMATED RPM) */}
      {/* ================================================================== */}
      <section aria-label="Ringkasan Metrik Utama AC & Kompresor">
        <StatusCards />
      </section>

      {/* ================================================================== */}
      {/* 2. GRAFIK MONITORING TERPADU (UNIFIED MULTI-SERIES CHART) */}
      {/* Tepat berada langsung di bawah kartu metrik utama */}
      {/* ================================================================== */}
      <section aria-label="Grafik Monitoring Utama Terpadu">
        <RealtimeCharts />
      </section>

      {/* ================================================================== */}
      {/* 3. PROFIL & KONTROL DETAIL KOMPRESOR INVERTER */}
      {/* ================================================================== */}
      <section aria-label="Ringkasan RPM Compressor">
        <CompressorRpmSummary />
      </section>

      {/* ================================================================== */}
      {/* 4. DISTRIBUSI KECEPATAN COMPRESSOR (LOW / MEDIUM / HIGH SESUAI KALIBRASI) */}
      {/* ================================================================== */}
      <section aria-label="Distribusi Kecepatan Compressor">
        <CompressorSpeedAnalysis />
      </section>

      {/* ================================================================== */}
      {/* 5. ANALISIS PERILAKU COMPRESSOR (KESIMPULAN NARATIF OTOMATIS BERBASIS DATA) */}
      {/* ================================================================== */}
      <section aria-label="Analisis Perilaku Compressor">
        <CompressorBehaviorAnalysis />
      </section>

      {/* ================================================================== */}
      {/* 6. RIWAYAT PENGUKURAN TELEMETRI & LOG RPM */}
      {/* ================================================================== */}
      <section aria-label="Riwayat Pengukuran Telemetri">
        <CompressorHistoryLog />
      </section>

      {/* ================================================================== */}
      {/* 7. RINGKASAN FLUKTUASI LISTRIK & SESI BERJALAN */}
      {/* ================================================================== */}
      <section aria-label="Statistik Sesi & Fluktuasi" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Statistik Sesi Berjalan Listrik AC */}
        <div className="lg:col-span-2 bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center">
            <Zap className="w-4 h-4 mr-2 text-electric-amber" />
            Statistik Sesi Berjalan Listrik AC (Buffer Terakhir)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Tegangan Min / Max */}
            <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800">
              <span className="text-[11px] text-slate-400 block mb-1">Tegangan Min / Max</span>
              <span className="font-mono text-base font-bold text-white">
                {stats.voltage.min}V / {stats.voltage.max}V
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Rata-rata: {stats.voltage.avg}V
              </span>
            </div>

            {/* Indeks Stabilitas PLN */}
            <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800">
              <span className="text-[11px] text-slate-400 block mb-1">Stabilitas Jala Listrik</span>
              <span className={`font-mono text-base font-bold ${
                stats.voltage.stabilityIndex >= 95 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {stats.voltage.stabilityIndex}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Dip/Sag: {stats.voltage.sags} | Swell: {stats.voltage.swells}
              </span>
            </div>

            {/* Suhu Min / Max */}
            <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800">
              <span className="text-[11px] text-slate-400 block mb-1">Suhu Min / Max</span>
              <span className="font-mono text-base font-bold text-white">
                {stats.temperature.min}°C / {stats.temperature.max}°C
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Rentang ΔT: {stats.temperature.delta}°C
              </span>
            </div>

            {/* Kelembapan Rata-rata */}
            <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800">
              <span className="text-[11px] text-slate-400 block mb-1">Kelembapan Rerata</span>
              <span className="font-mono text-base font-bold text-white">
                {stats.humidity.avg}%RH
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">
                Min {stats.humidity.min}% / Max {stats.humidity.max}%
              </span>
            </div>

          </div>

          <div className="mt-4 pt-3 border-t border-industrial-800 flex items-center justify-between text-xs text-slate-400">
            <span>Perangkat aktif: <strong>{selectedDeviceId}</strong></span>
            <span>Total sampel teranalisis: <strong>{stats.count} titik</strong></span>
          </div>
        </div>

        {/* Fluktuasi Terdeteksi */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-electric-orange" />
            Fluktuasi Terdeteksi
          </h3>

          {stats.significantEvents.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs font-mono border border-dashed border-industrial-800 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-500/60 mb-2" />
              <span>Jala listrik & suhu stabil.</span>
              <span className="text-[11px] text-slate-600 mt-0.5">Tidak ada fluktuasi tajam.</span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {stats.significantEvents.map((evt, idx) => (
                <div 
                  key={idx} 
                  className={`p-2.5 rounded-lg border text-xs font-mono ${
                    evt.severity === 'CRITICAL'
                      ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
                      : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{evt.type}</span>
                    <span>{new Date(evt.time).toLocaleTimeString('id-ID')}</span>
                  </div>
                  <p className="text-slate-200 text-xs">{evt.description}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-2 border-t border-industrial-800 text-[11px] text-slate-500">
            Ambang deteksi lonjakan: ΔV ≥ 8V atau ΔT ≥ 1.5°C
          </div>
        </div>

      </section>

    </div>
  );
}
