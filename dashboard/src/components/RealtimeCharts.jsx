// ============================================================================
// REALTIME CHARTS COMPONENT — TELEMETRI KELISTRIKAN & LINGKUNGAN AC
// Grafik monitoring utama terpadu:
// - Tegangan Listrik AC True-RMS (Sumbu Y Kiri, 160V - 260V)
// - Suhu Udara & Kelembapan Relatif SHT31 (Sumbu Y Kanan, 0 - 100)
// Mendukung filter waktu terpadu (Live, 5m, 15m, 1h, 6h, 24h, 2 Hari, Kustom),
// legend interaktif untuk on/off seri, tooltip komprehensif,
// dan ringkasan metrik kelistrikan & termal pada header grafik.
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
  ReferenceLine 
} from 'recharts';
import { 
  Activity, 
  Zap, 
  Thermometer, 
  Droplets, 
  Wind,
  Layers, 
  Pause, 
  Play, 
  Clock, 
  RotateCw,
  Trash2,
  X,
  AlertOctagon,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSupabaseClient } from '../services/supabase';
import { calculateDewPoint } from '../utils/analytics';

// Tooltip kustom dengan styling industrial dark-mode
function UnifiedTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload || {};
    const dp = calculateDewPoint(dataPoint.temperature, dataPoint.humidity);

    return (
      <div className="bg-industrial-950/95 border border-industrial-700 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono min-w-[220px]">
        <div className="flex items-center justify-between border-b border-industrial-800 pb-2 mb-2.5">
          <span className="text-slate-400">Waktu Pengukuran:</span>
          <span className="text-white font-bold">{label}</span>
        </div>

        <div className="space-y-2">
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
                <span>Suhu Udara:</span>
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

          {/* Titik Embun */}
          {dp !== null && (
            <div className="pt-2 border-t border-industrial-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center space-x-1">
                <Wind className="w-3 h-3 text-cyan-400" />
                <span>Titik Embun:</span>
              </span>
              <span className="text-cyan-300 font-semibold">{dp.toFixed(1)} °C</span>
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

  // State Dialog Konfirmasi Reset Data
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState('buffer'); // 'buffer' | 'database'
  const [isResetting, setIsResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);

  // Data historis jika filter waktu bukan 'live'
  const [historicalAcData, setHistoricalAcData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Legend Visibility State: On/Off seri grafik
  const [visibleSeries, setVisibleSeries] = useState({
    voltage: true,
    temperature: true,
    humidity: true,
  });

  const toggleSeries = (seriesKey) => {
    setVisibleSeries((prev) => ({
      ...prev,
      [seriesKey]: !prev[seriesKey]
    }));
  };

  // --------------------------------------------------------------------------
  // QUERY HISTORIS UNTUK TELEMETRI AC JIKA FILTER BUKAN 'live'
  // --------------------------------------------------------------------------
  const fetchHistoricalUnified = useCallback(async () => {
    if (timeFilter === 'live') {
      setHistoricalAcData([]);
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
        setHistoricalAcData(filteredAc);
      } else {
        setHistoricalAcData(realtimeBuffer);
      }
      setLoadingHistory(false);
      return;
    }

    try {
      let acQuery = client
        .from('ac_readings')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .order('measured_at', { ascending: false })
        .limit(queryLimit);

      if (startTime) acQuery = acQuery.gte('measured_at', startTime);
      if (endTime) acQuery = acQuery.lte('measured_at', endTime);

      const { data, error } = await acQuery;

      if (!error && data && Array.isArray(data)) {
        setHistoricalAcData([...data].reverse());
      } else {
        setHistoricalAcData([]);
      }
    } catch (err) {
      console.error('Error fetching historical AC data:', err);
      setHistoricalAcData([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [timeFilter, selectedDeviceId, customStart, customEnd, realtimeBuffer, isSimulating]);

  useEffect(() => {
    fetchHistoricalUnified();
  }, [fetchHistoricalUnified]);

  // Eksekusi Reset Data
  const handleExecuteReset = async () => {
    setIsResetting(true);
    setResetFeedback(null);

    try {
      if (resetTarget === 'buffer') {
        resetChartBuffer();
        setHistoricalAcData([]);
        setResetFeedback({
          type: 'success',
          message: 'Buffer grafik live lokal (RAM) berhasil dibersihkan.'
        });
        setTimeout(() => {
          setShowResetModal(false);
          setResetFeedback(null);
        }, 1200);
      } else {
        const res = await resetStoredData(true);
        if (res.success) {
          setHistoricalAcData([]);
          setResetFeedback({
            type: 'success',
            message: res.message || 'Riwayat telemetri AC di database berhasil dibersihkan.'
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
  // PENYIAPAN DATA GRAFIK (FORMATTING & DOWNSAMPLING ADAPTIF)
  // --------------------------------------------------------------------------
  const chartData = useMemo(() => {
    const rawAc = timeFilter === 'live' ? realtimeBuffer : historicalAcData;
    if (rawAc.length === 0) return [];

    const isMultiDay = timeFilter === '24h' || timeFilter === '2d' || timeFilter === 'custom';
    const step = rawAc.length > 500 ? Math.ceil(rawAc.length / 350) : 1;
    const finalResult = [];

    for (let i = 0; i < rawAc.length; i += step) {
      const item = rawAc[i];
      const d = new Date(item.measured_at || item.created_at);
      
      const timeStr = !isNaN(d.getTime())
        ? (isMultiDay
            ? `${d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
            : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        : `T-${i}`;

      const v = item.voltage_v !== null && item.voltage_v !== undefined ? Number(item.voltage_v) : (item.voltage_rms !== null && item.voltage_rms !== undefined ? Number(item.voltage_rms) : null);
      const t = item.temperature_c !== null && item.temperature_c !== undefined ? Number(item.temperature_c) : null;
      const h = item.humidity_rh !== null && item.humidity_rh !== undefined ? Number(item.humidity_rh) : null;

      finalResult.push({
        time: timeStr,
        timestampMs: d.getTime(),
        voltage: v,
        temperature: t,
        humidity: h,
      });
    }

    return finalResult;
  }, [realtimeBuffer, historicalAcData, timeFilter]);


  return (
    <div className="bg-industrial-900 border-y sm:border border-industrial-800 sm:rounded-xl -mx-4 sm:mx-0 p-2.5 sm:p-5 shadow-lg space-y-3.5 sm:space-y-4 overflow-hidden">
      
      {/* 1. KONTROL WAKTU & AKSI GRAFIK */}
      <div className="flex flex-wrap items-center justify-end pb-3 border-b border-industrial-800 gap-3">

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
                  ? 'bg-electric-amber text-black font-bold shadow'
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
            title="Refresh Data Grafik"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-electric-amber' : ''}`} />
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
            className="px-3 py-1 bg-electric-amber text-black rounded font-bold cursor-pointer hover:bg-electric-amber/80"
          >
            Terapkan Filter
          </button>
        </div>
      )}



      {/* 3. LEGEND INTERAKTIF: ON/OFF SERI DATA */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg bg-industrial-950 border border-industrial-850 text-xs font-mono">
        <div className="flex items-center space-x-2 text-slate-400">
          <Layers className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-300">Seri Data (Klik untuk On/Off):</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

        {/* Info Standar PLN */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span className="flex items-center text-rose-400">
            <span className="w-2 h-0.5 bg-rose-500 mr-1.5"></span> Ambang PLN ({settings.voltageLow}V – {settings.voltageHigh}V)
          </span>
        </div>
      </div>

      {/* 4. AREA GRAFIK MULTI-AXIS TERPADU */}
      <div className="w-full h-80 sm:h-96 md:h-[420px] -mx-1 sm:mx-0">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-sm border border-dashed border-industrial-800 rounded-lg p-6 text-center">
            {loadingHistory ? (
              <>
                <RotateCw className="w-8 h-8 mb-2 animate-spin text-electric-amber" />
                <span className="text-slate-300 font-semibold">Memuat riwayat telemetri dari database...</span>
                <span className="text-xs text-slate-500 mt-1">Mengambil data telemetri AC ({timeFilter})</span>
              </>
            ) : timeFilter !== 'live' ? (
              <>
                <AlertTriangle className="w-8 h-8 mb-2 text-amber-500/80" />
                <span className="text-slate-300 font-semibold">Tidak Ada Rekaman Telemetri Pada Rentang Waktu Ini</span>
                <span className="text-xs text-slate-500 mt-1 max-w-md">
                  Belum ada data AC yang tersimpan dalam rentang {timeFilter.toUpperCase()} untuk perangkat {selectedDeviceId}. Coba pilih rentang waktu lain atau kembali ke mode Live.
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
                <span>Menunggu transmisi telemetri AC dari ESP32...</span>
                <span className="text-xs text-slate-600 mt-1">
                  (Gunakan mode 'Coba Simulasi' di kanan atas untuk melihat demo grafik terpadu)
                </span>
              </>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 12, right: 6, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              
              <XAxis 
                dataKey="time" 
                stroke="#64748b" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                minTickGap={35}
              />

              {/* Y-AXIS 1 (KIRI): TEGANGAN LISTRIK AC RMS (160V - 260V) */}
              <YAxis 
                yAxisId="voltage"
                orientation="left"
                domain={[160, 260]}
                stroke="#f59e0b" 
                tick={{ fontSize: 10, fill: '#f59e0b' }} 
                unit="V"
                hide={!visibleSeries.voltage}
              />

              {/* Y-AXIS 2 (KANAN): SUHU & KELEMBAPAN (0 - 100) */}
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

              {/* SERI 1: TEGANGAN LISTRIK AC RMS */}
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

              {/* SERI 2: SUHU UDARA SHT31 */}
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

              {/* SERI 3: KELEMBAPAN RELATIF SHT31 */}
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
                    Perangkat: <span className="text-electric-amber font-bold">{selectedDeviceId}</span>
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
                  Menghapus seluruh rekaman telemetri AC (<code className="text-slate-300">ac_readings</code>) untuk unit <strong className="text-white">{selectedDeviceId}</strong> di cloud Supabase.
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
