// ============================================================================
// ANALYSIS PAGE (ANALISIS KONDISI KELISTRIKAN & IKLIM TERMAL AC)
// Modul evaluasi komprehensif stabilitas tegangan jala-jala PLN 220V,
// beban termal ruangan, titik embun (dew point), dan deteksi transien anomali.
// ============================================================================

import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  Thermometer, 
  Droplets, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  Gauge,
  Wind
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateStatistics, calculateDewPoint } from '../utils/analytics';

export default function AnalysisPage() {
  const { realtimeBuffer, settings, selectedDeviceId } = useApp();
  
  // Rentang sampel yang ingin dianalisis
  const [sampleRange, setSampleRange] = useState('all'); // 'all' | '100' | '300' | '600'

  const targetReadings = useMemo(() => {
    if (!realtimeBuffer || realtimeBuffer.length === 0) return [];
    if (sampleRange === 'all') return realtimeBuffer;
    const limit = parseInt(sampleRange, 10);
    return realtimeBuffer.slice(-limit);
  }, [realtimeBuffer, sampleRange]);

  const stats = useMemo(() => {
    return calculateStatistics(targetReadings, settings.voltageLow, settings.voltageHigh);
  }, [targetReadings, settings]);

  const latestDewPoint = useMemo(() => {
    if (targetReadings.length === 0) return null;
    const last = targetReadings[targetReadings.length - 1];
    return calculateDewPoint(Number(last.temperature_c), Number(last.humidity_rh));
  }, [targetReadings]);

  return (
    <div className="space-y-6">
      
      {/* 1. HEADER ANALISIS KELISTRIKAN & PEMILIH JENDELA SAMPEL */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white flex items-center">
            <Gauge className="w-5 h-5 mr-2 text-electric-amber" />
            Laporan Kinerja Kelistrikan & Kondisi Termal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Perangkat target: <code className="text-electric-amber font-bold">{selectedDeviceId}</code> | Sampel: {stats.count} titik telemetri
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-slate-400">Jendela Sampel:</span>
          <select
            value={sampleRange}
            onChange={(e) => setSampleRange(e.target.value)}
            className="bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-electric-amber"
          >
            <option value="100">100 Sampel Terakhir (~1.5 Menit)</option>
            <option value="300">300 Sampel Terakhir (~5 Menit)</option>
            <option value="600">600 Sampel Terakhir (~10 Menit)</option>
            <option value="all">Seluruh Buffer Aktif</option>
          </select>
        </div>
      </div>

      {/* 2. GRID 3 KARTU KELOMPOK INDIKATOR ANALISIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* KELOMPOK 1: KESEHATAN TEGANGAN LISTRIK JALA-JALA PLN */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <Zap className="w-4 h-4 mr-1.5 text-electric-amber" />
              Kualitas Tegangan Listrik
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              stats.voltage.stabilityIndex >= 95
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-600/40'
                : 'bg-amber-950/60 text-amber-400 border border-amber-600/40'
            }`}>
              Stabilitas {stats.voltage.stabilityIndex}%
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Tegangan Rata-rata (V_avg):</span>
              <span className="font-bold text-white">{stats.voltage.avg} VAC</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Tegangan Terendah (V_min):</span>
              <span className="font-bold text-amber-400">{stats.voltage.min} VAC</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Tegangan Tertinggi (V_max):</span>
              <span className="font-bold text-electric-amber">{stats.voltage.max} VAC</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Standar Deviasi (Fluktuasi):</span>
              <span className="font-bold text-slate-200">±{stats.voltage.stdDev} V</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Kejadian Undervoltage (&lt;{settings.voltageLow}V):</span>
              <span className={`font-bold ${stats.voltage.sags > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {stats.voltage.sags} kali
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Kejadian Overvoltage (&gt;{settings.voltageHigh}V):</span>
              <span className={`font-bold ${stats.voltage.swells > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {stats.voltage.swells} kali
              </span>
            </div>
          </div>

          <div className="p-3 bg-industrial-950 rounded-lg border border-industrial-800 text-[11px] text-slate-400">
            <strong>Catatan Kelistrikan:</strong> Tegangan di bawah {settings.voltageLow}V dapat memicu panas berlebih pada komponen sistem pendingin udara.
          </div>
        </div>

        {/* KELOMPOK 2: DINAMIKA TERMAL RUANGAN */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <Thermometer className="w-4 h-4 mr-1.5 text-electric-red" />
              Dinamika Termal Ruangan
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-industrial-950 text-cyan-300 border border-industrial-800">
              ΔT: {stats.temperature.delta}°C
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Suhu Terendah (T_min):</span>
              <span className="font-bold text-cyan-400">{stats.temperature.min} °C</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Suhu Tertinggi (T_max):</span>
              <span className="font-bold text-rose-400">{stats.temperature.max} °C</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Suhu Rerata (T_avg):</span>
              <span className="font-bold text-white">{stats.temperature.avg} °C</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Rentang Dinamika Suhu:</span>
              <span className="font-bold text-slate-200">{stats.temperature.delta} °C</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Estimasi Titik Embun (Dew Point):</span>
              <span className="font-bold text-cyan-300">
                {latestDewPoint !== null ? `${latestDewPoint} °C` : '--'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Status Beban Termal:</span>
              <span className="font-bold text-emerald-400">
                {stats.temperature.avg <= 25 ? 'Terkendali Baik' : 'Beban Pendinginan Tinggi'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-industrial-950 rounded-lg border border-industrial-800 text-[11px] text-slate-400">
            <strong>Kondensasi Udara:</strong> Jika permukaan evaporator atau ducting berada di bawah titik embun ({latestDewPoint || 18}°C), tetesan embun/kondensasi air akan terbentuk.
          </div>
        </div>

        {/* KELOMPOK 3: KELEMBAPAN & INTEGRITAS SENSOR */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <Droplets className="w-4 h-4 mr-1.5 text-electric-cyan" />
              Kelembapan & Integritas Sensor
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-industrial-950 text-slate-300 border border-industrial-800">
              SHT31 OK
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Kelembapan Rerata:</span>
              <span className="font-bold text-white">{stats.humidity.avg} %RH</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Kelembapan Min / Max:</span>
              <span className="font-bold text-slate-200">{stats.humidity.min}% / {stats.humidity.max}%</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Data Tegangan Valid:</span>
              <span className="font-bold text-emerald-400">{stats.validVCount} / {stats.count} titik</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-industrial-850">
              <span className="text-slate-400">Fluktuasi Tajam Terdeteksi:</span>
              <span className="font-bold text-slate-200">{stats.significantEvents.length} kejadian</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Trim Offset Kalibrasi:</span>
              <span className="font-bold text-slate-300">
                V: {settings.voltageTrimOffset || 0}V | T: {settings.tempTrimOffset || 0}°C
              </span>
            </div>
          </div>

          <div className="p-3 bg-industrial-950 rounded-lg border border-industrial-800 text-[11px] text-slate-400">
            <strong>Kenyamanan Termal ASHRAE:</strong> Rentang kelembapan ruangan ber-AC ideal berada di antara 40% – 60% RH untuk mencegah pertumbuhan jamur dan iritasi saluran pernapasan.
          </div>
        </div>

      </div>

      {/* 3. RIWAYAT PERISTIWA FLUKTUASI TAJAM */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-3 flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 text-electric-amber" />
          Log Transien & Kejadian Fluktuasi Tegangan / Suhu
        </h3>

        {stats.significantEvents.length === 0 ? (
          <div className="py-8 text-center text-slate-500 font-mono text-xs border border-dashed border-industrial-800 rounded-lg">
            Tidak ada lonjakan tegangan (ΔV ≥ 8V) atau lonjakan suhu tajam (ΔT ≥ 1.5°C) pada periode sampel terpilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-industrial-950 text-slate-400 border-b border-industrial-800">
                <tr>
                  <th className="py-2.5 px-3">Waktu Kejadian</th>
                  <th className="py-2.5 px-3">Tipe Anomali</th>
                  <th className="py-2.5 px-3">Tingkat Keparahan</th>
                  <th className="py-2.5 px-3">Deskripsi Perubahan Parameter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-800">
                {stats.significantEvents.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-industrial-850/50">
                    <td className="py-2.5 px-3 text-slate-300">
                      {new Date(evt.time).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">{evt.type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.severity === 'CRITICAL'
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-600/40'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-600/40'
                      }`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{evt.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
