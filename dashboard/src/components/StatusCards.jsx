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
  Wind,
  Gauge,
  Activity,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateDewPoint } from '../utils/analytics';

export default function StatusCards() {
  const { 
    latestReading, 
    latestRpmReading,
    activeCompressorProfile,
    settings, 
    devices, 
    selectedDeviceId, 
    isDeviceOnline 
  } = useApp();

  // Tegangan selalu dianggap valid (kalibrasi dilakukan di firmware)
  const isVoltageValid = true;

  // Ekstrak data pembacaan AC
  const voltage = latestReading?.voltage_v !== undefined ? Number(latestReading.voltage_v) : null;
  const temperature = latestReading?.temperature_c !== undefined ? Number(latestReading.temperature_c) : null;
  const humidity = latestReading?.humidity_rh !== undefined ? Number(latestReading.humidity_rh) : null;
  const dewPoint = calculateDewPoint(temperature, humidity);

  // Ekstrak data RPM Kompresor (Estimated RPM)
  const rawRpm = latestRpmReading?.estimated_rpm !== undefined ? Number(latestRpmReading.estimated_rpm) : 0;
  const isSignalBroken = latestRpmReading?.signal_status === 'NO_SIGNAL' || latestRpmReading?.signal_status === 'UNSTABLE';
  const currentRpm = isSignalBroken ? 0 : Math.max(0, Math.round(rawRpm));

  const compressorStatus = latestRpmReading?.compressor_status || (currentRpm >= 400 ? 'RUNNING' : 'OFF');
  const rpmTrend = latestRpmReading?.speed_trend || (currentRpm === 0 ? 'STOPPED' : 'STABLE');

  const lowMax = activeCompressorProfile?.rpm_low_max || 1800;
  const medMax = activeCompressorProfile?.rpm_medium_max || 3200;

  let rpmCategory = 'OFF';
  if (currentRpm >= 400 && compressorStatus !== 'OFF') {
    if (currentRpm <= lowMax) rpmCategory = 'LOW';
    else if (currentRpm <= medMax) rpmCategory = 'MEDIUM';
    else rpmCategory = 'HIGH';
  }

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

      {/* 4. KARTU ESTIMATED RPM KOMPRESOR (DI SAMPING KELEMBAPAN RELATIF) */}
      <div className="p-4 rounded-xl border border-industrial-800 bg-industrial-900 relative overflow-hidden shadow-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center">
            <Gauge className="w-4 h-4 mr-1.5 text-electric-orange" />
            Estimated RPM
          </span>
          <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border font-semibold ${
            rpmCategory === 'HIGH'
              ? 'bg-rose-950/50 border-rose-600/60 text-rose-300'
              : rpmCategory === 'MEDIUM'
              ? 'bg-amber-950/50 border-amber-600/60 text-amber-300'
              : rpmCategory === 'LOW'
              ? 'bg-cyan-950/50 border-cyan-600/60 text-cyan-300'
              : 'bg-industrial-950 border-industrial-800 text-slate-400'
          }`}>
            {rpmCategory === 'HIGH' ? 'HIGH (Ngebut)' : rpmCategory}
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-1">
            <span className="text-4xl font-black font-mono text-white tracking-tight">
              {currentRpm.toLocaleString('id-ID')}
            </span>
            <span className="text-lg font-semibold text-slate-400 font-mono">RPM</span>
          </div>

          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
            compressorStatus === 'RUNNING'
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
              : 'bg-slate-900 text-slate-400 border-slate-750'
          }`}>
            {compressorStatus}
          </span>
        </div>

        <div className="mt-3 pt-2 border-t border-industrial-800 text-[11px] text-slate-400 flex justify-between items-center">
          <span className="flex items-center">
            <Activity className="w-3 h-3 mr-1 text-slate-500" />
            Tren: <strong className="ml-1 text-slate-300">{rpmTrend}</strong>
          </span>
          <span className="font-mono text-slate-400">
            Fasa {activeCompressorProfile?.sensor_channel || 'U'}
          </span>
        </div>
      </div>

    </div>
  );
}
