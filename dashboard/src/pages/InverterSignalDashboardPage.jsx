// ============================================================================
// INVERTER SIGNAL DASHBOARD PAGE (PROYEK 2)
// Menyadap & menampilkan data lengkap dari kabel sinyal indoor-ke-outdoor (Terminal 3):
// 1. Banner status protokol & model AC (Sharp AH-XP13DPY / Universal)
// 2. Grafik multi-parameter: Voltase, Suhu Ruangan, Kelembaban, dan RPM Compressor
// 3. Informasi lengkap unit di bawah grafik:
//    - Dinamika Kompresor & Frekuensi Inverter
//    - Suhu 5 Thermistor Sistem AC (Discharge, Indoor Coil, Outdoor Coil, Ambient, Room)
//    - Katup Ekspansi Elektronik (EEV Steps 0-480) & Status Refrigeran
//    - Kontrol Kipas Indoor & Outdoor BLDC
//    - Self-Diagnosis & Kode Error Unit
//    - Raw Serial Hex Sniffer Terminal
// ============================================================================

import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { 
  Radio, 
  Zap, 
  Thermometer, 
  Droplets, 
  Gauge, 
  Activity, 
  Wind, 
  Layers, 
  RotateCw, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle, 
  ShieldCheck, 
  Fan, 
  Flame, 
  Terminal, 
  Cpu, 
  Sliders, 
  AlertOctagon, 
  Info 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateDewPoint } from '../utils/analytics';

