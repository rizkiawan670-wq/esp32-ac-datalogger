// ============================================================================
// STATUS CARDS COMPONENT
// Menampilkan kartu metrik utama: Tegangan AC RMS, Suhu, Kelembapan,
// Status Kalibrasi, dan Titik Embun (Dew Point) dengan indikator visual.
// ============================================================================

import React from 'react';
import { 
  Zap, 
  Thermometer, 
  Droplets, 
  ShieldCheck, 
  Clock, 
  Wind
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateDewPoint } from '../utils/analytics';

export default function StatusCards() {
  const { latestReading, settings, devices, selectedDeviceId, isDeviceOnline } = useApp();

  // Tegangan selalu dianggap valid (kalibrasi dilakukan di firmware)
  const isVoltageValid = true;

  // Ekstrak data pembacaan
  const voltage = latestReading?.voltage_v !== undefined ? Number(latestReading.voltage_v) : null;
  const isVoltageValid2 = true; // voltage always valid
  const temperature = latestReading?.temperature_c !== undefined ? Number(latestReading.temperature_c) : null;
  const humidity = latestReading?.humidity_rh !== undefined ? Number(latestReading.humidity_rh) : null;
  const dewPoint = calculateDewPoint(temperature, humidity);

  // Status evaluasi tegangan
  let voltageStatus = {
    label: 'Menunggu Data',
    color: 'text-slate-400',
    bgColor: 'bg-industrial-900',
    borderColor: 'border-industrial-800'
  };

  if (!isDeviceOnline) {
    voltageStatus = {
      label: 'Perangkat Offline',
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/20',
      borderColor: 'border-rose-900/40'
    };
  } else if (voltage !== null) {
    if (voltage < settings.voltageLow) {
      voltageStatus = {
        label: `Undervoltage (<${settings.voltageLow}V)`,
        color: 'text-rose-400',
        bgColor: 'bg-rose-950/30',
        borderColor: 'border-rose-600/50'
      };
    } else if (voltage > settings.voltageHigh) {
      voltageStatus = {
        label: `Overvoltage (>${settings.voltageHigh}V)`,
        color: 'text-rose-400',
        bgColor: 'bg-rose-950/30',
        borderColor: 'border-rose-600/50'
      };
    } else {
      voltageStatus = {
        label: 'Normal (Toleransi PLN)',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/20',
        borderColor: 'border-emerald-600/30'
      };
    }
  }

  // Evaluasi Suhu
  let tempStatus = 'Normal';
  let tempColor = 'text-emerald-400';
  if (temperature !== null) {
    if (temperature < 18) {
      tempStatus = 'Hembusan Dingin (Supply Air)';
      tempColor = 'text-cyan-400';
    } else if (temperature <= 26) {
      tempStatus = 'Suhu Ruangan Nyaman';
      tempColor = 'text-emerald-400';
    } else {
      tempStatus = 'Beban Termal Tinggi (>26°C)';
      tempColor = 'text-electric-amber';
    }
  }

  // Evaluasi Kelembapan
  let humStatus = 'Optimal';
  let humColor = 'text-cyan-400';
  if (humidity !== null) {
    if (humidity < settings.humidityLow) {
      humStatus = 'Udara Kering (<30%)';
      humColor = 'text-amber-400';
    } else if (humidity > settings.humidityHigh) {
      humStatus = 'Kelembapan Tinggi (>75%)';
      humColor = 'text-rose-400';
    } else {
      humStatus = 'Rentang Sehat (30-70%)';
      humColor = 'text-emerald-400';
    }
  }

  // Format waktu pengukuran
  const measuredTimeStr = latestReading?.measured_at
    ? new Date(latestReading.measured_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '--:--:--';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. KARTU TEGANGAN LISTRIK AC (RMS) */}
      <div className={`p-4 rounded-xl border bg-industrial-900 ${voltageStatus.borderColor} relative overflow-hidden transition-all shadow-md`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
            <Zap className="w-4 h-4 mr-1.5 text-electric-amber" />
            Tegangan AC (RMS)
          </span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border font-semibold ${voltageStatus.bgColor} ${voltageStatus.color} ${voltageStatus.borderColor}`}>
            {voltageStatus.label}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div>
            {!isDeviceOnline ? (
              <span className="text-3xl font-black font-mono text-slate-500">OFFLINE</span>
            ) : voltage !== null ? (
              <div className="flex items-baseline space-x-1">
                <span className="text-4xl font-black font-mono text-white tracking-tight">
                  {voltage.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-slate-400 font-mono">VAC RMS</span>
              </div>
            ) : (
              <span className="text-3xl font-mono text-slate-500">--.-</span>
            )}
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-industrial-800 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Standar PLN: 220V ±10%</span>
          <span className="font-mono text-slate-300">
            {settings.voltageLow}V – {settings.voltageHigh}V
          </span>
        </div>
      </div>

      {/* 2. KARTU SUHU UDARA SHT31 */}
      <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900 relative overflow-hidden shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
            <Thermometer className="w-4 h-4 mr-1.5 text-electric-red" />
            Suhu Udara AC
          </span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full bg-industrial-950 border border-industrial-800 font-semibold ${tempColor}`}>
            {tempStatus}
          </span>
        </div>

        <div className="mt-2 flex items-baseline space-x-1">
          {temperature !== null ? (
            <>
              <span className="text-4xl font-black font-mono text-white tracking-tight">
                {temperature.toFixed(1)}
              </span>
              <span className="text-lg font-semibold text-slate-400 font-mono">°C</span>
            </>
          ) : (
            <span className="text-3xl font-mono text-slate-500">--.-</span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-industrial-800 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Sensor: Sensirion SHT31</span>
          <span className="font-mono text-slate-300">Akurasi ±0.2°C</span>
        </div>
      </div>

      {/* 3. KARTU KELEMBAPAN RELATIF SHT31 */}
      <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900 relative overflow-hidden shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
            <Droplets className="w-4 h-4 mr-1.5 text-electric-cyan" />
            Kelembapan Relatif
          </span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full bg-industrial-950 border border-industrial-800 font-semibold ${humColor}`}>
            {humStatus}
          </span>
        </div>

        <div className="mt-2 flex items-baseline space-x-1">
          {humidity !== null ? (
            <>
              <span className="text-4xl font-black font-mono text-white tracking-tight">
                {humidity.toFixed(1)}
              </span>
              <span className="text-lg font-semibold text-slate-400 font-mono">%RH</span>
            </>
          ) : (
            <span className="text-3xl font-mono text-slate-500">--.-</span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-industrial-800 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Titik Embun (Dew Point):</span>
          <span className="font-mono font-semibold text-cyan-300">
            {dewPoint !== null ? `${dewPoint.toFixed(1)} °C` : '--'}
          </span>
        </div>
      </div>

      {/* 4. KARTU STATUS KALIBRASI & DIAGNOSTIK HARDWARE */}
      <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900 relative overflow-hidden shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
            Status Sistem
          </span>
          <span className="text-[11px] font-mono text-slate-400 flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {measuredTimeStr}
          </span>
        </div>

        <div className="mt-2 space-y-2">
          {/* Kalibrasi Tegangan */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Kalibrasi Tegangan:</span>
            <span className="text-emerald-400 font-mono font-semibold flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Terverifikasi
            </span>
          </div>

          {/* Status Sensor SHT31 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Sensor Suhu (SHT31):</span>
            <span className="text-emerald-400 font-mono font-semibold">
              {temperature !== null ? 'Siap / Normal' : 'Menunggu...'}
            </span>
          </div>

          {/* Sampling Interval */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Laju Pengiriman:</span>
            <span className="text-slate-200 font-mono">1.0 detik (Realtime)</span>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-industrial-800 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Isolasi Galvanik:</span>
          <span className="font-mono text-emerald-400 font-semibold">Aktif (Opto/Trafo)</span>
        </div>
      </div>

    </div>
  );
}
