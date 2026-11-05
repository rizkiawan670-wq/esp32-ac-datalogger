// ============================================================================
// HISTORY PAGE (RIWAYAT PENGUKURAN TELEMETRI TEGANGAN & IKLIM AC)
// Fitur:
//   1. Query data historis langsung dari tabel ac_readings dengan paginasi.
//   2. Filter preset rentang waktu (Hari Ini, 7 Hari, 30 Hari, Semua, Kustom).
//   3. Filter Device ID dan pengurutan (Terbaru / Terlama).
//   4. Key baris berbasis ID record (anti-flicker React reconciliation).
//   5. Ekspor CSV telemetri terperinci (Waktu, Voltase, Suhu, Kelembapan, Titik Embun).
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  FileSpreadsheet,
  Zap,
  Thermometer,
  Droplets,
  Wind,
  Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSupabaseClient } from '../services/supabase';
import { exportReadingsToCSV } from '../utils/csvExport';
import { calculateDewPoint } from '../utils/analytics';

export default function HistoryPage() {
  const {
    selectedDeviceId,
    devices,
    realtimeBuffer,
    isSimulating,
    settings,
  } = useApp();

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

  // Key unik per baris
  const getRowKey = (r, idx) =>
    r.id || `${r.device_id}_${r.measured_at || r.created_at}_${idx}`;

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

    // MODE OFFLINE / SIMULASI — pakai buffer in-memory
    if (!client || isSimulating) {
      let sourceList = [...realtimeBuffer];

      if (filterDeviceId) sourceList = sourceList.filter(r => r.device_id === filterDeviceId);

      if (dateRange.start) {
        const startMs = new Date(dateRange.start).getTime();
        sourceList = sourceList.filter(r => new Date(r.measured_at || r.created_at).getTime() >= startMs);
      }
      if (dateRange.end) {
        const endMs = new Date(dateRange.end).getTime();
        sourceList = sourceList.filter(r => new Date(r.measured_at || r.created_at).getTime() <= endMs);
      }

      sourceList.sort((a, b) => {
        const diff = new Date(a.measured_at || a.created_at) - new Date(b.measured_at || b.created_at);
        return sortOrder === 'asc' ? diff : -diff;
      });

      setTotalCount(sourceList.length);
      const startIdx = (currentPage - 1) * pageSize;
      applyRecordsWithAnimation(sourceList.slice(startIdx, startIdx + pageSize));
      setInitialLoading(false);
      setIsRefreshing(false);
      return;
    }

    // SUPABASE QUERY DARI ac_readings
    try {
      let q = client.from('ac_readings').select('*', { count: 'exact' });
      if (filterDeviceId) q = q.eq('device_id', filterDeviceId);
      if (dateRange.start) q = q.gte('measured_at', dateRange.start);
      if (dateRange.end) q = q.lte('measured_at', dateRange.end);
      
      q = q.order('measured_at', { ascending: sortOrder === 'asc' })
           .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);
      
      const { data, count, error } = await q;
      if (error) throw error;

      applyRecordsWithAnimation(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  }, [filterDeviceId, filterPreset, startDate, endDate, sortOrder, currentPage, pageSize, isSimulating, realtimeBuffer, getDateRangeForPreset]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  // Ekspor CSV
  const handleExportCSV = () => {
    const filename = `telemetri_ac_${filterDeviceId || 'all'}_${Date.now()}.csv`;
    exportReadingsToCSV(records, filename);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">

      {/* ARSIP & PENELUSURAN BASIS DATA HISTORIS */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg">

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-electric-amber" />
              Arsip &amp; Penelusuran Telemetri AC
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Telusuri riwayat tegangan listrik PLN True-RMS, suhu udara, dan kelembapan ruangan dengan filter dan paginasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tombol Ekspor CSV */}
            <button
              onClick={handleExportCSV}
              disabled={records.length === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-600/60 text-emerald-300 hover:bg-emerald-900/60 text-xs font-mono font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ekspor CSV</span>
            </button>

            {/* Tombol Refresh */}
            <button
              onClick={() => fetchHistoricalData(true)}
              className="p-1.5 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white cursor-pointer"
              title="Refresh Data"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-electric-amber' : ''}`} />
            </button>
          </div>
        </div>

        {/* BAR FILTER */}
        <div className="p-3 bg-industrial-950 rounded-xl border border-industrial-800 mb-4 flex flex-wrap items-center gap-3 text-xs font-mono">
          {/* Preset Waktu */}
          <div className="flex items-center space-x-1">
            <span className="text-slate-400 text-[11px]">Rentang:</span>
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: '7days', label: '7 Hari' },
              { id: '30days', label: '30 Hari' },
              { id: 'all', label: 'Semua' },
              { id: 'custom', label: 'Kustom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setFilterPreset(p.id);
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  filterPreset === p.id
                    ? 'bg-electric-amber text-black font-bold'
                    : 'bg-industrial-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filter Tanggal Kustom */}
          {filterPreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-industrial-900 border border-industrial-800 rounded px-2 py-1 text-slate-200 text-xs"
              />
              <span className="text-slate-400 text-[11px]">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-industrial-900 border border-industrial-800 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
          )}

          {/* Filter Perangkat */}
          <div className="flex items-center space-x-1.5 ml-auto">
            <span className="text-slate-400 text-[11px]">Unit:</span>
            <select
              value={filterDeviceId}
              onChange={(e) => {
                setFilterDeviceId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-industrial-900 border border-industrial-800 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="">Semua Perangkat</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.name || d.device_id}
                </option>
              ))}
            </select>

            {/* Urutan Sort */}
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-industrial-900 border border-industrial-800 rounded px-2 py-1 text-slate-200 text-xs"
            >
              <option value="desc">Terbaru Dulu</option>
              <option value="asc">Terlama Dulu</option>
            </select>
          </div>
        </div>

        {/* TABEL DATA TELEMETRI */}
        <div className="overflow-x-auto rounded-lg border border-industrial-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-950 text-slate-400 border-b border-industrial-800">
              <tr>
                <th className="py-2.5 px-3">Waktu (WIB)</th>
                <th className="py-2.5 px-3">Perangkat</th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3.5 h-3.5 text-electric-amber" />
                    <span>Tegangan RMS</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">Status PLN</th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center space-x-1">
                    <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                    <span>Suhu</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center space-x-1">
                    <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Kelembapan</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center space-x-1">
                    <Wind className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Titik Embun</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800 bg-industrial-900">
              {initialLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-electric-amber" />
                    <span>Memuat riwayat telemetri dari database...</span>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500">
                    Tidak ada rekaman data telemetri yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const volt = r.voltage_v !== null && r.voltage_v !== undefined ? Number(r.voltage_v) : (r.voltage_rms !== null && r.voltage_rms !== undefined ? Number(r.voltage_rms) : null);
                  const temp = r.temperature_c !== null && r.temperature_c !== undefined ? Number(r.temperature_c) : null;
                  const hum = r.humidity_rh !== null && r.humidity_rh !== undefined ? Number(r.humidity_rh) : null;
                  const dp = calculateDewPoint(temp, hum);
                  const vStat = getVoltageStatus(volt);
                  const rowKey = getRowKey(r, idx);
                  const isNew = newRowIds.has(rowKey);

                  const timeStr = r.measured_at || r.created_at
                    ? new Date(r.measured_at || r.created_at).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '--';

                  return (
                    <tr
                      key={rowKey}
                      className={`hover:bg-industrial-850/60 transition-colors ${
                        isNew ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{timeStr}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-bold">{r.device_id || selectedDeviceId}</td>
                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                        {volt !== null ? `${volt.toFixed(1)} VAC` : '--.-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            vStat.type === 'normal'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
                              : vStat.type === 'warning'
                              ? 'bg-rose-950/60 text-rose-400 border-rose-700/50'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                        >
                          {vStat.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-rose-300 font-semibold whitespace-nowrap">
                        {temp !== null ? `${temp.toFixed(1)} °C` : '--.-'}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-semibold whitespace-nowrap">
                        {hum !== null ? `${hum.toFixed(1)} %RH` : '--.-'}
                      </td>
                      <td className="py-2.5 px-3 text-cyan-400 font-mono whitespace-nowrap">
                        {dp !== null ? `${dp.toFixed(1)} °C` : '--.-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER & PAGINASI */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div>
            Menampilkan <span className="text-white font-bold">{records.length}</span> dari{' '}
            <span className="text-white font-bold">{totalCount}</span> total rekaman
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 mr-2">
              <span>Per halaman:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-industrial-950 border border-industrial-800 rounded px-1.5 py-0.5 text-slate-200 text-xs"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || initialLoading}
              className="p-1 rounded bg-industrial-950 border border-industrial-800 text-slate-300 disabled:opacity-40 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span>
              Halaman <span className="text-white font-bold">{currentPage}</span> dari{' '}
              <span className="text-white font-bold">{totalPages}</span>
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || initialLoading}
              className="p-1 rounded bg-industrial-950 border border-industrial-800 text-slate-300 disabled:opacity-40 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