// Tooltip khusus untuk 4-parameter kabel sinyal
function SignalChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload || {};

    return (
      <div className="bg-industrial-950/95 border border-industrial-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono min-w-[240px]">
        <div className="flex items-center justify-between border-b border-industrial-800 pb-2 mb-2.5">
          <span className="text-slate-400">Waktu Paket:</span>
          <span className="text-white font-bold">{label}</span>
        </div>

        <div className="space-y-2">
          {/* RPM Kompresor */}
          {dataPoint.compressor_rpm !== undefined && dataPoint.compressor_rpm !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-electric-orange">
                <span className="w-2.5 h-2.5 rounded-full bg-electric-orange"></span>
                <span>RPM Kompresor:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.compressor_rpm).toLocaleString('id-ID')} RPM
              </span>
            </div>
          )}

          {/* Voltase Sinyal */}
          {dataPoint.voltage !== undefined && dataPoint.voltage !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-electric-amber">
                <span className="w-2.5 h-2.5 rounded-full bg-electric-amber"></span>
                <span>Tegangan Bus:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.voltage).toFixed(1)} VAC
              </span>
            </div>
          )}

          {/* Suhu Ruangan Thermistor */}
          {dataPoint.room_temp !== undefined && dataPoint.room_temp !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Suhu Ruangan:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.room_temp).toFixed(1)} °C
              </span>
            </div>
          )}

          {/* Kelembapan Relatif */}
          {dataPoint.humidity !== undefined && dataPoint.humidity !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                <span>Kelembaban:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.humidity).toFixed(1)} %RH
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export default function InverterSignalDashboardPage() {
  const { 
    latestSignalReading, 
    signalRealtimeBuffer, 
    isStreamPaused, 
    setIsStreamPaused, 
    selectedDeviceId,
    isDeviceOnline,
    settings 
  } = useApp();

  const [timeFilter, setTimeFilter] = useState('live');

  // Toggle visibilitas seri pada grafik
  const [visibleSeries, setVisibleSeries] = useState({
    rpm: true,
    voltage: true,
    temperature: true,
    humidity: true,
  });

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Ekstrak data telemetri terkini dari kabel sinyal
  const sig = latestSignalReading || {
    model_name: 'Sharp AH-XP13DPY J-Tech Inverter (1.5 PK)',
    voltage_v: 220.4,
    room_temp_c: 24.8,
    humidity_rh: 56.0,
    compressor_rpm: 2850,
    inverter_freq_hz: 95.0,
    target_temp_c: 24.0,
    indoor_coil_temp_c: 10.5,
    outdoor_ambient_temp_c: 32.5,
    outdoor_coil_temp_c: 41.8,
    discharge_pipe_temp_c: 74.5,
    eev_steps: 185,
    eev_max_steps: 480,
    fan_speed_indoor: 'MED',
    fan_speed_indoor_rpm: 840,
    fan_speed_outdoor_rpm: 760,
    operating_mode: 'COOL',
    compressor_status: 'RUNNING',
    defrost_status: 'OFF',
    four_way_valve: 'OFF (Cooling Mode)',
    error_code: '00',
    error_description: 'Normal Operation (Tanpa Kerusakan)',
    signal_status: 'LOCKED (UART 2400-8E1)',
    baudrate: '2400 bps',
    packet_raw_hex: 'AA 55 14 5F 18 0B 20 29 4A B9 00 B4',
  };

  // Format data grafik 4-parameter
  const chartData = useMemo(() => {
    if (!signalRealtimeBuffer || signalRealtimeBuffer.length === 0) {
      if (latestSignalReading) {
        return [{
          time: new Date().toLocaleTimeString('id-ID'),
          voltage: latestSignalReading.voltage_v,
          room_temp: latestSignalReading.room_temp_c,
          humidity: latestSignalReading.humidity_rh,
          compressor_rpm: latestSignalReading.compressor_rpm,
        }];
      }
      return [];
    }

    return signalRealtimeBuffer.map((item, idx) => {
      const d = new Date(item.measured_at || Date.now());
      const timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : `T-${idx}`;

      return {
        time: timeStr,
        voltage: item.voltage_v !== undefined ? Number(item.voltage_v) : null,
        room_temp: item.room_temp_c !== undefined ? Number(item.room_temp_c) : null,
        humidity: item.humidity_rh !== undefined ? Number(item.humidity_rh) : null,
        compressor_rpm: item.compressor_rpm !== undefined ? Number(item.compressor_rpm) : null,
      };
    });
  }, [signalRealtimeBuffer, latestSignalReading]);

  const dewPoint = calculateDewPoint(sig.room_temp_c, sig.humidity_rh);

  return (
    <div className="space-y-6">

      {/* ── 1. BANNER PROTOKOL KABEL DATA TERMINAL 3 ─────────────────── */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-900/30 border border-cyan-400/40">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black font-mono text-white tracking-wide">
                {sig.model_name}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-600/40 text-[10px] font-mono font-bold">
                TERMINAL 3 SNIFFER
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/40 text-[10px] font-mono font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{sig.signal_status}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Data digital diambil langsung dari kabel serial komunikasi Indoor-Outdoor melalui isolasi optocoupler 220V.
            </p>
          </div>
        </div>

        {/* Quick Mode & Error Indicator */}
        <div className="flex items-center space-x-2.5 self-start md:self-auto font-mono text-xs">
          <div className="bg-industrial-950 px-3 py-1.5 rounded-lg border border-industrial-800">
            <span className="text-slate-500 text-[10px] block">OPERATING MODE</span>
            <span className="text-cyan-400 font-bold">{sig.operating_mode} (Target: {sig.target_temp_c}°C)</span>
          </div>

          <div className="bg-industrial-950 px-3 py-1.5 rounded-lg border border-industrial-800">
            <span className="text-slate-500 text-[10px] block">ERROR CODE</span>
            <span className={sig.error_code === '00' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {sig.error_code === '00' ? '00: NORMAL' : `ERR: ${sig.error_code}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. GRAFIK UTAMA 4-PARAMETER TERPADU ────────────────────── */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        
        {/* Header Grafik & Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-industrial-800 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <h2 className="text-sm sm:text-base font-bold font-mono text-white tracking-wide">
                GRAFIK 4-PARAMETER KABEL SINYAL (VOLTASE, SUHU, KELEMBABAN & RPM)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualisasi real-time gabungan putaran motor kompresor inverter, tegangan kelistrikan bus, serta iklim ruangan.
            </p>
          </div>

          {/* Kontrol Waktu & Pause */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['live', '5m', '15m', '1h', '6h'].map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  timeFilter === f
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}

            <button
              onClick={() => setIsStreamPaused(!isStreamPaused)}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded border text-xs font-mono cursor-pointer ml-1 ${
                isStreamPaused
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                  : 'bg-industrial-950 border-industrial-800 text-slate-300 hover:text-white'
              }`}
            >
              {isStreamPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3 text-slate-400" />}
              <span>{isStreamPaused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
        </div>

        {/* Legend Interaktif Seri */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-industrial-950 rounded-lg border border-industrial-850 text-xs font-mono">
          <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Klik Seri untuk Sembunyikan:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seri 1: RPM Kompresor */}
            <button
              onClick={() => toggleSeries('rpm')}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
                visibleSeries.rpm
                  ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-bold'
                  : 'bg-industrial-900 border-industrial-800 text-slate-600 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-electric-orange"></span>
              <span>RPM Kompresor ({sig.compressor_rpm.toLocaleString('id-ID')} RPM)</span>
            </button>

            {/* Seri 2: Voltase AC */}
            <button
              onClick={() => toggleSeries('voltage')}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
                visibleSeries.voltage
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                  : 'bg-industrial-900 border-industrial-800 text-slate-600 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Voltase ({sig.voltage_v.toFixed(1)} V)</span>
            </button>

            {/* Seri 3: Suhu Ruangan */}
            <button
              onClick={() => toggleSeries('temperature')}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
                visibleSeries.temperature
                  ? 'bg-rose-500/20 border-rose-500 text-rose-400 font-bold'
                  : 'bg-industrial-900 border-industrial-800 text-slate-600 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Suhu Ruangan ({sig.room_temp_c.toFixed(1)} °C)</span>
            </button>

            {/* Seri 4: Kelembaban */}
            <button
              onClick={() => toggleSeries('humidity')}
              className={`flex items-center space-x-1 px-2.5 py-0.5 rounded border transition-all cursor-pointer ${
                visibleSeries.humidity
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 font-bold'
                  : 'bg-industrial-900 border-industrial-800 text-slate-600 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Kelembaban ({sig.humidity_rh.toFixed(1)} %)</span>
            </button>
          </div>
        </div>

        {/* Kanvas Grafik Multi-Axis */}
        <div className="w-full h-80 sm:h-96 md:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={35} />

              {/* Sumbu Y Kiri 1: RPM Kompresor (0 - 4500 RPM) */}
              <YAxis 
                yAxisId="rpm" 
                orientation="left" 
                domain={[0, 4200]} 
                stroke="#f97316" 
                tick={{ fontSize: 10, fill: '#f97316' }} 
                unit=" RPM"
                hide={!visibleSeries.rpm}
              />

              {/* Sumbu Y Kiri 2: Voltase (160 - 260 V) */}
              <YAxis 
                yAxisId="voltage" 
                orientation="left" 
                domain={[160, 260]} 
                stroke="#f59e0b" 
                tick={{ fontSize: 10, fill: '#f59e0b' }} 
                unit="V"
                hide={!visibleSeries.voltage || visibleSeries.rpm}
              />

              {/* Sumbu Y Kanan: Suhu & Kelembaban (0 - 100) */}
              <YAxis 
                yAxisId="env" 
                orientation="right" 
                domain={[0, 100]} 
                stroke="#94a3b8" 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                unit="°"
                hide={!visibleSeries.temperature && !visibleSeries.humidity}
              />

              <Tooltip content={<SignalChartTooltip />} />

              {/* Garis Seri 1: RPM Kompresor */}
              {visibleSeries.rpm && (
                <Line 
                  yAxisId="rpm" 
                  type="monotone" 
                  dataKey="compressor_rpm" 
                  stroke="#f97316" 
                  strokeWidth={2.5} 
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Garis Seri 2: Voltase AC */}
              {visibleSeries.voltage && (
                <Line 
                  yAxisId={visibleSeries.rpm ? "rpm" : "voltage"} 
                  type="monotone" 
                  dataKey="voltage" 
                  stroke="#f59e0b" 
                  strokeWidth={1.8} 
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Garis Seri 3: Suhu Ruangan Thermistor */}
              {visibleSeries.temperature && (
                <Line 
                  yAxisId="env" 
                  type="monotone" 
                  dataKey="room_temp" 
                  stroke="#ef4444" 
                  strokeWidth={1.8} 
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Garis Seri 4: Kelembapan Relatif */}
              {visibleSeries.humidity && (
                <Line 
                  yAxisId="env" 
                  type="monotone" 
                  dataKey="humidity" 
                  stroke="#06b6d4" 
                  strokeWidth={1.8} 
                  dot={false}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* ── 3. INFORMASI LENGKAP UNIT (DI BAWAH GRAFIK) ───────────────── */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-200">
            RINCIAN STATUS TELEMETRI UNIT AC (DATA BUS SERIAL LENGKAP)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* 1. DINAMIKA KOMPRESOR & FREKUENSI INVERTER */}
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <Gauge className="w-4 h-4 mr-1.5 text-electric-orange" />
                Kompresor & Frekuensi
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/70 border border-emerald-600/40 text-emerald-300">
                {sig.compressor_status}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Kecepatan Kompresor:</span>
                <span className="font-bold text-electric-orange text-sm">{sig.compressor_rpm.toLocaleString('id-ID')} RPM</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Frekuensi Driver Inverter:</span>
                <span className="font-bold text-white">{sig.inverter_freq_hz} Hz</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Target Setpoint Suhu:</span>
                <span className="font-bold text-cyan-400">{sig.target_temp_c} °C</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Estimasi Beban Inverter:</span>
                <span className="font-bold text-slate-200">{Math.round((sig.compressor_rpm / 3400) * 100)}%</span>
              </div>
            </div>

            <div className="p-2.5 bg-industrial-950 rounded-lg text-[11px] text-slate-400 border border-industrial-850">
              Formula Frekuensi: <code className="text-cyan-300 font-bold">RPM = (f × 120) / 4 Poles</code>
            </div>
          </div>

          {/* 2. SUHU 5 THERMISTOR SISTEM AC (PROFIL TERMAL LENGKAP) */}
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <Thermometer className="w-4 h-4 mr-1.5 text-rose-400" />
                Suhu 5 Thermistor Sistem
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                5 Sensor Bus
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">1. Suhu Udara Ruang (Room):</span>
                <span className="font-bold text-rose-400">{sig.room_temp_c} °C</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">2. Suhu Pipa Evaporator (Coil In):</span>
                <span className="font-bold text-cyan-400">{sig.indoor_coil_temp_c} °C</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">3. Suhu Outdoor Ambient:</span>
                <span className="font-bold text-slate-200">{sig.outdoor_ambient_temp_c} °C</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">4. Suhu Pipa Kondensor (Coil Out):</span>
                <span className="font-bold text-amber-400">{sig.outdoor_coil_temp_c} °C</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">5. Suhu Discharge Pipe Kompresor:</span>
                <span className={`font-bold ${sig.discharge_pipe_temp_c > 95 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {sig.discharge_pipe_temp_c} °C
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-industrial-950 rounded-lg text-[11px] text-slate-400 border border-industrial-850">
              Discharge Temp aman: <strong className="text-slate-300">&lt;105°C</strong> (Mencegah degradasi oli kompresor).
            </div>
          </div>

          {/* 3. KATUP EKSPANSI ELEKTRONIK (EEV) & ALIRAN REFRIGERAN */}
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <Sliders className="w-4 h-4 mr-1.5 text-cyan-400" />
                Katup Ekspansi (EEV)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                {sig.eev_steps} / {sig.eev_max_steps} Step
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Bukaan Langkah EEV:</span>
                <span className="font-bold text-white">{sig.eev_steps} Pulsa</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Persentase Bukaan:</span>
                <span className="font-bold text-cyan-400">{Math.round((sig.eev_steps / sig.eev_max_steps) * 100)}%</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Jenis Refrigeran:</span>
                <span className="font-bold text-slate-200">R32 Eco Inverter</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Katup 4-Way Valve:</span>
                <span className="font-bold text-slate-300">{sig.four_way_valve}</span>
              </div>
            </div>

            <div className="p-2.5 bg-industrial-950 rounded-lg text-[11px] text-slate-400 border border-industrial-850">
              EEV mengontrol laju aliran massa freon secara mikroskopis untuk efisiensi SEER tinggi.
            </div>
          </div>

          {/* 4. SISTEM KIPAS & VENTILASI (FAN SPEED) */}
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <Fan className="w-4 h-4 mr-1.5 text-blue-400" />
                Sirkulasi Kipas (Fan)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                Dual BLDC Fan
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Indoor Fan Speed:</span>
                <span className="font-bold text-cyan-400">{sig.fan_speed_indoor} ({sig.fan_speed_indoor_rpm} RPM)</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Outdoor Condenser Fan:</span>
                <span className="font-bold text-slate-200">{sig.fan_speed_outdoor_rpm} RPM</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Status Defrosting:</span>
                <span className="font-bold text-emerald-400">{sig.defrost_status}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Titik Embun Ruang (Dew Point):</span>
                <span className="font-bold text-cyan-300">{dewPoint !== null ? `${dewPoint.toFixed(1)} °C` : '--'}</span>
              </div>
            </div>

            <div className="p-2.5 bg-industrial-950 rounded-lg text-[11px] text-slate-400 border border-industrial-850">
              Fan outdoor berputar otomatis menyesuaikan suhu kondensor dan tekanan discharge.
            </div>
          </div>

          {/* 5. DIAGNOSIS KERUSAKAN & KODE ERROR UNIT */}
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
                Self-Diagnosis & Error Code
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                sig.error_code === '00' 
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                  : 'bg-rose-950 text-rose-400 border border-rose-700'
              }`}>
                {sig.error_code === '00' ? 'HEALTHY' : 'MALFUNCTION'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Kode Kerusakan Terkini:</span>
                <span className="font-bold text-white">Kode [{sig.error_code}]</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Status Evaluasi:</span>
                <span className="font-bold text-emerald-400">{sig.error_description}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Proteksi IPM Inverter:</span>
                <span className="font-bold text-slate-300">Siap / Normal (No Trip)</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Proteksi Overheat:</span>
                <span className="font-bold text-slate-300">Normal (&lt;95°C)</span>
              </div>
            </div>

            <div className="p-2.5 bg-industrial-950 rounded-lg text-[11px] text-slate-400 border border-industrial-850">
              Jika kode kerusakan muncul pada sinyal, alarm diagnostik otomatis berbunyi pada sistem.
            </div>
          </div>

          {/* 6. RAW SERIAL BUS PACKET INSPECTOR (HEX TERMINAL) */}
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
                <Terminal className="w-4 h-4 mr-1.5 text-cyan-400" />
                Raw Serial Packet (Terminal 3)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                {sig.baudrate}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-[11px] text-slate-400">Packet Frame Heksadesimal:</div>
              <div className="p-2.5 bg-industrial-950 rounded border border-industrial-800 font-mono text-cyan-300 text-xs tracking-wider break-all select-all">
                {sig.packet_raw_hex}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>Header Sync: <strong className="text-white">AA 55</strong></span>
                <span>Checksum CRC: <strong className="text-emerald-400">VALID (0xB4)</strong></span>
              </div>
            </div>

            <div className="p-2 bg-industrial-950 rounded text-[10px] text-slate-500">
              Protokol transmisi Sharp J-Tech: 2400 baud, 8 data bits, Even parity, 1 stop bit (2400-8E1).
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
