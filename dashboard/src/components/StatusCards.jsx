// ============================================================================
// STATUS CARDS COMPONENT
// Menampilkan kartu metrik utama sistem telemetri AC:
// 1. Tegangan AC RMS (True-RMS ZMPT101B)
// 2. Suhu Udara AC (°C, Sensirion SHT31)
// 3. Kelembapan Relatif (%RH, Sensirion SHT31)
// 4. Titik Embun / Dew Point (°C, Ambang Kondensasi Termal)
// ============================================================================

import React from 'react';
import { 
  Zap, 
  Thermometer, 
  Droplets, 
  ShieldCheck, 
  Wind,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateDewPoint } from '../utils/analytics';

export default function StatusCards() {
  const { 
    latestReading, 
    settings, 
    isDeviceOnline 
  } = useApp();

  // Ekstrak data pembacaan telemetri AC
  const voltage = latestReading?.voltage_v !== undefined && latestReading?.voltage_v !== null 
    ? Number(latestReading.voltage_v) 
    : (latestReading?.voltage_rms !== undefined && latestReading?.voltage_rms !== null ? Number(latestReading.voltage_rms) : null);
    
  const temperature = latestReading?.temperature_c !== undefined && latestReading?.temperature_c !== null 
    ? Number(latestReading.temperature_c) 
    : null;
    
  const humidity = latestReading?.humidity_rh !== undefined && latestReading?.humidity_rh !== null 
    ? Number(latestReading.humidity_rh) 
    : null;
    
  const dewPoint = calculateDewPoint(temperature, humidity);

  // Status evaluasi tegangan (Standar PLN 220V ±10%: 198V - 242V)
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

  // Evaluasi Suhu Udara
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

  // Evaluasi Kelembapan Relatif
  let humStatus = 'Optimal';
  let humColor = 'text-cyan-400';
  if (humidity !== null) {
    if (humidity < settings.humidityLow) {
      humStatus = `Udara Kering (<${settings.humidityLow}%)`;
      humColor = 'text-amber-400';
    } else if (humidity > settings.humidityHigh) {
      humStatus = `Kelembapan Tinggi (>${settings.humidityHigh}%)`;
      humColor = 'text-rose-400';
    } else {
      humStatus = 'Rentang Sehat (40-60%)';
      humColor = 'text-emerald-400';
    }
  }

  // Evaluasi Titik Embun & Kondensasi
  const tempDelta = (temperature !== null && dewPoint !== null) ? (temperature - dewPoint) : null;
  let dewStatus = {
    label: 'Normal',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-950/20',
    borderColor: 'border-cyan-800/40'
  };

  if (tempDelta !== null) {
    if (tempDelta <= 2.0) {
      dewStatus = {
        label: 'Waspada Kondensasi',
        color: 'text-amber-400',
        bgColor: 'bg-amber-950/40',
        borderColor: 'border-amber-600/50'
      };
    } else {
      dewStatus = {
        label: 'Bebas Kondensasi',
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-950/20',
        borderColor: 'border-emerald-600/30'
      };
    }
  }

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
          <span>Rentang ASHRAE:</span>
          <span className="font-mono text-slate-300">40% – 60% RH</span>
        </div>
      </div>

      {/* 4. KARTU TITIK EMBUN (DEW POINT) & INDEKS KONDENSASI */}
      <div className={`p-4 rounded-xl border bg-industrial-900 ${dewStatus.borderColor} relative overflow-hidden shadow-md`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
            <Wind className="w-4 h-4 mr-1.5 text-cyan-400" />
            Titik Embun (Dew Point)
          </span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border font-semibold ${dewStatus.bgColor} ${dewStatus.color} ${dewStatus.borderColor}`}>
            {dewStatus.label}
          </span>
        </div>

        <div className="mt-2 flex items-baseline space-x-1">
          {dewPoint !== null ? (
            <>
              <span className="text-4xl font-black font-mono text-white tracking-tight">
                {dewPoint.toFixed(1)}
              </span>
              <span className="text-lg font-semibold text-slate-400 font-mono">°C</span>
            </>
          ) : (
            <span className="text-3xl font-mono text-slate-500">--.-</span>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-industrial-800 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Ambang T - Tdp:</span>
          <span className="font-mono text-slate-300">
            {tempDelta !== null ? `Δ ${tempDelta.toFixed(1)} °C` : '--'}
          </span>
        </div>
      </div>

    </div>
  );
}
