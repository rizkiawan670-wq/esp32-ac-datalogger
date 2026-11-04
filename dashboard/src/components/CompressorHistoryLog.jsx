// ============================================================================
// COMPRESSOR HISTORY LOG & MEASUREMENT ARCHIVE COMPONENT
// Menampilkan riwayat terintegrasi telemetri RPM dan AC langsung di Dashboard utama.
// Mendukung filter waktu (Hari ini, 7 hari, 30 hari, kustom),
// status sinyal sensor, kategori kecepatan, serta fitur ekspor CSV lengkap.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  History, 
  FileSpreadsheet, 
  RotateCw, 
  Filter, 
  Calendar, 
  Search,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Gauge,
  Thermometer,
  Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSupabaseClient } from '../services/supabase';
import { exportCombinedTelemetryToCSV, exportRpmToCSV } from '../utils/csvExport';

export default function CompressorHistoryLog() {
  const { 
    selectedDeviceId, 
    rpmRealtimeBuffer, 
    realtimeBuffer, 
    activeCompressorProfile,
    isSimulating 
  } = useApp();

  const [timeFilter, setTimeFilter] = useState('today'); // 'today' | '7days' | '30days' | 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'LOW' | 'MEDIUM' | 'HIGH' | 'OFF'

  // Fetch data dari Supabase
  const fetchHistoricalLog = useCallback(async () => {
    setIsLoading(true);
    const client = getSupabaseClient();

    if (!client || isSimulating) {
      // Satukan buffer lokal saat simulator / offline
      setHistoricalData(rpmRealtimeBuffer);
      setIsLoading(false);
      return;
    }

    try {
      let query = client
        .from('compressor_rpm_measurements')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .order('recorded_at', { ascending: false })
        .limit(200);

      const now = new Date();
      if (timeFilter === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('recorded_at', startOfDay);
      } else if (timeFilter === '7days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('recorded_at', sevenDaysAgo);
      } else if (timeFilter === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('recorded_at', thirtyDaysAgo);
      } else if (timeFilter === 'custom') {
        if (customStart) query = query.gte('recorded_at', new Date(customStart).toISOString());
        if (customEnd) query = query.lte('recorded_at', new Date(customEnd).toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        setHistoricalData(data);
      } else {
        setHistoricalData(rpmRealtimeBuffer);
      }
    } catch (_err) {
      setHistoricalData(rpmRealtimeBuffer);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter, selectedDeviceId, customStart, customEnd, rpmRealtimeBuffer, isSimulating]);

  useEffect(() => {
    fetchHistoricalLog();
  }, [fetchHistoricalLog]);

  // Sumber data tampilan
  const sourceList = historicalData.length > 0 ? historicalData : rpmRealtimeBuffer;

  // Filter pencarian & kategori
  const filteredRows = useMemo(() => {
    return sourceList.filter((item) => {
      const cat = item.speed_category || item.compressor_status || (Number(item.estimated_rpm || item.rpm || 0) < 400 ? 'OFF' : 'LOW');
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;

      if (searchKeyword) {
        const q = searchKeyword.toLowerCase();
        const timeStr = String(item.recorded_at || item.measured_at || '').toLowerCase();
        const rpmStr = String(item.estimated_rpm || item.rpm || '');
        if (!timeStr.includes(q) && !rpmStr.includes(q)) return false;
      }
      return true;
    });
  }, [sourceList, categoryFilter, searchKeyword]);

  // Handler Ekspor CSV
  const handleExportCSV = () => {
    const filename = `telemetri_compressor_${selectedDeviceId}_${timeFilter}_${Date.now()}.csv`;
    
    // Gabungkan dengan info AC listrik jika ada kecocokan timestamp
    const exportRows = filteredRows.map((r) => {
      const d = new Date(r.recorded_at || r.measured_at || r.created_at);
      const timeMs = d.getTime();

      // Cari pembacaan AC terdekat dalam rentang +/- 2 detik
      const matchedAC = realtimeBuffer.find((ac) => {
        const acMs = new Date(ac.measured_at || ac.created_at).getTime();
        return Math.abs(acMs - timeMs) <= 2000;
      });

      return {
        recorded_at: r.recorded_at || r.measured_at || new Date().toISOString(),
        device_id: r.device_id || selectedDeviceId,
        voltage_v: matchedAC?.voltage_v ?? '--',
        temperature_c: matchedAC?.temperature_c ?? '--',
        humidity_rh: matchedAC?.humidity_rh ?? '--',
        estimated_rpm: Math.round(Number(r.estimated_rpm !== undefined ? r.estimated_rpm : r.rpm) || 0),
        compressor_status: r.compressor_status || (Number(r.estimated_rpm || r.rpm || 0) < 400 ? 'OFF' : 'RUNNING'),
        speed_category: r.speed_category || (Number(r.estimated_rpm || r.rpm || 0) < 400 ? 'OFF' : 'LOW'),
        speed_trend: r.speed_trend || r.trend || 'STABLE',
        sensor_channel: activeCompressorProfile.sensor_channel || 'U',
        signal_status: r.signal_status || 'VALID',
        calibration_status: activeCompressorProfile.is_calibrated ? 'CALIBRATED' : 'UNCALIBRATED',
        data_source: r.data_source || (isSimulating ? 'SIMULATOR' : 'REAL SENSOR')
      };
    });

    exportCombinedTelemetryToCSV(exportRows, filename);
  };

  return (
    <div className="bg-industrial-900 border border-industrial-800 rounded-xl overflow-hidden shadow-lg space-y-0">
      
      {/* Header Riwayat & Filter */}
      <div className="p-4 sm:p-5 border-b border-industrial-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center">
            <History className="w-4 h-4 mr-2 text-electric-orange" />
            RIWAYAT PENGUKURAN TELEMETRI & LOG RPM
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Log historis perubahan kecepatan putaran kompresor dan korelasi telemetri
          </p>
        </div>

        {/* Action Controls: Filter Waktu & Ekspor CSV */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Range */}
          <div className="flex items-center space-x-1 bg-industrial-950 p-1 rounded-lg border border-industrial-800 text-xs font-mono">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: '30days', label: '30 Hari' },
              { id: 'custom', label: 'Kustom' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  timeFilter === f.id
                    ? 'bg-industrial-800 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchHistoricalLog}
            className="p-2 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white cursor-pointer"
            title="Refresh Riwayat"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-electric-orange' : ''}`} />
          </button>

          {/* Tombol Ekspor CSV */}
          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-mono font-bold rounded-lg transition-all shadow cursor-pointer"
            title="Unduh log rekaman ke format CSV Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* FILTER TANGGAL KHUSUS (JIKA CUSTOM AKTIF) */}
      {timeFilter === 'custom' && (
        <div className="p-3 bg-industrial-950 border-b border-industrial-800 flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Dari:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-industrial-900 border border-industrial-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Sampai:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-industrial-900 border border-industrial-700 rounded px-2 py-1 text-slate-200"
            />
          </div>
          <button
            onClick={fetchHistoricalLog}
            className="px-3 py-1 bg-electric-orange text-white rounded font-bold cursor-pointer"
          >
            Terapkan
          </button>
        </div>
      )}

      {/* SEARCH & CATEGORY FILTER BAR */}
      <div className="p-3 bg-industrial-950/80 border-b border-industrial-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Filter Kategori:</span>
          {['all', 'LOW', 'MEDIUM', 'HIGH', 'OFF'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-colors ${
                categoryFilter === cat
                  ? 'bg-electric-orange/20 border border-electric-orange text-electric-orange'
                  : 'bg-industrial-900 border border-industrial-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <span className="text-slate-400 text-[11px]">
          Menampilkan <strong>{filteredRows.length}</strong> catatan pengukuran
        </span>
      </div>

      {/* TABEL DATA PENGUKURAN (HORIZONTAL SCROLLABLE ON MOBILE) */}
      <div className="overflow-x-auto max-h-80 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-industrial-950 text-slate-400 border-b border-industrial-800 uppercase tracking-wider text-[11px] sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-4">Waktu</th>
              <th className="py-2.5 px-4">ESTIMATED RPM</th>
              <th className="py-2.5 px-4">Kategori Kecepatan</th>
              <th className="py-2.5 px-4">Arah Perubahan</th>
              <th className="py-2.5 px-4">Kanal Sensor</th>
              <th className="py-2.5 px-4">Status Sinyal</th>
              <th className="py-2.5 px-4">Kalibrasi</th>
              <th className="py-2.5 px-4">Sumber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-800 text-slate-200">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-mono text-xs">
                  Tidak ada catatan pengukuran pada rentang waktu ini.
                </td>
              </tr>
            ) : (
              filteredRows.slice(0, 30).map((row, idx) => {
                const rpmVal = Math.round(Number(row.estimated_rpm !== undefined ? row.estimated_rpm : row.rpm) || 0);
                const d = new Date(row.recorded_at || row.measured_at || row.created_at);
                const timeStr = !isNaN(d.getTime())
                  ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '--:--:--';

                const cat = row.speed_category || (rpmVal < 400 ? 'OFF' : 'LOW');
                const trend = row.speed_trend || row.trend || 'STABLE';
                const sig = row.signal_status || 'VALID';

                return (
                  <tr key={idx} className="hover:bg-industrial-850/50 transition-colors">
                    <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">{timeStr}</td>
                    <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                      {rpmVal.toLocaleString('id-ID')} RPM
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        cat === 'HIGH'
                          ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                          : cat === 'MEDIUM'
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                          : cat === 'LOW'
                          ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                          : 'bg-industrial-950 border-industrial-800 text-slate-400'
                      }`}>
                        {cat}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`font-semibold ${
                        trend === 'ACCELERATING'
                          ? 'text-emerald-400'
                          : trend === 'DECELERATING'
                          ? 'text-cyan-400'
                          : 'text-slate-400'
                      }`}>
                        {trend}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                      Fasa {row.sensor_channel || activeCompressorProfile.sensor_channel || 'U'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        sig === 'VALID' ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                      }`}>
                        {sig}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`text-[10px] ${
                        activeCompressorProfile.is_calibrated ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {activeCompressorProfile.is_calibrated ? 'CALIBRATED' : 'ESTIMATED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-semibold ${
                        row.data_source === 'SIMULATOR' || isSimulating ? 'text-purple-400' : 'text-emerald-400'
                      }`}>
                        {row.data_source === 'SIMULATOR' || isSimulating ? 'SIMULATOR' : 'REAL'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
