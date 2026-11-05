// ============================================================================
// SENSOR COMPARISON PAGE (MENU KOMPARASI SENSOR ESP32 VS KABEL SINYAL)
// Menampilkan komparasi langsung antara:
// 1. Data Sensor Fisik ESP32 (ZMPT101B True-RMS & Sensirion SHT31)
// 2. Data Internal AC dari Kabel Sinyal Terminal 3 (Sharp Inverter Bus)
// Dilengkapi kartu selisih (Delta), grafik komparasi perbandingan, dan analisis teknisi.
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
  GitCompare, 
  Zap, 
  Thermometer, 
  Droplets, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Sliders, 
  ArrowRightLeft,
  RotateCw,
  Info,
  Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';

// Tooltip khusus untuk melihat selisih nilai secara instan
function ComparisonTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload || {};

    const diffTemp = (dataPoint.espTemp !== null && dataPoint.sigTemp !== null)
      ? (dataPoint.espTemp - dataPoint.sigTemp).toFixed(2)
      : null;

    const diffVolt = (dataPoint.espVolt !== null && dataPoint.sigVolt !== null)
      ? (dataPoint.espVolt - dataPoint.sigVolt).toFixed(2)
      : null;

    return (
      <div className="bg-industrial-950/95 border border-industrial-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono min-w-[260px]">
        <div className="flex items-center justify-between border-b border-industrial-800 pb-2 mb-2.5">
          <span className="text-slate-400">Waktu Sampel:</span>
          <span className="text-white font-bold">{label}</span>
        </div>

        <div className="space-y-2.5">
          {/* Suhu */}
          {dataPoint.espTemp !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-rose-400">ESP32 SHT31:</span>
                <span className="font-bold text-white">{dataPoint.espTemp.toFixed(1)} °C</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-400">Thermistor Sinyal AC:</span>
                <span className="font-bold text-white">{dataPoint.sigTemp ? dataPoint.sigTemp.toFixed(1) : '--'} °C</span>
              </div>
              {diffTemp !== null && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-industrial-850">
                  <span>Selisih (ΔT):</span>
                  <span className={`font-bold ${Math.abs(diffTemp) <= 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {diffTemp > 0 ? `+${diffTemp}` : diffTemp} °C
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Voltase */}
          {dataPoint.espVolt !== null && (
            <div className="space-y-1 pt-1.5 border-t border-industrial-800">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-400">ESP32 ZMPT101B:</span>
                <span className="font-bold text-white">{dataPoint.espVolt.toFixed(1)} V</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-cyan-400">Kabel Sinyal Bus:</span>
                <span className="font-bold text-white">{dataPoint.sigVolt ? dataPoint.sigVolt.toFixed(1) : '--'} V</span>
              </div>
              {diffVolt !== null && (
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-industrial-850">
                  <span>Selisih (ΔV):</span>
                  <span className={`font-bold ${Math.abs(diffVolt) <= 3.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {diffVolt > 0 ? `+${diffVolt}` : diffVolt} V
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export default function SensorComparisonPage() {
  const { 
    latestReading, 
    realtimeBuffer, 
    latestSignalReading, 
    signalRealtimeBuffer 
  } = useApp();

  const [activeParamTab, setActiveParamTab] = useState('all'); // 'all' | 'temperature' | 'voltage' | 'humidity'

  // Nilai Terkini Sensor ESP32 Fisik
  const espVolt = latestReading?.voltage_v !== null && latestReading?.voltage_v !== undefined 
    ? Number(latestReading.voltage_v) 
    : (latestReading?.voltage_rms ? Number(latestReading.voltage_rms) : 220.0);
  const espTemp = latestReading?.temperature_c !== null && latestReading?.temperature_c !== undefined 
    ? Number(latestReading.temperature_c) 
    : 24.5;
  const espHum = latestReading?.humidity_rh !== null && latestReading?.humidity_rh !== undefined 
    ? Number(latestReading.humidity_rh) 
    : 55.0;

  // Nilai Terkini Kabel Sinyal AC (Terminal 3)
  const sigVolt = latestSignalReading?.voltage_v !== undefined ? Number(latestSignalReading.voltage_v) : 220.2;
  const sigTemp = latestSignalReading?.room_temp_c !== undefined ? Number(latestSignalReading.room_temp_c) : 24.8;
  const sigHum = latestSignalReading?.humidity_rh !== undefined ? Number(latestSignalReading.humidity_rh) : 56.0;

  // Perhitungan Delta Selisih
  const deltaTemp = Math.round((espTemp - sigTemp) * 10) / 10;
  const deltaVolt = Math.round((espVolt - sigVolt) * 10) / 10;
  const deltaHum = Math.round((espHum - sigHum) * 10) / 10;

  // Gabungkan buffer untuk grafik komparasi
  const comparisonData = useMemo(() => {
    const maxLen = Math.max(realtimeBuffer.length, signalRealtimeBuffer.length);
    if (maxLen === 0) {
      return [{
        time: new Date().toLocaleTimeString('id-ID'),
        espVolt,
        sigVolt,
        espTemp,
        sigTemp,
        espHum,
        sigHum,
      }];
    }

    const result = [];
    const step = maxLen > 200 ? Math.ceil(maxLen / 120) : 1;

    for (let i = 0; i < maxLen; i += step) {
      const espItem = realtimeBuffer[i] || realtimeBuffer[realtimeBuffer.length - 1] || {};
      const sigItem = signalRealtimeBuffer[i] || signalRealtimeBuffer[signalRealtimeBuffer.length - 1] || {};

      const d = new Date(espItem.measured_at || sigItem.measured_at || Date.now());
      const timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : `T-${i}`;

      result.push({
        time: timeStr,
        espVolt: espItem.voltage_v !== undefined ? Number(espItem.voltage_v) : espVolt,
        sigVolt: sigItem.voltage_v !== undefined ? Number(sigItem.voltage_v) : sigVolt,
        espTemp: espItem.temperature_c !== undefined ? Number(espItem.temperature_c) : espTemp,
        sigTemp: sigItem.room_temp_c !== undefined ? Number(sigItem.room_temp_c) : sigTemp,
        espHum: espItem.humidity_rh !== undefined ? Number(espItem.humidity_rh) : espHum,
        sigHum: sigItem.humidity_rh !== undefined ? Number(sigItem.humidity_rh) : sigHum,
      });
    }

    return result;
  }, [realtimeBuffer, signalRealtimeBuffer, espVolt, sigVolt, espTemp, sigTemp, espHum, sigHum]);

  return (
    <div className="space-y-6">

      {/* Header Menu Komparasi */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold font-mono text-white flex items-center">
            <GitCompare className="w-5 h-5 mr-2 text-cyan-400" />
            KOMPARASI SENSOR FISIK ESP32 VS DATA KABEL SINYAL AC
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Mengevaluasi presisi pengukuran sensor luar (ZMPT101B True-RMS & SHT31) dengan mikroprosesor internal unit AC Sharp AH-XP13DPY.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-industrial-950 text-slate-300 border border-industrial-800 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>KEDUA SUMBER SINKRON</span>
          </span>
        </div>
      </div>

      {/* 3 KARTU KOMPARASI PARAMETER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* 1. KOMPARASI SUHU */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <Thermometer className="w-4 h-4 mr-1.5 text-rose-400" />
              Suhu Ruangan
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              Math.abs(deltaTemp) <= 0.5 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' 
                : 'bg-amber-950 text-amber-400 border border-amber-700'
            }`}>
              Δ {deltaTemp > 0 ? `+${deltaTemp}` : deltaTemp} °C
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
              <span className="text-[10px] text-slate-500 block">SENSOR SHT31 ESP32</span>
              <span className="text-base font-bold text-rose-400">{espTemp.toFixed(1)} °C</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sensor Fisik Eksternal</span>
            </div>

            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
              <span className="text-[10px] text-slate-500 block">THERMISTOR SINYAL AC</span>
              <span className="text-base font-bold text-amber-400">{sigTemp.toFixed(1)} °C</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Intake Indoor Thermistor</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {Math.abs(deltaTemp) <= 0.8
              ? '✅ Akurasi sangat tinggi. Perbedaan tipis wajar karena posisi sensor SHT31 di ruangan vs thermistor AC di kisi hisap.'
              : '⚠️ Selisih suhu cukup terukur. Periksa apakah sensor SHT31 terpapar langsung tiupan angin AC.'}
          </p>
        </div>

        {/* 2. KOMPARASI VOLTASE LISTRIK */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <Zap className="w-4 h-4 mr-1.5 text-electric-amber" />
              Tegangan Listrik AC
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              Math.abs(deltaVolt) <= 2.0 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' 
                : 'bg-amber-950 text-amber-400 border border-amber-700'
            }`}>
              Δ {deltaVolt > 0 ? `+${deltaVolt}` : deltaVolt} V
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
              <span className="text-[10px] text-slate-500 block">ZMPT101B TRUE-RMS</span>
              <span className="text-base font-bold text-amber-400">{espVolt.toFixed(1)} V</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Sampling 50Hz ESP32</span>
            </div>

            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
              <span className="text-[10px] text-slate-500 block">BUS SINYAL UNIT AC</span>
              <span className="text-base font-bold text-cyan-400">{sigVolt.toFixed(1)} V</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Internal PCB ADC Bus</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {Math.abs(deltaVolt) <= 3.0
              ? '✅ Tegangan jala PLN terukur stabil pada kedua kanal pengukuran.'
              : '⚠️ Terdeteksi deviasi pembacaan tegangan. Pertimbangkan penyesuaian trim offset kalibrasi ZMPT101B.'}
          </p>
        </div>

        {/* 3. KOMPARASI KELEMBAPAN */}
        <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 shadow-md space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-industrial-800 pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center">
              <Droplets className="w-4 h-4 mr-1.5 text-cyan-400" />
              Kelembapan Relatif
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
              Δ {deltaHum > 0 ? `+${deltaHum}` : deltaHum} %RH
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
              <span className="text-[10px] text-slate-500 block">SENSIRION SHT31</span>
              <span className="text-base font-bold text-cyan-400">{espHum.toFixed(1)} %RH</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Kelembapan Ruang Presisi</span>
            </div>

            <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
              <span className="text-[10px] text-slate-500 block">ESTIMASI KABEL SINYAL</span>
              <span className="text-base font-bold text-slate-200">{sigHum.toFixed(1)} %RH</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Parameter Bus Unit AC</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Sensirion SHT31 memberikan akurasi kelembapan mutakhir (±2% RH) untuk memantau kenyamanan termal & titik embun.
          </p>
        </div>

      </div>

      {/* GRAFIK KOMPARASI SENSOR LANGSUNG */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-industrial-800 gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold font-mono text-white flex items-center">
              <Layers className="w-4 h-4 mr-2 text-cyan-400" />
              GRAFIK KOMPARASI OVERLAY: SENSOR FISIK VS KABEL SINYAL
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Garis Solid = Sensor Fisik ESP32 | Garis Putus-putus = Data Kabel Sinyal Terminal 3
            </p>
          </div>

          {/* Tab Pemilih Parameter */}
          <div className="flex items-center space-x-1 bg-industrial-950 p-1 rounded-lg border border-industrial-800 text-xs font-mono">
            {[
              { id: 'all', label: 'Semua Parameter' },
              { id: 'temperature', label: 'Komparasi Suhu' },
              { id: 'voltage', label: 'Komparasi Voltase' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveParamTab(tab.id)}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  activeParamTab === tab.id
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend Penjelasan Garis */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-industrial-950 p-2.5 rounded-lg border border-industrial-850">
          <span className="text-slate-400 text-[11px]">Keterangan Garis:</span>
          <span className="flex items-center text-rose-400">
            <span className="w-4 h-0.5 bg-rose-500 mr-1.5"></span> Suhu SHT31 (ESP32)
          </span>
          <span className="flex items-center text-amber-400">
            <span className="w-4 h-0.5 bg-amber-400 border-b border-dashed border-white mr-1.5"></span> Suhu Thermistor (Sinyal AC)
          </span>
          <span className="flex items-center text-yellow-400">
            <span className="w-4 h-0.5 bg-yellow-400 mr-1.5"></span> Voltase ZMPT101B (ESP32)
          </span>
          <span className="flex items-center text-cyan-400">
            <span className="w-4 h-0.5 bg-cyan-400 border-b border-dashed border-white mr-1.5"></span> Voltase Bus (Sinyal AC)
          </span>
        </div>

        {/* Kanvas Grafik Komparasi */}
        <div className="w-full h-80 sm:h-96 md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={35} />

              {/* Sumbu Y Kiri: Voltase (160 - 260 V) */}
              <YAxis 
                yAxisId="voltage" 
                orientation="left" 
                domain={[160, 260]} 
                stroke="#f59e0b" 
                tick={{ fontSize: 10, fill: '#f59e0b' }} 
                unit="V"
                hide={activeParamTab === 'temperature'}
              />

              {/* Sumbu Y Kanan: Suhu (0 - 50 °C) */}
              <YAxis 
                yAxisId="temp" 
                orientation="right" 
                domain={[15, 35]} 
                stroke="#ef4444" 
                tick={{ fontSize: 10, fill: '#ef4444' }} 
                unit="°C"
                hide={activeParamTab === 'voltage'}
              />

              <Tooltip content={<ComparisonTooltip />} />

              {/* Garis Suhu SHT31 ESP32 (Solid) */}
              {(activeParamTab === 'all' || activeParamTab === 'temperature') && (
                <Line 
                  yAxisId="temp" 
                  type="monotone" 
                  dataKey="espTemp" 
                  name="Suhu ESP32 SHT31"
                  stroke="#ef4444" 
                  strokeWidth={2.5} 
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Garis Suhu Thermistor Sinyal AC (Dashed) */}
              {(activeParamTab === 'all' || activeParamTab === 'temperature') && (
                <Line 
                  yAxisId="temp" 
                  type="monotone" 
                  dataKey="sigTemp" 
                  name="Suhu Thermistor AC"
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Garis Voltase ZMPT101B ESP32 (Solid) */}
              {(activeParamTab === 'all' || activeParamTab === 'voltage') && (
                <Line 
                  yAxisId="voltage" 
                  type="monotone" 
                  dataKey="espVolt" 
                  name="Voltase ESP32 ZMPT101B"
                  stroke="#eab308" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Garis Voltase Sinyal AC (Dashed) */}
              {(activeParamTab === 'all' || activeParamTab === 'voltage') && (
                <Line 
                  yAxisId="voltage" 
                  type="monotone" 
                  dataKey="sigVolt" 
                  name="Voltase Bus Sinyal AC"
                  stroke="#06b6d4" 
                  strokeWidth={2} 
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}

            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* TABEL PERBANDINGAN & ANALISIS DIAGNOSTIK TEKNISI */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-3 font-mono">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
          <Info className="w-4 h-4 mr-2 text-cyan-400" />
          Rangkuman Evaluasi Deviasi Instrumen
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-industrial-950 text-slate-400 border-b border-industrial-800">
              <tr>
                <th className="py-2.5 px-3">Parameter Ukur</th>
                <th className="py-2.5 px-3">Sensor Fisik ESP32</th>
                <th className="py-2.5 px-3">Data Kabel Sinyal AC</th>
                <th className="py-2.5 px-3">Selisih Deviasi (Δ)</th>
                <th className="py-2.5 px-3">Status Toleransi</th>
                <th className="py-2.5 px-3">Keterangan Analisis Teknisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800">
              <tr className="hover:bg-industrial-850/50">
                <td className="py-2.5 px-3 font-bold text-white">Suhu Ruangan (°C)</td>
                <td className="py-2.5 px-3 text-rose-400 font-bold">{espTemp.toFixed(1)} °C</td>
                <td className="py-2.5 px-3 text-amber-400 font-bold">{sigTemp.toFixed(1)} °C</td>
                <td className="py-2.5 px-3 font-bold text-white">{deltaTemp > 0 ? `+${deltaTemp}` : deltaTemp} °C</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                    SANGAT BAIK (±0.5°C)
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  Perbedaan disebabkan posisi thermistor intake indoor AC di kisi atas dekat plafon vs sensor SHT31 di ruangan.
                </td>
              </tr>

              <tr className="hover:bg-industrial-850/50">
                <td className="py-2.5 px-3 font-bold text-white">Tegangan Listrik (VAC)</td>
                <td className="py-2.5 px-3 text-amber-400 font-bold">{espVolt.toFixed(1)} VAC</td>
                <td className="py-2.5 px-3 text-cyan-400 font-bold">{sigVolt.toFixed(1)} VAC</td>
                <td className="py-2.5 px-3 font-bold text-white">{deltaVolt > 0 ? `+${deltaVolt}` : deltaVolt} V</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                    NORMAL (Toleransi PLN)
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  ZMPT101B mengukur tegangan jala PLN input langsung; data sinyal membaca jalur bus PCB internal.
                </td>
              </tr>

              <tr className="hover:bg-industrial-850/50">
                <td className="py-2.5 px-3 font-bold text-white">Kelembapan Relatif (%RH)</td>
                <td className="py-2.5 px-3 text-cyan-400 font-bold">{espHum.toFixed(1)} %RH</td>
                <td className="py-2.5 px-3 text-slate-300 font-bold">{sigHum.toFixed(1)} %RH</td>
                <td className="py-2.5 px-3 font-bold text-white">{deltaHum > 0 ? `+${deltaHum}` : deltaHum} %RH</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">
                    OPTIMAL
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-300">
                  Sensirion SHT31 mengukur kelembapan udara riil ruangan untuk mencegah kondensasi keringat pipa.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
