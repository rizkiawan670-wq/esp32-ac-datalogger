// ============================================================================
// HISTORY PAGE (RIWAYAT PENGUKURAN TELEMETRI & LOG RPM COMPRESSOR)
// BUG FIXES v2:
//   1. View mode selector pakai handleSetViewMode — data langsung refresh sesuai mode.
//   2. Mode Terpadu (all) query JOIN dua tabel (compressor_rpm_measurements + ac_readings).
//   3. Anti-flicker: key baris berbasis ID unik record bukan index array.
//   4. Animasi slide-down diterapkan via newRowIds Set + CSS .animate-row-enter.
//   5. Loading bar atas tabel: transition opacity, tidak pulse/kedip abrupt.
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSupabaseClient } from '../services/supabase';
import { exportReadingsToCSV, exportRpmToCSV, exportCombinedTelemetryToCSV } from '../utils/csvExport';
import CompressorHistoryLog from '../components/CompressorHistoryLog';

export default function HistoryPage() {
  const {
    selectedDeviceId,
    devices,
    realtimeBuffer,
    rpmRealtimeBuffer,
    isSimulating,
    settings,
  } = useApp();

  // Mode Tampilan: 'all' Terpadu | 'rpm' Khusus RPM | 'ac' Khusus Listrik & Suhu
  const [viewMode, setViewMode] = useState('all');

  const [records, setRecords] = useState([]);
  const prevRecordIdsRef = useRef(new Set());
  const [newRowIds, setNewRowIds] = useState(new Set());

  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filter
  const [filterDeviceId, setFilterDeviceId] = useState(selectedDeviceId || '');
  const [filterPreset, setFilterPreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  // Paginasi
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Batas toleransi tegangan PLN
  const vLow = settings?.voltageLow ?? 198.0;
  const vHigh = settings?.voltageHigh ?? 242.0;

  // Evaluasi status tegangan
  const getVoltageStatus = (voltage) => {
    if (voltage === null || voltage === undefined || isNaN(voltage)) return { label: 'NO DATA', type: 'none' };
    const val = Number(voltage);
    if (val < vLow) return { label: 'UNDERVOLT', type: 'warning' };
    if (val > vHigh) return { label: 'OVERVOLT', type: 'warning' };
    return { label: 'NORMAL', type: 'normal' };
  };

  // Hitung batas waktu dari preset
  const getDateRangeForPreset = useCallback((preset) => {
    const now = new Date();
    if (preset === 'today') {
      return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), end: '' };
    }
    if (preset === '7days') {
      return { start: new Date(now.getTime() - 7 * 86400000).toISOString(), end: '' };
    }
    if (preset === '30days') {
      return { start: new Date(now.getTime() - 30 * 86400000).toISOString(), end: '' };
    }
    return {
      start: startDate ? new Date(startDate).toISOString() : '',
      end: endDate ? new Date(endDate).toISOString() : '',
    };
  }, [startDate, endDate]);

  // Key unik per baris (anti-flicker React reconciliation)
  const getRowKey = (r, idx) =>
    r.id || r.uuid || `${r.device_id}_${r.recorded_at || r.measured_at || r.created_at}_${idx}`;

  // Terapkan records baru dengan animasi slide-down untuk baris baru saja
  const applyRecordsWithAnimation = (newList) => {
    const newIds = new Set(newList.map((r, i) => getRowKey(r, i)));
    const added = new Set([...newIds].filter(id => !prevRecordIdsRef.current.has(id)));
    prevRecordIdsRef.current = newIds;
    setRecords(newList);
    if (added.size > 0) {
      setNewRowIds(added);
      setTimeout(() => setNewRowIds(new Set()), 750);
    }
  };

  // --------------------------------------------------------------------------
  // FETCH DATA
  // --------------------------------------------------------------------------
  const fetchHistoricalData = useCallback(async (_isManual = false) => {
    setIsRefreshing(true);
    const client = getSupabaseClient();
    const dateRange = getDateRangeForPreset(filterPreset);

    // OFFLINE / SIMULASI — pakai buffer in-memory
    if (!client || isSimulating) {
      let sourceList = [];

      if (viewMode === 'rpm') {
        sourceList = [...rpmRealtimeBuffer];
      } else if (viewMode === 'ac') {
        sourceList = [...realtimeBuffer];
      } else {
        // Terpadu: join RPM + AC berdasarkan timestamp ±3 detik
        if (rpmRealtimeBuffer.length > 0) {
          sourceList = rpmRealtimeBuffer.map((rpmItem) => {
            const tMs = new Date(rpmItem.recorded_at || rpmItem.created_at).getTime();
            const matchAc = realtimeBuffer.find((ac) => {
              const acMs = new Date(ac.measured_at || ac.created_at).getTime();
              return Math.abs(acMs - tMs) <= 3000;
            });
            return {
              ...rpmItem,
              _rowType: 'combined',
              voltage_v: matchAc?.voltage_v ?? null,
              temperature_c: matchAc?.temperature_c ?? null,
              humidity_rh: matchAc?.humidity_rh ?? null,
            };
          });
        } else {
          sourceList = realtimeBuffer.map((ac) => ({ ...ac, _rowType: 'ac_only' }));
        }
      }

      if (filterDeviceId) sourceList = sourceList.filter(r => r.device_id === filterDeviceId);

      sourceList.sort((a, b) => {
        const diff = new Date(a.recorded_at || a.measured_at) - new Date(b.recorded_at || b.measured_at);
        return sortOrder === 'asc' ? diff : -diff;
      });

      setTotalCount(sourceList.length);
      const startIdx = (currentPage - 1) * pageSize;
      applyRecordsWithAnimation(sourceList.slice(startIdx, startIdx + pageSize));
      setInitialLoading(false);
      setIsRefreshing(false);
      return;
    }

    // SUPABASE QUERY
    try {
      let mergedData = [];
      let mergedCount = 0;

      if (viewMode === 'rpm') {
        // Khusus RPM
        let q = client.from('compressor_rpm_measurements').select('*', { count: 'exact' });
        if (filterDeviceId) q = q.eq('device_id', filterDeviceId);
        if (dateRange.start) q = q.gte('recorded_at', dateRange.start);
        if (dateRange.end) q = q.lte('recorded_at', dateRange.end);
        q = q.order('recorded_at', { ascending: sortOrder === 'asc' })
             .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
        const { data, count, error } = await q;
        if (error) throw error;
        mergedData = (data || []).map(r => ({ ...r, _rowType: 'rpm' }));
        mergedCount = count || 0;

      } else if (viewMode === 'ac') {
        // Khusus Listrik & Suhu AC
        let q = client.from('ac_readings').select('*', { count: 'exact' });
        if (filterDeviceId) q = q.eq('device_id', filterDeviceId);
        if (dateRange.start) q = q.gte('measured_at', dateRange.start);
        if (dateRange.end) q = q.lte('measured_at', dateRange.end);
        q = q.order('measured_at', { ascending: sortOrder === 'asc' })
             .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
        const { data, count, error } = await q;
        if (error) throw error;
        mergedData = (data || []).map(r => ({ ...r, _rowType: 'ac' }));
        mergedCount = count || 0;

      } else {
        // MODE TERPADU: JOIN RPM + AC berdasarkan timestamp ±3 detik
        const pageFrom = (currentPage - 1) * pageSize;
        const pageTo = currentPage * pageSize - 1;

        let qRpm = client.from('compressor_rpm_measurements').select('*', { count: 'exact' });
        if (filterDeviceId) qRpm = qRpm.eq('device_id', filterDeviceId);
        if (dateRange.start) qRpm = qRpm.gte('recorded_at', dateRange.start);
        if (dateRange.end) qRpm = qRpm.lte('recorded_at', dateRange.end);
        qRpm = qRpm.order('recorded_at', { ascending: sortOrder === 'asc' }).range(pageFrom, pageTo);

        let qAc = client.from('ac_readings').select('*');
        if (filterDeviceId) qAc = qAc.eq('device_id', filterDeviceId);
        if (dateRange.start) qAc = qAc.gte('measured_at', dateRange.start);
        if (dateRange.end) qAc = qAc.lte('measured_at', dateRange.end);
        qAc = qAc.order('measured_at', { ascending: sortOrder === 'asc' })
                 .range(pageFrom, pageTo + pageSize);

        const [rpmResult, acResult] = await Promise.all([qRpm, qAc]);
        if (rpmResult.error) throw rpmResult.error;

        const rpmRows = rpmResult.data || [];
        const acRows = acResult.data || [];

        if (rpmRows.length > 0) {
          mergedData = rpmRows.map((rpmRow) => {
            const tMs = new Date(rpmRow.recorded_at).getTime();
            let bestAc = null;
            let bestDiff = Infinity;
            for (const acRow of acRows) {
              const diff = Math.abs(new Date(acRow.measured_at).getTime() - tMs);
              if (diff < bestDiff && diff <= 3000) { bestDiff = diff; bestAc = acRow; }
            }
            return {
              ...rpmRow,
              _rowType: 'combined',
              voltage_v: bestAc?.voltage_v ?? null,
              temperature_c: bestAc?.temperature_c ?? null,
              humidity_rh: bestAc?.humidity_rh ?? null,
            };
          });
          mergedCount = rpmResult.count || 0;
        } else {
          // Fallback: tampilkan data AC saja jika belum ada RPM
          mergedData = acRows.map(r => ({ ...r, _rowType: 'ac_only' }));
          mergedCount = acRows.length;
        }
      }

      applyRecordsWithAnimation(mergedData);
      setTotalCount(mergedCount);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [viewMode, filterDeviceId, filterPreset, startDate, endDate, sortOrder, currentPage, pageSize, isSimulating, realtimeBuffer, rpmRealtimeBuffer, getDateRangeForPreset]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  // Ganti mode & reset halaman + records agar tidak tampil data lama sebentar
  const handleSetViewMode = (mode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    setCurrentPage(1);
    setRecords([]);
    prevRecordIdsRef.current = new Set();
  };

  // Ekspor CSV sesuai mode aktif
  const handleExportCSV = () => {
    const filename = `telemetri_${viewMode}_${filterDeviceId || 'all'}_${Date.now()}.csv`;
    if (viewMode === 'rpm') exportRpmToCSV(records, filename);
    else if (viewMode === 'ac') exportReadingsToCSV(records, filename);
    else exportCombinedTelemetryToCSV(records, filename);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* ── 1. RIWAYAT PENGUKURAN TELEMETRI & LOG RPM ─────────────────── */}
      <section aria-label="Riwayat Pengukuran Telemetri & Log RPM">
        <CompressorHistoryLog />
      </section>

      {/* ── 2. ARSIP & PENELUSURAN BASIS DATA HISTORIS ─────────────────── */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-electric-orange" />
              Arsip &amp; Penelusuran Basis Data Historis
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Telusuri riwayat kecepatan kompresor, kondisi tegangan PLN, dan suhu AC dengan query multi-mode dan paginasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-industrial-950 p-1 rounded-lg border border-industrial-800 flex text-xs font-mono gap-0.5">
              {[
                { key: 'all', label: 'Terpadu (AC + RPM)' },
                { key: 'rpm', label: 'Log RPM Kompresor' },
                { key: 'ac',  label: 'Listrik & Suhu AC'  },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleSetViewMode(key)}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    viewMode === key
                      ? 'bg-electric-orange text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-industrial-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Ekspor CSV */}
            <button
              onClick={handleExportCSV}
              disabled={isRefreshing || totalCount === 0}
              className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono text-xs font-bold rounded-lg shadow cursor-pointer transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-industrial-800">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Rentang Periode</label>
            <select
              value={filterPreset}
              onChange={(e) => { setFilterPreset(e.target.value); setCurrentPage(1); }}
              className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-electric-orange"
            >
              <option value="all">Semua Riwayat</option>
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="30days">30 Hari Terakhir</option>
              <option value="custom">Rentang Tanggal Khusus</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Perangkat (Device ID)</label>
            <select
              value={filterDeviceId}
              onChange={(e) => { setFilterDeviceId(e.target.value); setCurrentPage(1); }}
              className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-electric-orange"
            >
              <option value="">Semua Perangkat</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_id} ({d.name ? d.name.substring(0, 18) : 'Unit'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Dari Tanggal/Jam</label>
            <input
              type="datetime-local" value={startDate}
              disabled={filterPreset !== 'custom'}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-industrial-950 disabled:opacity-50 border border-industrial-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-electric-orange"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Hingga Tanggal/Jam</label>
            <input
              type="datetime-local" value={endDate}
              disabled={filterPreset !== 'custom'}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-industrial-950 disabled:opacity-50 border border-industrial-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-electric-orange"
            />
          </div>

          <div className="flex items-end space-x-2">
            <button
              onClick={() => { setSortOrder(s => s === 'desc' ? 'asc' : 'desc'); setCurrentPage(1); }}
              className="flex-1 bg-industrial-950 border border-industrial-800 hover:border-industrial-700 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-center cursor-pointer"
            >
              Waktu: {sortOrder.toUpperCase()}
            </button>
            <button
              onClick={() => fetchHistoricalData(true)}
              disabled={isRefreshing}
              title="Segarkan data"
              className="p-2 bg-industrial-950 border border-industrial-800 hover:border-industrial-700 text-slate-300 rounded-lg cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 transition-transform ${isRefreshing ? 'animate-spin text-electric-orange' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabel Data ─────────────────────────────────────────────────── */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl overflow-hidden shadow-lg relative">

        {/* Loading bar: transition opacity — tidak berkedip */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 z-10 pointer-events-none transition-opacity duration-500"
          style={{
            opacity: isRefreshing ? 1 : 0,
            background: 'linear-gradient(90deg, transparent 0%, #f97316 40%, #f97316 60%, transparent 100%)',
          }}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-950 text-slate-400 border-b border-industrial-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Device ID</th>
                {(viewMode === 'all' || viewMode === 'rpm') && (
                  <>
                    <th className="py-3 px-4">Estimated RPM</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Trend</th>
                    <th className="py-3 px-4">Sinyal</th>
                  </>
                )}
                {(viewMode === 'all' || viewMode === 'ac') && (
                  <>
                    <th className="py-3 px-4">Tegangan (V RMS)</th>
                    <th className="py-3 px-4">Suhu (°C)</th>
                    <th className="py-3 px-4">Kelembapan (%RH)</th>
                  </>
                )}
                <th className="py-3 px-4">Sumber Data</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-industrial-800 text-slate-200">
              {initialLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RotateCw className="w-6 h-6 animate-spin text-electric-orange" />
                      <span>Memuat log riwayat telemetri...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    Tidak ada catatan telemetri pada rentang waktu ini.
                  </td>
                </tr>
              ) : (
                records.map((r, i) => {
                  const rowKey = getRowKey(r, i);
                  const isNew = newRowIds.has(rowKey);

                  const dateStr = new Date(r.recorded_at || r.measured_at || r.created_at).toLocaleString('id-ID', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  });

                  const rpmVal = Math.round(Number(r.estimated_rpm !== undefined ? r.estimated_rpm : r.rpm) || 0);
                  const cat    = r.speed_category || (rpmVal < 400 ? 'OFF' : 'LOW');
                  const trend  = r.speed_trend || r.trend || 'STABLE';
                  const sig    = r.signal_status || 'VALID';
                  const source = r.data_source || (r.is_simulated ? 'SIMULATOR' : 'REAL');
                  const voltSt = getVoltageStatus(r.voltage_v);

                  return (
                    <tr
                      key={rowKey}
                      className={`hover:bg-industrial-800/40 transition-colors duration-100 ${isNew ? 'animate-row-enter' : ''}`}
                    >
                      <td className="py-2.5 px-4 text-slate-300 whitespace-nowrap">{dateStr}</td>
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{r.device_id}</td>

                      {(viewMode === 'all' || viewMode === 'rpm') && (
                        <>
                          <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                            {rpmVal > 0 ? `${rpmVal.toLocaleString('id-ID')} RPM` : <span className="text-slate-600">0 RPM</span>}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              cat === 'HIGH'   ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                            : cat === 'MEDIUM' ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                            : cat === 'LOW'    ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                            :                   'bg-industrial-950 border-industrial-800 text-slate-500'
                            }`}>
                              {cat}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`font-semibold ${
                              trend === 'ACCELERATING' ? 'text-emerald-400'
                            : trend === 'DECELERATING' ? 'text-cyan-400'
                            :                           'text-slate-500'
                            }`}>
                              {trend === 'ACCELERATING' ? '↗ ACCEL'
                             : trend === 'DECELERATING' ? '↘ DECEL'
                             : trend}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              sig === 'VALID' ? 'text-emerald-400 bg-emerald-950/40' : 'text-rose-400 bg-rose-950/40'
                            }`}>
                              {sig}
                            </span>
                          </td>
                        </>
                      )}

                      {(viewMode === 'all' || viewMode === 'ac') && (
                        <>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {r.voltage_v != null ? (
                              <span className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{Number(r.voltage_v).toFixed(1)} V</span>
                                <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                                  voltSt.type === 'warning'
                                    ? 'bg-amber-950/60 text-amber-400'
                                    : 'bg-emerald-950/40 text-emerald-500'
                                }`}>{voltSt.label}</span>
                              </span>
                            ) : <span className="text-slate-600">--</span>}
                          </td>
                          <td className="py-2.5 px-4 text-rose-400 font-semibold whitespace-nowrap">
                            {r.temperature_c != null ? `${Number(r.temperature_c).toFixed(1)} °C` : <span className="text-slate-600">--</span>}
                          </td>
                          <td className="py-2.5 px-4 text-cyan-400 font-semibold whitespace-nowrap">
                            {r.humidity_rh != null ? `${Number(r.humidity_rh).toFixed(1)} %` : <span className="text-slate-600">--</span>}
                          </td>
                        </>
                      )}

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold ${
                          source === 'SIMULATOR' ? 'text-purple-400' : 'text-emerald-400'
                        }`}>
                          {source}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginasi Footer */}
        <div className="bg-industrial-950 p-3 sm:p-4 border-t border-industrial-800 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-3">
          <div className="flex items-center space-x-2">
            <span>Per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-industrial-900 border border-industrial-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
            <span>Total: <strong className="text-white">{totalCount}</strong> baris</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>Hal. {currentPage} / {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage <= 1 || isRefreshing}
              className="p-1.5 rounded bg-industrial-900 border border-industrial-800 disabled:opacity-40 hover:bg-industrial-800 text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages || isRefreshing}
              className="p-1.5 rounded bg-industrial-900 border border-industrial-800 disabled:opacity-40 hover:bg-industrial-800 text-slate-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
