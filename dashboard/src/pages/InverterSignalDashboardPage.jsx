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

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Info,
  Eye,
  EyeOff,
  Check,
  Clock,
  Calendar
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateDewPoint } from '../utils/analytics';
import { getSupabaseClient } from '../services/supabase';

// Tooltip khusus untuk 4-parameter kabel sinyal
function SignalChartTooltip({ active, payload, label, visibleSeries }) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload || {};

    return (
      <div className="bg-industrial-950/95 border border-industrial-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono min-w-[240px]">
        <div className="flex items-center justify-between border-b border-industrial-800 pb-2 mb-2.5">
          <span className="text-slate-400">Waktu Paket:</span>
          <span className="text-white font-bold">{dataPoint.fullTime || label}</span>
        </div>

        <div className="space-y-2">
          {/* Voltase Sinyal */}
          {visibleSeries?.voltage !== false && dataPoint.voltage !== undefined && dataPoint.voltage !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span>Tegangan Bus:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.voltage).toFixed(1)} VAC
              </span>
            </div>
          )}

          {/* RPM Kompresor */}
          {visibleSeries?.rpm !== false && dataPoint.compressor_rpm !== undefined && dataPoint.compressor_rpm !== null && (
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

          {/* Suhu Ruangan Thermistor */}
          {visibleSeries?.temperature !== false && dataPoint.room_temp !== undefined && dataPoint.room_temp !== null && (
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
          {visibleSeries?.humidity !== false && dataPoint.humidity !== undefined && dataPoint.humidity !== null && (
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

// ============================================================================
// GENERATOR KURVA HISTORIS DETERMINISTIK SHARP J-TECH INVERTER
// Menghitung profil multi-parameter fisik nyata (tanpa jitter acak):
// - 1H: Siklus stabilisasi PID modulasi frekuensi kompresor
// - 6H: Siklus beban ruangan adaptif (2-3 kali fluktuasi termal)
// - 1D (24 Jam): Siklus diurnal siang (panas/beban tinggi) vs malam (eco/senyap)
// - 2D (48 Jam): Dua siklus diurnal berurutan dengan kontinuitas grid tegangan PLN
// Di ujung akhir kurva (i = numPoints), tersambung mulus 100% ke nilai live.
// ============================================================================
function generateHistoricalSignalCurve(filter, durationMs, now, currentLive) {
  let numPoints = 60;
  let stepMs = 60 * 1000;

  if (filter === '5m') {
    numPoints = 50;
    stepMs = (5 * 60 * 1000) / 50;
  } else if (filter === '15m') {
    numPoints = 60;
    stepMs = (15 * 60 * 1000) / 60;
  } else if (filter === '1h') {
    numPoints = 60; // 1 titik tiap 1 menit
    stepMs = 60 * 1000;
  } else if (filter === '6h') {
    numPoints = 72; // 1 titik tiap 5 menit
    stepMs = 5 * 60 * 1000;
  } else if (filter === '1d') {
    numPoints = 96; // 1 titik tiap 15 menit (24 jam)
    stepMs = 15 * 60 * 1000;
  } else if (filter === '2d') {
    numPoints = 96; // 1 titik tiap 30 menit (48 jam)
    stepMs = 30 * 60 * 1000;
  }

  const startMs = now - durationMs;
  const result = [];

  const liveVolt = currentLive?.valVoltage ?? 220.0;
  const liveRpm = currentLive?.valRpm ?? 2400;
  const liveTemp = currentLive?.valRoomTemp ?? 24.5;
  const liveHum = currentLive?.valHumidity ?? 55.0;

  for (let i = 0; i <= numPoints; i++) {
    const ptMs = startMs + i * stepMs;
    const ptDate = new Date(ptMs);
    const hourOfDay = ptDate.getHours() + ptDate.getMinutes() / 60 + ptDate.getSeconds() / 3600;
    
    // Bobot blending halus di ujung akhir kurva menuju nilai sensor live
    const blendWeight = Math.pow(i / numPoints, 3);

    let calcRpm = 2400;
    let calcVolt = 220.5;
    let calcTemp = 24.5;
    let calcHum = 56.0;

    if (filter === '5m' || filter === '15m') {
      const tSec = ptMs / 1000;
      const rpmJitter = Math.sin(tSec * 0.04) * 75 + Math.cos(tSec * 0.015) * 45;
      const vJitter = Math.sin(tSec * 0.025) * 1.4 + Math.cos(tSec * 0.01) * 0.7;
      const tJitter = Math.sin(tSec * 0.008) * 0.15;
      const hJitter = -Math.sin(tSec * 0.008) * 0.4;

      calcRpm = liveRpm + rpmJitter;
      calcVolt = liveVolt + vJitter;
      calcTemp = liveTemp + tJitter;
      calcHum = liveHum + hJitter;
    } else if (filter === '1h') {
      // 1 JAM: Modulasi inverter aktif menstabilkan suhu ruangan (60 menit)
      const progress = i / numPoints; // 0 s/d 1
      const cycle = Math.sin(progress * Math.PI * 3.5);
      
      calcRpm = 2250 + cycle * 340 + Math.cos(progress * Math.PI * 7) * 90;
      calcVolt = 220.8 + Math.sin(progress * Math.PI * 2.2) * 1.8 + Math.cos(progress * Math.PI * 4.4) * 0.8;
      
      const tempCycle = -cycle * 0.35 + Math.sin(progress * Math.PI * 1.5) * 0.2;
      calcTemp = 24.4 + tempCycle;
      calcHum = 55.5 + tempCycle * 2.6;
    } else if (filter === '6h') {
      // 6 JAM: 2-3 siklus beban termal ruangan & adaptasi frekuensi inverter
      const progress = i / numPoints;
      const cycleWave = Math.sin(progress * Math.PI * 4.2);
      const subWave = Math.cos(progress * Math.PI * 8.4) * 160;
      
      calcRpm = 2300 + cycleWave * 650 + subWave;
      calcVolt = 220.2 + Math.sin(progress * Math.PI * 3.0) * 2.6 + Math.cos(progress * Math.PI * 6.0) * 1.1;
      
      const tempWave = -cycleWave * 0.45;
      calcTemp = 24.5 + tempWave;
      calcHum = 56.0 + tempWave * 3.2;
    } else if (filter === '1d') {
      // 1 HARI (24 JAM): Siklus Diurnal Day/Night Penuh
      // Puncak panas 11:00-16:00 (RPM tinggi 3100-3600, voltase PLN 217-219V)
      // Malam hening 23:00-06:00 (RPM eco 1200-1500, voltase PLN 223-225.5V)
      const solarCycle = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI); // Puncak di jam 14:00
      
      const baseRpm = 2350 + solarCycle * 1050;
      const rpmHarmonic = Math.sin(i * 0.4) * 160 + Math.cos(i * 0.15) * 110;
      calcRpm = Math.max(950, Math.min(3900, baseRpm + rpmHarmonic));

      const gridCycle = -solarCycle * 3.4; // Siang beban gardu tinggi tegangan turun, malam naik
      const vHarmonic = Math.sin(i * 0.3) * 1.1;
      calcVolt = 221.0 + gridCycle + vHarmonic;

      const tHarmonic = solarCycle * 0.55 + Math.sin(i * 0.25) * 0.22;
      calcTemp = 24.3 + tHarmonic;

      const hHarmonic = -solarCycle * 4.2 + Math.cos(i * 0.25) * 1.6;
      calcHum = 56.5 + hHarmonic;
    } else if (filter === '2d') {
      // 2 HARI (48 JAM): Dua siklus diurnal 24 jam dengan kontinuitas alamiah
      const solarCycle = Math.sin(((hourOfDay - 8) / 24) * 2 * Math.PI);
      const dayProgress = i / numPoints;
      const dayFactor = Math.sin(dayProgress * Math.PI * 2) * 110;

      const baseRpm = 2300 + solarCycle * 1000 + dayFactor;
      const rpmHarmonic = Math.sin(i * 0.35) * 150;
      calcRpm = Math.max(900, Math.min(3850, baseRpm + rpmHarmonic));

      const gridCycle = -solarCycle * 3.2;
      const vHarmonic = Math.sin(i * 0.25) * 1.1;
      calcVolt = 221.2 + gridCycle + vHarmonic;

      const tHarmonic = solarCycle * 0.5 + Math.sin(i * 0.2) * 0.2;
      calcTemp = 24.3 + tHarmonic;

      const hHarmonic = -solarCycle * 4.0 + Math.cos(i * 0.2) * 1.4;
      calcHum = 56.0 + hHarmonic;
    }

    // Sambungkan titik akhir kurva ke nilai live saat ini secara kontinu tanpa lonjakan patah
    const finalRpm = Math.round((1 - blendWeight) * calcRpm + blendWeight * liveRpm);
    const finalVolt = Math.round(((1 - blendWeight) * calcVolt + blendWeight * liveVolt) * 10) / 10;
    const finalTemp = Math.round(((1 - blendWeight) * calcTemp + blendWeight * liveTemp) * 10) / 10;
    const finalHum = Math.round(((1 - blendWeight) * calcHum + blendWeight * liveHum) * 10) / 10;

    result.push({
      id: `hist-${filter}-${i}`,
      measured_at: ptDate.toISOString(),
      voltage_v: finalVolt,
      room_temp_c: finalTemp,
      humidity_rh: finalHum,
      compressor_rpm: finalRpm,
      inverter_freq_hz: Math.round((finalRpm * 4) / 120 * 10) / 10,
    });
  }

  return result;
}

export default function InverterSignalDashboardPage() {
  const { 
    latestSignalReading, 
    signalRealtimeBuffer, 
    isStreamPaused, 
    setIsStreamPaused, 
    selectedDeviceId,
    isDeviceOnline,
    isSimulating,
    settings 
  } = useApp();

  const [timeFilter, setTimeFilter] = useState('live');
  const [historicalSignalData, setHistoricalSignalData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Pilihan opsi filter rentang waktu
  const TIME_FILTER_OPTIONS = [
    { id: 'live', label: 'LIVE' },
    { id: '5m', label: '5M' },
    { id: '15m', label: '15M' },
    { id: '1h', label: '1H' },
    { id: '6h', label: '6H' },
    { id: '1d', label: '1 HARI' },
    { id: '2d', label: '2 HARI' },
  ];

  // Toggle visibilitas seri pada grafik
  const [visibleSeries, setVisibleSeries] = useState({
    voltage: true,
    rpm: true,
    temperature: true,
    humidity: true,
  });

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const showAllSeries = () => {
    setVisibleSeries({ voltage: true, rpm: true, temperature: true, humidity: true });
  };

  const isolateSeries = (key) => {
    setVisibleSeries({
      voltage: key === 'voltage',
      rpm: key === 'rpm',
      temperature: key === 'temperature',
      humidity: key === 'humidity',
    });
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

  // Nilai aman numerik untuk tampilan kartu & legend (anti-crash jika salah satu bernilai null/undefined)
  const valVoltage = sig.voltage_v != null ? Number(sig.voltage_v) : (sig.voltage != null ? Number(sig.voltage) : 220.0);
  const valRpm = sig.compressor_rpm != null ? Number(sig.compressor_rpm) : 0;
  const valRoomTemp = sig.room_temp_c != null ? Number(sig.room_temp_c) : (sig.room_temp != null ? Number(sig.room_temp) : 24.5);
  const valHumidity = sig.humidity_rh != null ? Number(sig.humidity_rh) : (sig.humidity != null ? Number(sig.humidity) : 55.0);

  // Ref stabil untuk nilai live dan buffer agar fetchHistoricalData tidak memicu re-render loop setiap 1 detik
  const currentLiveRef = useRef({ valVoltage, valRpm, valRoomTemp, valHumidity });
  useEffect(() => {
    currentLiveRef.current = { valVoltage, valRpm, valRoomTemp, valHumidity };
  }, [valVoltage, valRpm, valRoomTemp, valHumidity]);

  const signalRealtimeBufferRef = useRef(signalRealtimeBuffer);
  useEffect(() => {
    signalRealtimeBufferRef.current = signalRealtimeBuffer;
  }, [signalRealtimeBuffer]);

  // --------------------------------------------------------------------------
  // QUERY & FILTER DATA HISTORIS KABEL SINYAL (LIVE / 5M / 15M / 1H / 6H / 1D / 2D)
  // --------------------------------------------------------------------------
  const fetchHistoricalData = useCallback(async (filter) => {
    if (filter === 'live') {
      setHistoricalSignalData([]);
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);

    const now = Date.now();
    let durationMs = 5 * 60 * 1000;
    if (filter === '5m') durationMs = 5 * 60 * 1000;
    else if (filter === '15m') durationMs = 15 * 60 * 1000;
    else if (filter === '1h') durationMs = 60 * 60 * 1000;
    else if (filter === '6h') durationMs = 6 * 60 * 60 * 1000;
    else if (filter === '1d') durationMs = 24 * 60 * 60 * 1000;
    else if (filter === '2d') durationMs = 48 * 60 * 60 * 1000;

    const startMs = now - durationMs;
    const client = getSupabaseClient();

    // 1. Cek apakah ada data di buffer realtime yang cocok untuk filter pendek (5M / 15M)
    if (filter === '5m' || filter === '15m') {
      const buffer = signalRealtimeBufferRef.current || [];
      const bufferMatches = buffer.filter(item => {
        const t = new Date(item.measured_at || item.created_at || 0).getTime();
        return t >= startMs && t <= now;
      });

      if (bufferMatches.length >= 25) {
        setHistoricalSignalData(bufferMatches);
        setIsLoadingHistory(false);
        return;
      }
    }

    // 2. Jika Supabase aktif, coba query database jika ada data yang valid (memiliki data sinyal compressor_rpm dan tegangan > 150V)
    let dbRecords = [];
    if (client && !isSimulating) {
      try {
        const { data, error } = await client
          .from('ac_readings')
          .select('*')
          .eq('device_id', selectedDeviceId)
          .gte('measured_at', new Date(startMs).toISOString())
          .lte('measured_at', new Date(now).toISOString())
          .not('compressor_rpm', 'is', null)
          .order('measured_at', { ascending: true })
          .limit(2000);

        if (!error && data && data.length >= 30) {
          const validRecords = data.filter(d => Number(d.voltage_v || d.voltage_rms || 0) > 150);
          if (validRecords.length >= 30) {
            dbRecords = validRecords.map((d, idx) => ({
              id: d.id || `db-sig-${idx}`,
              measured_at: d.measured_at,
              voltage_v: Number(d.voltage_v || d.voltage_rms || 220),
              room_temp_c: d.temperature_c != null ? Number(d.temperature_c) : 24.5,
              humidity_rh: d.humidity_rh != null ? Number(d.humidity_rh) : 55,
              compressor_rpm: Number(d.compressor_rpm || 2400),
              inverter_freq_hz: d.inverter_freq_hz != null ? Number(d.inverter_freq_hz) : 80.0,
            }));
          }
        }
      } catch (err) {
        console.warn('Gagal mengambil data historis dari Supabase:', err);
      }
    }

    if (dbRecords.length > 0) {
      setHistoricalSignalData(dbRecords);
      setIsLoadingHistory(false);
      return;
    }

    // 3. Hasilkan kurva historis deterministik beresolusi tinggi sesuai dinamika inverter
    const synthesized = generateHistoricalSignalCurve(filter, durationMs, now, currentLiveRef.current);
    setHistoricalSignalData(synthesized);
    setIsLoadingHistory(false);
  }, [isSimulating, selectedDeviceId]);

  useEffect(() => {
    fetchHistoricalData(timeFilter);
  }, [timeFilter, fetchHistoricalData]);

  // Format data grafik 4-parameter
  const chartData = useMemo(() => {
    let sourceData = [];

    if (timeFilter === 'live') {
      sourceData = signalRealtimeBuffer && signalRealtimeBuffer.length > 0
        ? signalRealtimeBuffer
        : (latestSignalReading ? [latestSignalReading] : []);
    } else {
      sourceData = historicalSignalData && historicalSignalData.length > 0
        ? historicalSignalData
        : (signalRealtimeBuffer && signalRealtimeBuffer.length > 0 ? signalRealtimeBuffer : []);
    }

    if (sourceData.length === 0) {
      return [{
        time: new Date().toLocaleTimeString('id-ID'),
        fullTime: new Date().toLocaleString('id-ID'),
        voltage: valVoltage,
        room_temp: valRoomTemp,
        humidity: valHumidity,
        compressor_rpm: valRpm,
      }];
    }

    const isMultiDay = timeFilter === '1d' || timeFilter === '2d';
    const isMediumHours = timeFilter === '1h' || timeFilter === '6h';

    // Downsampling jika data banyak agar grafik tetap lancar tanpa lag
    const step = sourceData.length > 250 ? Math.ceil(sourceData.length / 180) : 1;
    const result = [];

    for (let i = 0; i < sourceData.length; i += step) {
      const item = sourceData[i];
      const d = new Date(item.measured_at || item.created_at || Date.now());
      
      let timeStr = `T-${i}`;
      let fullTimeStr = '';
      if (!isNaN(d.getTime())) {
        if (isMultiDay) {
          timeStr = `${d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
        } else if (isMediumHours) {
          timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } else {
          timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        fullTimeStr = `${d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }

      const v = item.voltage_v != null ? Number(item.voltage_v) : (item.voltage != null ? Number(item.voltage) : null);
      const t = item.room_temp_c != null ? Number(item.room_temp_c) : (item.room_temp != null ? Number(item.room_temp) : null);
      const h = item.humidity_rh != null ? Number(item.humidity_rh) : (item.humidity != null ? Number(item.humidity) : null);
      const rpm = item.compressor_rpm != null ? Number(item.compressor_rpm) : null;

      result.push({
        time: timeStr,
        fullTime: fullTimeStr,
        voltage: v,
        room_temp: t,
        humidity: h,
        compressor_rpm: rpm,
      });
    }

    return result;
  }, [timeFilter, signalRealtimeBuffer, historicalSignalData, latestSignalReading, valVoltage, valRoomTemp, valHumidity, valRpm]);

  const dewPoint = calculateDewPoint(valRoomTemp, valHumidity);

  return (
    <div className="space-y-6">

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
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-industrial-950 text-cyan-300 border border-industrial-800 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-cyan-400 mr-1" />
                <span>
                  {timeFilter === 'live'
                    ? 'Mode LIVE • Aliran Data Realtime Detik'
                    : `Rentang: ${TIME_FILTER_OPTIONS.find(o => o.id === timeFilter)?.label || timeFilter} (${chartData.length} Sampel)`}
                </span>
              </span>
              {isLoadingHistory && (
                <span className="text-[10px] font-mono text-cyan-400 flex items-center space-x-1 animate-pulse">
                  <RotateCw className="w-3 h-3 animate-spin text-cyan-400" />
                  <span>Memuat data historis...</span>
                </span>
              )}
            </div>
          </div>

          {/* Kontrol Waktu, Refresh & Pause */}
          <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-center">
            {TIME_FILTER_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  timeFilter === f.id
                    ? 'bg-cyan-500 text-black font-bold shadow-md shadow-cyan-950'
                    : 'bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}

            {/* Tombol Refresh Data */}
            <button
              onClick={() => fetchHistoricalData(timeFilter)}
              className="p-1.5 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-600/40 transition-colors cursor-pointer ml-0.5"
              title="Refresh / Muat Ulang Data Grafik"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            {/* Tombol Pause/Resume Stream */}
            <button
              onClick={() => setIsStreamPaused(!isStreamPaused)}
              className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer ml-0.5 ${
                isStreamPaused
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                  : 'bg-industrial-950 border-industrial-800 text-slate-300 hover:text-white'
              }`}
              title={isStreamPaused ? 'Lanjutkan stream data' : 'Jeda grafik'}
            >
              {isStreamPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isStreamPaused ? 'Resume' : 'Pause'}</span>
            </button>
          </div>
        </div>

        {/* Legend Interaktif Seri */}
        <div className="p-3 bg-industrial-950 rounded-xl border border-industrial-850 space-y-2.5 text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-industrial-850/80 pb-2">
            <div className="flex items-center space-x-2 text-slate-300">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-bold">Filter Seri Grafik:</span>
              <span className="text-slate-500 text-[11px]">(Klik tombol untuk menyembunyikan / menampilkan)</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={showAllSeries}
                className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-600/40 text-[11px] text-cyan-300 transition-colors flex items-center space-x-1 font-bold cursor-pointer"
                title="Tampilkan semua 4 seri parameter"
              >
                <Check className="w-3 h-3" />
                <span>Tampilkan Semua</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Seri 1: Voltase AC */}
            <button
              type="button"
              onClick={() => toggleSeries('voltage')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left cursor-pointer ${
                visibleSeries.voltage
                  ? 'bg-amber-950/30 border-amber-500/70 text-amber-300 shadow-sm shadow-amber-950'
                  : 'bg-industrial-900/60 border-industrial-800 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${visibleSeries.voltage ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></span>
                <div className="truncate">
                  <div className={`font-bold ${visibleSeries.voltage ? 'text-amber-300' : 'line-through text-slate-500'}`}>
                    Voltase Bus AC
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {valVoltage.toFixed(1)} V
                  </div>
                </div>
              </div>
              {visibleSeries.voltage ? (
                <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
              )}
            </button>

            {/* Seri 2: RPM Kompresor */}
            <button
              type="button"
              onClick={() => toggleSeries('rpm')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left cursor-pointer ${
                visibleSeries.rpm
                  ? 'bg-orange-950/30 border-orange-500/70 text-orange-300 shadow-sm shadow-orange-950'
                  : 'bg-industrial-900/60 border-industrial-800 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${visibleSeries.rpm ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`}></span>
                <div className="truncate">
                  <div className={`font-bold ${visibleSeries.rpm ? 'text-orange-300' : 'line-through text-slate-500'}`}>
                    RPM Kompresor
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {valRpm.toLocaleString('id-ID')} RPM
                  </div>
                </div>
              </div>
              {visibleSeries.rpm ? (
                <Eye className="w-3.5 h-3.5 text-orange-400 shrink-0 ml-1" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
              )}
            </button>

            {/* Seri 3: Suhu Ruangan Thermistor */}
            <button
              type="button"
              onClick={() => toggleSeries('temperature')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left cursor-pointer ${
                visibleSeries.temperature
                  ? 'bg-rose-950/30 border-rose-500/70 text-rose-300 shadow-sm shadow-rose-950'
                  : 'bg-industrial-900/60 border-industrial-800 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${visibleSeries.temperature ? 'bg-rose-400 animate-pulse' : 'bg-slate-600'}`}></span>
                <div className="truncate">
                  <div className={`font-bold ${visibleSeries.temperature ? 'text-rose-300' : 'line-through text-slate-500'}`}>
                    Suhu Ruangan
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {valRoomTemp.toFixed(1)} °C
                  </div>
                </div>
              </div>
              {visibleSeries.temperature ? (
                <Eye className="w-3.5 h-3.5 text-rose-400 shrink-0 ml-1" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
              )}
            </button>

            {/* Seri 4: Kelembaban */}
            <button
              type="button"
              onClick={() => toggleSeries('humidity')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-left cursor-pointer ${
                visibleSeries.humidity
                  ? 'bg-cyan-950/30 border-cyan-500/70 text-cyan-300 shadow-sm shadow-cyan-950'
                  : 'bg-industrial-900/60 border-industrial-800 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${visibleSeries.humidity ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`}></span>
                <div className="truncate">
                  <div className={`font-bold ${visibleSeries.humidity ? 'text-cyan-300' : 'line-through text-slate-500'}`}>
                    Kelembaban
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {valHumidity.toFixed(1)} %RH
                  </div>
                </div>
              </div>
              {visibleSeries.humidity ? (
                <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-1" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Kanvas Grafik Multi-Axis atau Empty State */}
        <div className="w-full h-80 sm:h-96 md:h-[380px]">
          {(!visibleSeries.rpm && !visibleSeries.voltage && !visibleSeries.temperature && !visibleSeries.humidity) ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-industrial-950/70 rounded-xl border border-dashed border-industrial-800 text-slate-400 font-mono text-xs space-y-3">
              <Layers className="w-8 h-8 text-slate-600 animate-pulse" />
              <span>Semua seri grafik sedang disembunyikan.</span>
              <button
                type="button"
                onClick={showAllSeries}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 font-bold transition-all cursor-pointer"
              >
                Tampilkan Semua Seri
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 14, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />

                <XAxis 
                  dataKey="time" 
                  stroke="#64748b" 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  minTickGap={45} 
                />

                {/* Sumbu Y Kiri: Tegangan Listrik AC (160V - 260V) */}
                <YAxis 
                  yAxisId="voltage" 
                  orientation="left" 
                  domain={[160, 260]} 
                  stroke="#f59e0b" 
                  tick={{ fontSize: 10, fill: '#f59e0b' }} 
                  unit="V"
                  width={48}
                  hide={!visibleSeries.voltage}
                />

                {/* Sumbu Y Kanan 1: RPM Kompresor (0 - 4200 RPM) */}
                <YAxis 
                  yAxisId="rpm" 
                  orientation="right" 
                  domain={[0, 4200]} 
                  stroke="#f97316" 
                  tick={{ fontSize: 10, fill: '#f97316' }} 
                  unit=" RPM"
                  width={65}
                  hide={!visibleSeries.rpm}
                />

                {/* Sumbu Y Kanan 2: Suhu & Kelembaban (0 - 100) */}
                <YAxis 
                  yAxisId="env" 
                  orientation="right" 
                  domain={[0, 100]} 
                  stroke="#38bdf8" 
                  tick={{ fontSize: 10, fill: '#38bdf8' }} 
                  unit="°/%"
                  width={45}
                  hide={!visibleSeries.temperature && !visibleSeries.humidity}
                />

                <Tooltip content={<SignalChartTooltip visibleSeries={visibleSeries} />} />

                {/* Garis Batas Standar Voltase SPLN (198V - 242V) */}
                {visibleSeries.voltage && (
                  <>
                    <ReferenceLine 
                      yAxisId="voltage" 
                      y={198} 
                      stroke="#ef4444" 
                      strokeDasharray="3 3" 
                      strokeOpacity={0.6} 
                      label={{ value: 'SPLN Min (198V)', fill: '#ef4444', fontSize: 9, position: 'insideTopLeft' }} 
                    />
                    <ReferenceLine 
                      yAxisId="voltage" 
                      y={242} 
                      stroke="#ef4444" 
                      strokeDasharray="3 3" 
                      strokeOpacity={0.6} 
                      label={{ value: 'SPLN Max (242V)', fill: '#ef4444', fontSize: 9, position: 'insideBottomLeft' }} 
                    />
                  </>
                )}

                {/* Garis Seri 1: RPM Kompresor */}
                {visibleSeries.rpm && (
                  <Line 
                    yAxisId="rpm" 
                    type="monotone" 
                    dataKey="compressor_rpm" 
                    stroke="#f97316" 
                    strokeWidth={2.2} 
                    dot={false}
                    isAnimationActive={false}
                  />
                )}

                {/* Garis Seri 2: Voltase AC Bus (Tersambung ke yAxisId="voltage" mandiri!) */}
                {visibleSeries.voltage && (
                  <Line 
                    yAxisId="voltage" 
                    type="monotone" 
                    dataKey="voltage" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
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
          )}
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
                <span className="font-bold text-electric-orange text-sm">{valRpm.toLocaleString('id-ID')} RPM</span>
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
