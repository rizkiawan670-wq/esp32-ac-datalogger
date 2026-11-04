// ============================================================================
// REALTIME CHARTS COMPONENT — UNIFIED MONITORING CHART
// Grafik monitoring utama terpadu multi-series:
// - Compressor Estimated RPM (Sumbu Y Kanan)
// - Tegangan Listrik AC True-RMS (Sumbu Y Kiri)
// - Suhu Udara SHT31 & Kelembapan Relatif (Sumbu Y Lingkungan)
// Mendukung sinkronisasi timestamp, filter waktu terpadu (Live, 1h, 6h, 12h, 24h, 7d, Custom),
// penanda event compressor (Mulai, Akselerasi, HIGH, Deselerasi, Berhenti),
// legend interaktif untuk menampilkan/menyembunyikan seri, tooltip komprehensif,
// dan ringkasan statistik RPM langsung pada header grafik.
// ============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { 
  Activity, 
  Zap, 
  Thermometer, 
  Droplets, 
  Gauge,
  Layers, 
  Pause, 
  Play, 
  Clock, 
  RotateCw,
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  PowerOff,
  Flame,
  CheckCircle,
  AlertTriangle,
  Trash2,
  X,
  AlertOctagon,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSupabaseClient } from '../services/supabase';

// Tooltip kustom terpadu dengan styling industrial dark-mode
function UnifiedTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    // Cari data point asli dari payload
    const dataPoint = payload[0]?.payload || {};

    return (
      <div className="bg-industrial-950/95 border border-industrial-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono min-w-[240px]">
        <div className="flex items-center justify-between border-b border-industrial-800 pb-2 mb-2.5">
          <span className="text-slate-400">Waktu Pengukuran:</span>
          <span className="text-white font-bold">{label}</span>
        </div>

        <div className="space-y-2">
          {/* Compressor RPM */}
          {dataPoint.rpm !== null && dataPoint.rpm !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-electric-orange">
                <span className="w-2.5 h-2.5 rounded-full bg-electric-orange"></span>
                <span>Compressor RPM:</span>
              </span>
              <span className="font-bold text-white text-right">
                {Number(dataPoint.rpm).toLocaleString('id-ID')} RPM
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded border ${
                  dataPoint.rpmCategory === 'HIGH' 
                    ? 'border-rose-500 text-rose-300 bg-rose-950/60'
                    : dataPoint.rpmCategory === 'MEDIUM'
                    ? 'border-amber-500 text-amber-300 bg-amber-950/60'
                    : dataPoint.rpmCategory === 'LOW'
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-950/60'
                    : 'border-slate-700 text-slate-400 bg-slate-900'
                }`}>
                  {dataPoint.rpmCategory || 'OFF'}
                </span>
              </span>
            </div>
          )}

          {/* Tegangan AC RMS */}
          {dataPoint.voltage !== null && dataPoint.voltage !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-electric-amber">
                <span className="w-2.5 h-2.5 rounded-full bg-electric-amber"></span>
                <span>Tegangan RMS:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.voltage).toFixed(1)} VAC
              </span>
            </div>
          )}

          {/* Suhu Udara */}
          {dataPoint.temperature !== null && dataPoint.temperature !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Suhu Evaporator:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.temperature).toFixed(1)} °C
              </span>
            </div>
          )}

          {/* Kelembapan Relatif */}
          {dataPoint.humidity !== null && dataPoint.humidity !== undefined && (
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                <span>Kelembapan:</span>
              </span>
              <span className="font-bold text-white">
                {Number(dataPoint.humidity).toFixed(1)} %RH
              </span>
            </div>
          )}

          {/* Trend & Status Kompresor */}
          {dataPoint.rpmTrend && (
            <div className="pt-2 border-t border-industrial-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Dinamika Kecepatan:</span>
              <span className="text-slate-200 font-semibold">{dataPoint.rpmTrend}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export default function RealtimeCharts() {
  const { 
    realtimeBuffer, 
    rpmRealtimeBuffer,
    latestRpmReading,
    activeCompressorProfile,
    settings, 
    isStreamPaused, 
    setIsStreamPaused, 
    selectedDeviceId,
    isSimulating,
    resetChartBuffer,
    resetStoredData,
  } = useApp();

  // Pilihan rentang waktu tampilan: 'live' | '5m' | '15m' | '1h' | '6h' | '24h' | '2d' | 'custom'
  const [timeFilter, setTimeFilter] = useState('live');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // State Dialog Konfirmasi Reset Data
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState('buffer'); // 'buffer' | 'database'
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Data historis terpadu jika filter waktu bukan 'live'
  const [historicalAcData, setHistoricalAcData] = useState([]);
  const [historicalRpmData, setHistoricalRpmData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Legend Visibility State: Memungkinkan teknisi mengaktifkan/menonaktifkan seri grafik
  const [visibleSeries, setVisibleSeries] = useState({
    rpm: true,
    voltage: true,
    temperature: true,
    humidity: true,
  });

  // Toggle visibilitas seri
  const toggleSeries = (seriesKey) => {
    setVisibleSeries((prev) => ({
      ...prev,
      [seriesKey]: !prev[seriesKey]
    }));
  };

  // Batas Kalibrasi Kompresor Aktif
  const lowMax = activeCompressorProfile?.rpm_low_max || 1800;
  const medMax = activeCompressorProfile?.rpm_medium_max || 3200;
  const highMin = activeCompressorProfile?.rpm_high_min || 3200;

  // --------------------------------------------------------------------------
  // QUERY HISTORIS UNTUK SELURUH SERI JIKA FILTER BUKAN 'live'
  // Mengambil data terbaru dalam rentang waktu yang dipilih (Urutan Descending -> Reverse)
  // --------------------------------------------------------------------------
  const fetchHistoricalUnified = useCallback(async () => {
    if (timeFilter === 'live') {
      setHistoricalAcData([]);
      setHistoricalRpmData([]);
      return;
    }

    setLoadingHistory(true);
    const client = getSupabaseClient();

    const now = new Date();
    let startTime = null;
    let queryLimit = 1000;

    if (timeFilter === '5m') {
      startTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      queryLimit = 300;
    } else if (timeFilter === '15m') {
      startTime = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
      queryLimit = 600;
    } else if (timeFilter === '1h') {
      startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
      queryLimit = 1200;
    } else if (timeFilter === '6h') {
      startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      queryLimit = 2000;
    } else if (timeFilter === '24h') {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      queryLimit = 3000;
    } else if (timeFilter === '2d') {
      startTime = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      queryLimit = 4000;
    } else if (timeFilter === 'custom' && customStart) {
      startTime = new Date(customStart).toISOString();
      queryLimit = 4000;
    }

    const endTime = timeFilter === 'custom' && customEnd ? new Date(customEnd).toISOString() : null;

    if (!client || isSimulating) {
      if (startTime) {
        const startMs = new Date(startTime).getTime();
        const endMs = endTime ? new Date(endTime).getTime() : Date.now();
        const filteredAc = realtimeBuffer.filter((pt) => {
          const t = new Date(pt.measured_at || pt.created_at).getTime();
          return t >= startMs && t <= endMs;
        });
        const filteredRpm = rpmRealtimeBuffer.filter((pt) => {
          const t = new Date(pt.recorded_at || pt.created_at || pt.measured_at).getTime();
          return t >= startMs && t <= endMs;
        });
        setHistoricalAcData(filteredAc);
        setHistoricalRpmData(filteredRpm);
      } else {
        setHistoricalAcData(realtimeBuffer);
        setHistoricalRpmData(rpmRealtimeBuffer);
      }
      setLoadingHistory(false);
      return;
    }

    try {
      // 1. Query AC Readings — urutkan descending (ambil data paling baru sampai sekarang)
      let acQuery = client
        .from('ac_readings')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .order('measured_at', { ascending: false })
        .limit(queryLimit);

      if (startTime) acQuery = acQuery.gte('measured_at', startTime);
      if (endTime) acQuery = acQuery.lte('measured_at', endTime);

      // 2. Query Compressor RPM Measurements — urutkan descending
      let rpmQuery = client
        .from('compressor_rpm_measurements')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .order('recorded_at', { ascending: false })
        .limit(queryLimit);

      if (startTime) rpmQuery = rpmQuery.gte('recorded_at', startTime);
      if (endTime) rpmQuery = rpmQuery.lte('recorded_at', endTime);

      const [acRes, rpmRes] = await Promise.all([acQuery, rpmQuery]);

      if (acRes.data && Array.isArray(acRes.data)) {
        // Balikkan urutan menjadi kronologis (ascending) untuk dirender di grafik
        setHistoricalAcData([...acRes.data].reverse());
      } else {
        setHistoricalAcData([]);
      }

      if (rpmRes.data && Array.isArray(rpmRes.data)) {
        setHistoricalRpmData([...rpmRes.data].reverse());
      } else {
        setHistoricalRpmData([]);
      }

    } catch (err) {
      console.error('Error fetching historical telemetry:', err);
      setHistoricalAcData([]);
      setHistoricalRpmData([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [timeFilter, selectedDeviceId, customStart, customEnd, realtimeBuffer, rpmRealtimeBuffer, isSimulating]);

  // Efek refresh data ketika filter atau device berubah
  useEffect(() => {
    fetchHistoricalUnified();

    // Auto-refresh berkala untuk rentang pendek (5m / 15m) agar selalu mutakhir
    if (timeFilter === '5m' || timeFilter === '15m') {
      const pollTimer = setInterval(() => {
        fetchHistoricalUnified();
      }, 10000);
      return () => clearInterval(pollTimer);
    }
  }, [fetchHistoricalUnified, timeFilter]);

  // --------------------------------------------------------------------------
  // EKSEKUSI RESET DATA (BUFFER LOKAL ATAU DATABASE SUPABASE)
  // --------------------------------------------------------------------------
  const handleExecuteReset = async () => {
    setIsResetting(true);
    setResetFeedback(null);

    try {
      if (resetTarget === 'buffer') {
        resetChartBuffer();
        setHistoricalAcData([]);
        setHistoricalRpmData([]);
        setResetFeedback({
          type: 'success',
          message: 'Buffer grafik tampilan live berhasil dibersihkan!'
        });
        setTimeout(() => {
          setShowResetModal(false);
          setResetFeedback(null);
        }, 1200);
      } else {
        // Reset database Supabase
        const res = await resetStoredData(true);
        if (res.success) {
          setHistoricalAcData([]);
          setHistoricalRpmData([]);
          setResetFeedback({
            type: 'success',
            message: res.message || 'Riwayat database berhasil dihapus!'
          });
          setTimeout(() => {
            setShowResetModal(false);
            setResetFeedback(null);
            fetchHistoricalUnified();
          }, 1500);
        } else {
          setResetFeedback({
            type: 'error',
            message: res.error || 'Gagal menghapus riwayat dari database.'
          });
        }
      }
    } catch (err) {
      setResetFeedback({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat memproses reset data.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  // --------------------------------------------------------------------------
  // SINKRONISASI DATA BERDASARKAN TIMESTAMP (SINKRONISASI TOTAL TANPA DATA PALSU)
  // --------------------------------------------------------------------------
  const chartData = useMemo(() => {
    // Mode live memakai realtimeBuffer; mode historis memakai historicalAcData
    const rawAc = timeFilter === 'live' ? realtimeBuffer : historicalAcData;
    const rawRpm = timeFilter === 'live' ? rpmRealtimeBuffer : historicalRpmData;

    if (rawAc.length === 0 && rawRpm.length === 0) return [];

    // Map sinkronisasi berbasis detik
    const syncMap = new Map();

    // 1. Masukkan telemetri AC
    rawAc.forEach((ac) => {
      const d = new Date(ac.measured_at || ac.created_at);
      const timeSec = Math.floor(d.getTime() / 1000);
      syncMap.set(timeSec, {
        timeSec,
        dateObj: d,
        voltage: ac.voltage_v !== null && ac.voltage_v !== undefined ? Number(ac.voltage_v) : null,
        temperature: ac.temperature_c !== null && ac.temperature_c !== undefined ? Number(ac.temperature_c) : null,
        humidity: ac.humidity_rh !== null && ac.humidity_rh !== undefined ? Number(ac.humidity_rh) : null,
        rpm: null,
        rpmCategory: null,
        rpmTrend: null,
        compressorStatus: null,
      });
    });

    // 2. Masukkan dan padankan telemetri RPM
    rawRpm.forEach((rpm) => {
      const d = new Date(rpm.recorded_at || rpm.created_at || rpm.measured_at);
      const timeSec = Math.floor(d.getTime() / 1000);

      // Cari waktu persis atau window toleransi +/- 1 detik
      let target = syncMap.get(timeSec);
      if (!target) {
        if (syncMap.has(timeSec - 1)) target = syncMap.get(timeSec - 1);
        else if (syncMap.has(timeSec + 1)) target = syncMap.get(timeSec + 1);
      }

      const rpmVal = Math.round(Number(rpm.estimated_rpm !== undefined ? rpm.estimated_rpm : rpm.rpm) || 0);
      let cat = 'OFF';
      if (rpmVal >= 400) {
        if (rpmVal <= lowMax) cat = 'LOW';
        else if (rpmVal <= medMax) cat = 'MEDIUM';
        else cat = 'HIGH';
      }

      const trend = rpm.speed_trend || rpm.trend || (rpmVal === 0 ? 'STOPPED' : 'STABLE');

      if (target) {
        target.rpm = rpmVal;
        target.rpmCategory = cat;
        target.rpmTrend = trend;
        target.compressorStatus = rpm.compressor_status || (rpmVal < 400 ? 'OFF' : 'RUNNING');
      } else {
        syncMap.set(timeSec, {
          timeSec,
          dateObj: d,
          voltage: null,
          temperature: null,
          humidity: null,
          rpm: rpmVal,
          rpmCategory: cat,
          rpmTrend: trend,
          compressorStatus: rpm.compressor_status || (rpmVal < 400 ? 'OFF' : 'RUNNING'),
        });
      }
    });

    // 3. Urutkan secara kronologis
    const sorted = Array.from(syncMap.values()).sort((a, b) => a.timeSec - b.timeSec);

    // 4. Downsampling adaptif agar pergerakan grafik tetap 60 FPS
    const step = sorted.length > 500 ? Math.ceil(sorted.length / 350) : 1;
    const finalResult = [];

    const isMultiDay = timeFilter === '24h' || timeFilter === '2d' || timeFilter === 'custom';

    for (let i = 0; i < sorted.length; i += step) {
      const item = sorted[i];
      const d = item.dateObj;
      
      const timeStr = !isNaN(d.getTime())
        ? (isMultiDay
            ? `${d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        : `T-${i}`;

      finalResult.push({
        time: timeStr,
        timestampMs: d.getTime(),
        voltage: item.voltage,
        temperature: item.temperature,
        humidity: item.humidity,
        rpm: item.rpm,
        rpmCategory: item.rpmCategory,
        rpmTrend: item.rpmTrend,
        compressorStatus: item.compressorStatus,
      });
    }

    return finalResult;
  }, [realtimeBuffer, rpmRealtimeBuffer, historicalAcData, historicalRpmData, timeFilter, lowMax, medMax]);

  // --------------------------------------------------------------------------
  // STATISTIK RINGKAS RPM PADA HEADER GRAFIK UTAMA
  // --------------------------------------------------------------------------
  const rpmSummaryStats = useMemo(() => {
    let minR = Infinity;
    let maxR = 0;
    let sumR = 0;
    let countActive = 0;

    chartData.forEach((pt) => {
      if (pt.rpm !== null && pt.rpm !== undefined && pt.rpm >= 400) {
        countActive++;
        sumR += pt.rpm;
        if (pt.rpm < minR) minR = pt.rpm;
        if (pt.rpm > maxR) maxR = pt.rpm;
      }
    });

    const currRpm = latestRpmReading?.estimated_rpm !== undefined 
      ? Math.round(Number(latestRpmReading.estimated_rpm)) 
      : (chartData.length > 0 ? chartData[chartData.length - 1].rpm || 0 : 0);

    let currCategory = 'OFF';
    if (currRpm >= 400) {
      if (currRpm <= lowMax) currCategory = 'LOW';
      else if (currRpm <= medMax) currCategory = 'MEDIUM';
      else currCategory = 'HIGH';
    }

    return {
      currentRpm: currRpm,
      currentCategory: currCategory,
      currentTrend: latestRpmReading?.speed_trend || (currRpm === 0 ? 'STOPPED' : 'STABLE'),
      minRpm: minR === Infinity ? 0 : minR,
      maxRpm: maxR,
      avgRpm: countActive > 0 ? Math.round(sumR / countActive) : 0,
      activeCount: countActive,
    };
  }, [chartData, latestRpmReading, lowMax, medMax]);

  // --------------------------------------------------------------------------
  // PENANDA TIMELINE COMPRESSOR (REFERENCE DOTS)
  // - Mulai bekerja (Start)
  // - Akselerasi (Mulai meningkatkan kecepatan)
  // - Mencapai kategori HIGH (Ngebut)
  // - Deselerasi (Menurunkan kecepatan)
  // - Berhenti (Stop / 0 RPM)
  // --------------------------------------------------------------------------
  const eventMarkers = useMemo(() => {
    if (chartData.length < 2) return [];
    const markers = [];

    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];

      const prevR = prev.rpm || 0;
      const currR = curr.rpm || 0;

      // 1. Compressor Mulai Bekerja (Start dari 0/OFF)
      if (prevR < 400 && currR >= 400) {
        markers.push({
          type: 'START',
          label: 'Mulai Bekerja',
          time: curr.time,
          rpm: currR,
          color: '#10b981'
        });
      }
      // 2. Mencapai Kategori HIGH (Ngebut)
      else if (prevR <= medMax && currR > medMax) {
        markers.push({
          type: 'HIGH_REACHED',
          label: 'Mencapai HIGH',
          time: curr.time,
          rpm: currR,
          color: '#ef4444'
        });
      }
      // 3. Akselerasi Cepat
      else if (curr.rpmTrend === 'ACCELERATING' && prev.rpmTrend !== 'ACCELERATING' && currR >= 400) {
        markers.push({
          type: 'ACCELERATING',
          label: 'Akselerasi ↗',
          time: curr.time,
          rpm: currR,
          color: '#f97316'
        });
      }
      // 4. Deselerasi (Mulai menurunkan kecepatan)
      else if (curr.rpmTrend === 'DECELERATING' && prev.rpmTrend !== 'DECELERATING' && currR >= 400) {
        markers.push({
          type: 'DECELERATING',
          label: 'Deselerasi ↘',
          time: curr.time,
          rpm: currR,
          color: '#06b6d4'
        });
      }
      // 5. Compressor Berhenti Bekerja
      else if (prevR >= 400 && currR < 400) {
        markers.push({
          type: 'STOPPED',
          label: 'Kompresor Berhenti',
          time: curr.time,
          rpm: currR,
          color: '#94a3b8'
        });
      }
    }

    return markers.slice(-8); // Tampilkan maksimal 8 penanda terbaru
  }, [chartData, medMax]);

  return (
    <div className={`bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4 transition-all duration-300 ${
      isExpanded ? 'ring-2 ring-electric-orange/40' : ''
    }`}>
      
      {/* 1. HEADER GRAFIK UTAMA: Title, Status Sesi RPM Cepat, dan Kontrol Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-industrial-800 gap-4">
        
        {/* Identitas Grafik Utama */}
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-electric-orange animate-pulse"></div>
            <h2 className="text-base font-bold text-white font-mono tracking-wide flex items-center gap-2">
              UNIFIED MONITORING CHART — TELEMETRI SISTEM & COMPRESSOR RPM
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visualisasi multi-series simultan: Tegangan AC RMS, Frekuensi Putaran Motor Kompresor, Suhu Evaporator, & Kelembapan.
          </p>
        </div>

        {/* Filter Rentang Waktu Terpadu */}
        <div className="flex flex-wrap items-center gap-1.5 self-start lg:self-center">
          {[
            { id: 'live', label: 'Live' },
            { id: '5m', label: '5m' },
            { id: '15m', label: '15m' },
            { id: '1h', label: '1h' },
            { id: '6h', label: '6h' },
            { id: '24h', label: '24h' },
            { id: '2d', label: '2 Hari' },
            { id: 'custom', label: 'Kustom' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTimeFilter(f.id)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                timeFilter === f.id
                  ? 'bg-electric-orange text-white shadow font-bold'
                  : 'bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}

          {/* Tombol Pause/Resume Stream */}
          <button
            onClick={() => setIsStreamPaused(!isStreamPaused)}
            className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors cursor-pointer ml-1 ${
              isStreamPaused
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-industrial-950 border-industrial-800 text-slate-300 hover:text-white'
            }`}
            title={isStreamPaused ? 'Lanjutkan pembaruan live' : 'Jeda grafik'}
          >
            {isStreamPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden sm:inline">{isStreamPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchHistoricalUnified}
            className="p-1.5 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white cursor-pointer"
            title="Refresh Seluruh Data Grafik"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-electric-orange' : ''}`} />
          </button>

          {/* Tombol Reset Data */}
          <button
            onClick={() => {
              setResetFeedback(null);
              setShowResetModal(true);
            }}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 hover:bg-rose-900/60 hover:border-rose-600 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Reset Data Grafik & Riwayat Database"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden md:inline">Reset Data</span>
          </button>

          {/* Expand View */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white cursor-pointer"
            title={isExpanded ? 'Perkecil Grafik' : 'Perbesar Grafik'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-electric-orange" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

      </div>

      {/* FILTER TANGGAL KHUSUS JIKA AKTIF */}
      {timeFilter === 'custom' && (
        <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Dari:</span>
            <input
              type="datetime-local"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-industrial-900 border border-industrial-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Sampai:</span>
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-industrial-900 border border-industrial-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <button
            onClick={fetchHistoricalUnified}
            className="px-3 py-1 bg-electric-orange text-white rounded font-bold cursor-pointer hover:bg-electric-orange/80"
          >
            Terapkan Filter
          </button>
        </div>
      )}

      {/* 2. STATISTIK CEPAT RPM & ANALISIS LANGSUNG PADA GRAFIK UTAMA (SECTION 4) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
        
        {/* RPM Saat Ini */}
        <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-mono">RPM SAAT INI</span>
          <span className="text-lg font-black font-mono text-electric-orange">
            {rpmSummaryStats.currentRpm > 0 ? `${rpmSummaryStats.currentRpm.toLocaleString('id-ID')} RPM` : '0 RPM'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Status: <strong className="text-slate-300">{rpmSummaryStats.currentRpm > 0 ? 'RUNNING' : 'OFF'}</strong>
          </span>
        </div>

        {/* Kategori Kecepatan */}
        <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-mono">KATEGORI SPEED</span>
          <div>
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
              rpmSummaryStats.currentCategory === 'HIGH'
                ? 'bg-rose-950/70 border-rose-500/60 text-rose-300'
                : rpmSummaryStats.currentCategory === 'MEDIUM'
                ? 'bg-amber-950/70 border-amber-500/60 text-amber-300'
                : rpmSummaryStats.currentCategory === 'LOW'
                ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}>
              {rpmSummaryStats.currentCategory === 'HIGH' ? 'HIGH (Ngebut)' : rpmSummaryStats.currentCategory}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Batas: {lowMax}/{medMax}</span>
        </div>

        {/* Tren Kecepatan */}
        <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-mono">ARAH TREN</span>
          <span className={`text-xs font-bold font-mono flex items-center ${
            rpmSummaryStats.currentTrend === 'ACCELERATING'
              ? 'text-emerald-400'
              : rpmSummaryStats.currentTrend === 'DECELERATING'
              ? 'text-cyan-400'
              : 'text-slate-300'
          }`}>
            {rpmSummaryStats.currentTrend === 'ACCELERATING' && <TrendingUp className="w-3.5 h-3.5 mr-1" />}
            {rpmSummaryStats.currentTrend === 'DECELERATING' && <TrendingDown className="w-3.5 h-3.5 mr-1" />}
            {rpmSummaryStats.currentTrend}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Dinamika Motor</span>
        </div>

        {/* RPM Minimum Periode Ini */}
        <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-mono">RPM MINIMUM</span>
          <span className="text-base font-bold font-mono text-cyan-400">
            {rpmSummaryStats.minRpm.toLocaleString('id-ID')} RPM
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Batas Bawah Sesi</span>
        </div>

        {/* RPM Rata-rata */}
        <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-mono">RPM RATA-RATA</span>
          <span className="text-base font-bold font-mono text-emerald-400">
            {rpmSummaryStats.avgRpm.toLocaleString('id-ID')} RPM
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Beban Kerja Rerata</span>
        </div>

        {/* RPM Maksimum (Puncak) */}
        <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-mono">RPM PUNCAK (MAX)</span>
          <span className="text-base font-bold font-mono text-rose-400">
            {rpmSummaryStats.maxRpm.toLocaleString('id-ID')} RPM
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Putaran Tertinggi</span>
        </div>

      </div>

      {/* 3. LEGEND INTERAKTIF: KLIK UNTUK MENAMPILKAN / MENYEMBUNYIKAN SERI (SECTION 3) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg bg-industrial-950 border border-industrial-850 text-xs font-mono">
        <div className="flex items-center space-x-2 text-slate-400">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-300">Seri Data (Klik untuk On/Off):</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Seri: Compressor RPM */}
          <button
            onClick={() => toggleSeries('rpm')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md border transition-all cursor-pointer ${
              visibleSeries.rpm
                ? 'bg-electric-orange/20 border-electric-orange text-electric-orange font-bold shadow-sm'
                : 'bg-industrial-900 border-industrial-800 text-slate-500 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-electric-orange"></span>
            <span>Compressor RPM</span>
          </button>

          {/* Toggle Seri: Tegangan AC RMS */}
          <button
            onClick={() => toggleSeries('voltage')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md border transition-all cursor-pointer ${
              visibleSeries.voltage
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold shadow-sm'
                : 'bg-industrial-900 border-industrial-800 text-slate-500 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Tegangan AC RMS (V)</span>
          </button>

          {/* Toggle Seri: Suhu Udara */}
          <button
            onClick={() => toggleSeries('temperature')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md border transition-all cursor-pointer ${
              visibleSeries.temperature
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 font-bold shadow-sm'
                : 'bg-industrial-900 border-industrial-800 text-slate-500 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Suhu (°C)</span>
          </button>

          {/* Toggle Seri: Kelembapan */}
          <button
            onClick={() => toggleSeries('humidity')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-md border transition-all cursor-pointer ${
              visibleSeries.humidity
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 font-bold shadow-sm'
                : 'bg-industrial-900 border-industrial-800 text-slate-500 line-through opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span>Kelembapan (%RH)</span>
          </button>
        </div>

        {/* Legend Penanda Timeline */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span className="flex items-center text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1"></span> Start
          </span>
          <span className="flex items-center text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 mr-1"></span> HIGH
          </span>
          <span className="flex items-center text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-500 mr-1"></span> Stop
          </span>
        </div>
      </div>

      {/* 4. AREA GRAFIK MULTI-AXIS TERPADU */}
      <div className={`w-full transition-all duration-300 ${isExpanded ? 'h-[480px]' : 'h-84 sm:h-96'}`}>
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-sm border border-dashed border-industrial-800 rounded-lg p-6 text-center">
            {loadingHistory ? (
              <>
                <RotateCw className="w-8 h-8 mb-2 animate-spin text-electric-orange" />
                <span className="text-slate-300 font-semibold">Memuat riwayat telemetri dari database...</span>
                <span className="text-xs text-slate-500 mt-1">Mengambil data telemetri AC & putaran kompresor ({timeFilter})</span>
              </>
            ) : timeFilter !== 'live' ? (
              <>
                <AlertTriangle className="w-8 h-8 mb-2 text-amber-500/80" />
                <span className="text-slate-300 font-semibold">Tidak Ada Rekaman Telemetri Pada Rentang Waktu Ini</span>
                <span className="text-xs text-slate-500 mt-1 max-w-md">
                  Belum ada data AC atau RPM yang tersimpan dalam rentang {timeFilter.toUpperCase()} untuk perangkat {selectedDeviceId}. Coba pilih rentang waktu lain atau kembali ke mode Live.
                </span>
                <button
                  onClick={() => setTimeFilter('live')}
                  className="mt-3 px-3 py-1.5 bg-industrial-800 hover:bg-industrial-700 text-slate-200 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Kembali ke Mode Live
                </button>
              </>
            ) : (
              <>
                <Activity className="w-8 h-8 mb-2 animate-pulse text-slate-600" />
                <span>Menunggu transmisi telemetri AC & sinyal RPM kompresor dari ESP32...</span>
                <span className="text-xs text-slate-600 mt-1">
                  (Gunakan mode 'Coba Simulasi' di kanan atas untuk melihat demo grafik terpadu)
                </span>
              </>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                minTickGap={35}
              />

              {/* Y-AXIS 1 (KIRI): TEGANGAN LISTRIK AC RMS (170V - 260V) */}
              <YAxis 
                yAxisId="voltage"
                orientation="left"
                domain={[160, 260]}
                stroke="#f59e0b" 
                tick={{ fontSize: 10, fill: '#f59e0b' }} 
                unit="V"
                hide={!visibleSeries.voltage}
              />

              {/* Y-AXIS 2 (KANAN): COMPRESSOR ESTIMATED RPM (0 - 4500 RPM) */}
              <YAxis 
                yAxisId="rpm"
                orientation="right"
                domain={[0, 4800]}
                stroke="#f97316" 
                tick={{ fontSize: 10, fill: '#f97316' }} 
                unit=" RPM"
                hide={!visibleSeries.rpm}
              />

              {/* Y-AXIS 3 (LINGKUNGAN): SUHU & KELEMBAPAN (0 - 100) */}
              <YAxis 
                yAxisId="environmental"
                orientation="right"
                domain={[0, 100]}
                stroke="#94a3b8" 
                tick={{ fontSize: 10, fill: '#94a3b8' }} 
                unit="°"
                hide={!visibleSeries.temperature && !visibleSeries.humidity}
              />

              <Tooltip content={<UnifiedTooltip />} />

              {/* Garis Ambang Batas Tegangan PLN 198V & 242V */}
              {visibleSeries.voltage && (
                <>
                  <ReferenceLine 
                    yAxisId="voltage" 
                    y={settings.voltageLow} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3" 
                    label={{ value: `PLN Min (${settings.voltageLow}V)`, fill: '#ef4444', fontSize: 9, position: 'insideBottomLeft' }} 
                  />
                  <ReferenceLine 
                    yAxisId="voltage" 
                    y={settings.voltageHigh} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3" 
                    label={{ value: `PLN Max (${settings.voltageHigh}V)`, fill: '#ef4444', fontSize: 9, position: 'insideTopLeft' }} 
                  />
                </>
              )}

              {/* Garis Batas Kalibrasi Kompresor: HIGH MIN / Ngebut */}
              {visibleSeries.rpm && (
                <ReferenceLine 
                  yAxisId="rpm" 
                  y={highMin} 
                  stroke="#ef4444" 
                  strokeDasharray="3 3" 
                  label={{ value: `HIGH / Ngebut (>${highMin})`, fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} 
                />
              )}

              {/* PENANDA TIMELINE EVENT KOMPRESOR (ReferenceDot) */}
              {visibleSeries.rpm && eventMarkers.map((em, idx) => (
                <ReferenceDot
                  key={`marker-${idx}`}
                  yAxisId="rpm"
                  x={em.time}
                  y={em.rpm}
                  r={5}
                  fill={em.color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  isFront={true}
                />
              ))}

              {/* SERI 1: COMPRESSOR ESTIMATED RPM */}
              {visibleSeries.rpm && (
                <Line 
                  yAxisId="rpm"
                  type="monotone" 
                  dataKey="rpm" 
                  name="Compressor RPM" 
                  unit=" RPM"
                  stroke="#f97316" 
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, fill: '#f97316', stroke: '#ffffff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}

              {/* SERI 2: TEGANGAN LISTRIK AC RMS */}
              {visibleSeries.voltage && (
                <Line 
                  yAxisId="voltage"
                  type="monotone" 
                  dataKey="voltage" 
                  name="Tegangan RMS" 
                  unit=" VAC"
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, fill: '#f59e0b' }}
                  isAnimationActive={false}
                />
              )}

              {/* SERI 3: SUHU EVAPORATOR SHT31 */}
              {visibleSeries.temperature && (
                <Line 
                  yAxisId="environmental"
                  type="monotone" 
                  dataKey="temperature" 
                  name="Suhu Udara" 
                  unit=" °C"
                  stroke="#ef4444" 
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444' }}
                  isAnimationActive={false}
                />
              )}

              {/* SERI 4: KELEMBAPAN RELATIF SHT31 */}
              {visibleSeries.humidity && (
                <Line 
                  yAxisId="environmental"
                  type="monotone" 
                  dataKey="humidity" 
                  name="Kelembapan" 
                  unit=" %RH"
                  stroke="#06b6d4" 
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 4, fill: '#06b6d4' }}
                  isAnimationActive={false}
                />
              )}

            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* FOOTER PENANDA EVENT TERKINI */}
      {visibleSeries.rpm && eventMarkers.length > 0 && (
        <div className="pt-2 border-t border-industrial-800 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
          <span className="text-slate-300 font-bold">Penanda Terkini pada Timeline:</span>
          {eventMarkers.slice(-5).map((m, idx) => (
            <span 
              key={idx} 
              className="px-2 py-0.5 rounded bg-industrial-950 border border-industrial-800 text-slate-300 flex items-center space-x-1"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }}></span>
              <span>{m.label} ({m.time})</span>
            </span>
          ))}
        </div>
      )}

      {/* MODAL RESET DATA GRAFIK & DATABASE */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-industrial-900 border border-industrial-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden text-slate-200 font-mono">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-industrial-800 flex items-center justify-between bg-industrial-950/60">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-400">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    RESET DATA TELEMETRI & GRAFIK
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Perangkat: <span className="text-electric-orange font-bold">{selectedDeviceId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isResetting) {
                    setShowResetModal(false);
                    setResetFeedback(null);
                  }
                }}
                disabled={isResetting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-industrial-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-300">
                Pilih opsi pembersihan data telemetri yang diinginkan:
              </p>

              {/* Option 1: Bersihkan Buffer Live (RAM) */}
              <label
                onClick={() => setResetTarget('buffer')}
                className={`block p-3.5 rounded-xl border transition-all cursor-pointer ${
                  resetTarget === 'buffer'
                    ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                    : 'bg-industrial-950 border-industrial-800 hover:border-industrial-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="radio"
                      name="resetOption"
                      checked={resetTarget === 'buffer'}
                      onChange={() => setResetTarget('buffer')}
                      className="mt-0.5 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span className="font-bold text-white text-xs">
                      Bersihkan Buffer Grafik Live (RAM Browser)
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    Aman
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 pl-6 leading-relaxed">
                  Hanya mengosongkan antrean grafik yang sedang tampil di layar browser. Riwayat data di server Supabase <strong className="text-slate-300">tetap tersimpan</strong> dan tidak terhapus.
                </p>
              </label>

              {/* Option 2: Hapus Riwayat Database (Supabase) */}
              <label
                onClick={() => setResetTarget('database')}
                className={`block p-3.5 rounded-xl border transition-all cursor-pointer ${
                  resetTarget === 'database'
                    ? 'bg-rose-950/40 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                    : 'bg-industrial-950 border-industrial-800 hover:border-industrial-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <input
                      type="radio"
                      name="resetOption"
                      checked={resetTarget === 'database'}
                      onChange={() => setResetTarget('database')}
                      className="mt-0.5 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="font-bold text-white text-xs">
                      Hapus Seluruh Riwayat Database Cloud (Supabase)
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                    Permanen
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 pl-6 leading-relaxed">
                  Menghapus seluruh rekaman telemetri AC (<code className="text-slate-300">ac_readings</code>) dan putaran kompresor (<code className="text-slate-300">compressor_rpm_measurements</code>) untuk unit <strong className="text-white">{selectedDeviceId}</strong> di cloud Supabase.
                </p>
                {resetTarget === 'database' && (
                  <div className="mt-2.5 ml-6 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 flex items-start space-x-2 text-[10px] text-rose-300">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong>PERINGATAN:</strong> Tindakan ini permanen dan tidak dapat dibatalkan. Seluruh riwayat grafik perangkat ini di cloud akan dihapus.</span>
                  </div>
                )}
              </label>

              {/* Feedback Message */}
              {resetFeedback && (
                <div
                  className={`p-3 rounded-xl border flex items-center space-x-2 text-xs ${
                    resetFeedback.type === 'success'
                      ? 'bg-emerald-950/70 border-emerald-600/80 text-emerald-200'
                      : 'bg-rose-950/70 border-rose-600/80 text-rose-200'
                  }`}
                >
                  {resetFeedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="leading-snug">{resetFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-5 border-t border-industrial-800 bg-industrial-950/80 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => {
                  setShowResetModal(false);
                  setResetFeedback(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-industrial-900 border border-industrial-700 hover:bg-industrial-800 transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isResetting}
                onClick={handleExecuteReset}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center space-x-1.5 transition-all cursor-pointer ${
                  resetTarget === 'database'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-900/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/30'
                }`}
              >
                {isResetting ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{resetTarget === 'database' ? 'Konfirmasi Hapus Database' : 'Bersihkan Buffer Live'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
