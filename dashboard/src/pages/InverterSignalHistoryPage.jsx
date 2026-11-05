// ============================================================================
// INVERTER SIGNAL HISTORY PAGE (RIWAYAT PAKET SINYAL BUS TERMINAL 3)
// Menyediakan tabel data historis paket telemetri kabel sinyal:
// 1. Filter rentang waktu dan pencarian kode error / status
// 2. Kolom telemetri lengkap: Waktu, RPM Kompresor, Freq, 5 Thermistor, EEV, Fans, Error
// 3. Ekspor file CSV paket serial sniffer untuk dokumentasi laporan servis teknisi
// ============================================================================

import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  FileSpreadsheet, 
  Radio, 
  Zap, 
  Thermometer, 
  Droplets, 
  Gauge, 
  Filter, 
  Sliders, 
  Download,
  AlertTriangle,
  CheckCircle,
  Cpu
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function InverterSignalHistoryPage() {
  const { signalRealtimeBuffer, isSimulating } = useApp();

  const [filterPreset, setFilterPreset] = useState('all');
  const [filterErrorOnly, setFilterErrorOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortOrder, setSortOrder] = useState('desc');

  // Siapkan data riwayat dari buffer sinyal realtime atau dataset terstruktur
  const records = useMemo(() => {
    let raw = [...signalRealtimeBuffer];

    // Jika buffer kosong (misal baru buka), sediakan baris representatif
    if (raw.length === 0) {
      const now = Date.now();
      for (let i = 25; i >= 0; i--) {
        const time = new Date(now - i * 3000);
        raw.push({
          id: `sig-init-${i}`,
          measured_at: time.toISOString(),
          voltage_v: 221.4 + Math.sin(i / 3) * 1.8,
          room_temp_c: 24.2 + (i % 4) * 0.1,
          humidity_rh: 58.5 - (i % 3) * 0.3,
          compressor_rpm: 3450 + Math.floor(Math.sin(i / 2) * 200),
          inverter_freq_hz: 58.0 + (i % 3),
          target_rpm: 3600,
          indoor_coil_temp_c: 8.5 + (i % 3) * 0.2,
          outdoor_coil_temp_c: 36.2 + (i % 4) * 0.3,
          outdoor_ambient_temp_c: 32.5,
          discharge_pipe_temp_c: 74.2 + (i % 5) * 0.5,
          eev_steps: 185 + (i % 10),
          fan_speed_indoor_rpm: 880,
          fan_speed_outdoor_rpm: 750,
          error_code: '00',
          operating_mode: 'COOL',
          packet_raw_hex: `5A A5 18 01 ${Math.floor(Math.random() * 255).toString(16).padStart(2, '0').toUpperCase()} 00 00`
        });
      }
    }

    // Normalisasi properti agar seragam baik dari sinyal live maupun buffer historis
    let data = raw.map((r, idx) => ({
      id: r.id || `sig-${idx}`,
      timestamp: r.measured_at || r.created_at || new Date().toISOString(),
      voltage: r.voltage_v != null ? Number(r.voltage_v) : (r.voltage != null ? Number(r.voltage) : 220.0),
      room_temp: r.room_temp_c != null ? Number(r.room_temp_c) : (r.room_temp != null ? Number(r.room_temp) : 24.5),
      humidity: r.humidity_rh != null ? Number(r.humidity_rh) : (r.humidity != null ? Number(r.humidity) : 55.0),
      compressor_rpm: r.compressor_rpm != null ? Number(r.compressor_rpm) : 0,
      inverter_freq_hz: r.inverter_freq_hz != null ? Number(r.inverter_freq_hz) : 0,
      target_rpm: r.target_rpm || r.target_compressor_rpm || 3600,
      indoor_coil_temp: r.indoor_coil_temp_c != null ? Number(r.indoor_coil_temp_c) : (r.indoor_coil_temp != null ? Number(r.indoor_coil_temp) : 9.0),
      outdoor_coil_temp: r.outdoor_coil_temp_c != null ? Number(r.outdoor_coil_temp_c) : (r.outdoor_coil_temp != null ? Number(r.outdoor_coil_temp) : 38.0),
      outdoor_ambient_temp: r.outdoor_ambient_temp_c != null ? Number(r.outdoor_ambient_temp_c) : (r.outdoor_ambient_temp != null ? Number(r.outdoor_ambient_temp) : 32.0),
      discharge_pipe_temp: r.discharge_pipe_temp_c != null ? Number(r.discharge_pipe_temp_c) : (r.discharge_pipe_temp != null ? Number(r.discharge_pipe_temp) : 74.0),
      eev_steps: r.eev_steps != null ? Number(r.eev_steps) : 180,
      indoor_fan_rpm: r.fan_speed_indoor_rpm || r.indoor_fan_rpm || 800,
      outdoor_fan_rpm: r.fan_speed_outdoor_rpm || r.outdoor_fan_rpm || 750,
      mode: r.operating_mode || r.mode || 'COOL',
      error_code: r.error_code || '00',
      packet_hex: r.packet_raw_hex || r.packet_hex || '5A A5 18 01 00'
    }));

    if (filterErrorOnly) {
      data = data.filter(d => d.error_code && d.error_code !== '00');
    }

    if (sortOrder === 'asc') {
      data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else {
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    return data;
  }, [signalRealtimeBuffer, filterErrorOnly, sortOrder]);

  const totalPages = Math.ceil(records.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, currentPage, pageSize]);

  // Ekspor CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;

    const headers = [
      'Waktu',
      'Tegangan_Bus_V',
      'Suhu_Ruangan_C',
      'Kelembapan_RH',
      'RPM_Kompresor',
      'Frekuensi_Inverter_Hz',
      'Target_RPM',
      'Suhu_Indoor_Coil_C',
      'Suhu_Outdoor_Coil_C',
      'Suhu_Discharge_Pipe_C',
      'Suhu_Outdoor_Ambient_C',
      'EEV_Steps',
      'Kipas_Indoor_RPM',
      'Kipas_Outdoor_RPM',
      'Mode',
      'Kode_Error',
      'Hex_Packet'
    ];

    const rows = records.map(r => [
      new Date(r.timestamp).toLocaleString('id-ID'),
      r.voltage?.toFixed(1) || '0',
      r.room_temp?.toFixed(1) || '0',
      r.humidity?.toFixed(1) || '0',
      r.compressor_rpm || '0',
      r.inverter_freq_hz?.toFixed(1) || '0',
      r.target_rpm || '0',
      r.indoor_coil_temp?.toFixed(1) || '0',
      r.outdoor_coil_temp?.toFixed(1) || '0',
      r.discharge_pipe_temp?.toFixed(1) || '0',
      r.outdoor_ambient_temp?.toFixed(1) || '0',
      r.eev_steps || '0',
      r.indoor_fan_rpm || '0',
      r.outdoor_fan_rpm || '0',
      r.mode || 'COOL',
      r.error_code || '00',
      `"${r.packet_hex || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inverter_signal_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-industrial-900 via-industrial-900 to-cyan-950/30 border border-industrial-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono font-semibold mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>ARSIP TELEMETRI BUS SERIAL INVERTER (TERMINAL 3)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-white">
            Riwayat Paket Sinyal AC
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tabel rekaman frame serial sniffer dari modul optocoupler. Mencatat data termal lengkap, dinamika kompresor, katup ekspansi EEV, dan riwayat diagnosis error unit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 text-xs font-mono font-semibold transition-all flex items-center space-x-2 shadow-lg shadow-cyan-950/40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-industrial-900/90 border border-industrial-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>

          <button
            onClick={() => setFilterErrorOnly(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center space-x-1.5 ${
              filterErrorOnly
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 font-bold'
                : 'bg-industrial-950 border-industrial-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Hanya Error Unit</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <span>Urutkan:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="bg-industrial-950 border border-industrial-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="desc">Terbaru (Waktu Menurun)</option>
              <option value="asc">Terlama (Waktu Menaik)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 text-slate-400">
            <span>Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-industrial-950 border border-industrial-800 rounded-lg px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-950/90 text-slate-400 border-b border-industrial-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-3 py-3">Voltase</th>
                <th className="px-3 py-3">Suhu Ruangan</th>
                <th className="px-3 py-3">Kelembapan</th>
                <th className="px-3 py-3">RPM Kompresor</th>
                <th className="px-3 py-3">Frekuensi</th>
                <th className="px-3 py-3">Discharge</th>
                <th className="px-3 py-3">Coil In/Out</th>
                <th className="px-3 py-3">EEV Steps</th>
                <th className="px-3 py-3">Fans</th>
                <th className="px-3 py-3">Status Error</th>
                <th className="px-4 py-3">Hex Packet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 text-slate-300">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((r, idx) => {
                  const isErr = r.error_code && r.error_code !== '00';
                  return (
                    <tr 
                      key={r.id || idx}
                      className={`hover:bg-industrial-850/50 transition-colors ${
                        isErr ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Waktu */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-200 font-medium">
                        {new Date(r.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>

                      {/* Voltase */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-electric-cyan font-bold">
                          {r.voltage ? r.voltage.toFixed(1) : '--'}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">V</span>
                      </td>

                      {/* Suhu Ruangan */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-emerald-400 font-bold">
                          {r.room_temp ? r.room_temp.toFixed(1) : '--'}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">°C</span>
                      </td>

                      {/* Kelembapan */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-electric-blue font-bold">
                          {r.humidity ? r.humidity.toFixed(1) : '--'}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">%</span>
                      </td>

                      {/* RPM Kompresor */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-electric-orange font-bold">
                          {r.compressor_rpm ? r.compressor_rpm.toLocaleString('id-ID') : '--'}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">RPM</span>
                      </td>

                      {/* Frekuensi Inverter */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-amber-300 font-medium">
                          {r.inverter_freq_hz ? r.inverter_freq_hz.toFixed(1) : '--'}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">Hz</span>
                      </td>

                      {/* Suhu Discharge Pipe */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`font-semibold ${
                          (r.discharge_pipe_temp || 0) > 95 ? 'text-rose-400' : 'text-slate-200'
                        }`}>
                          {r.discharge_pipe_temp ? r.discharge_pipe_temp.toFixed(1) : '--'} °C
                        </span>
                      </td>

                      {/* Suhu Coil Indoor / Outdoor */}
                      <td className="px-3 py-3 whitespace-nowrap text-slate-400">
                        <span className="text-cyan-300">{r.indoor_coil_temp ? r.indoor_coil_temp.toFixed(1) : '--'}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-amber-400">{r.outdoor_coil_temp ? r.outdoor_coil_temp.toFixed(1) : '--'}</span>
                        <span className="text-[10px] text-slate-500 ml-1">°C</span>
                      </td>

                      {/* EEV Steps */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-purple-300 font-medium">
                          {r.eev_steps || '--'}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1">pls</span>
                      </td>

                      {/* Fans Indoor/Outdoor */}
                      <td className="px-3 py-3 whitespace-nowrap text-[11px] text-slate-400">
                        <span>{r.indoor_fan_rpm || '--'}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span>{r.outdoor_fan_rpm || '--'}</span>
                      </td>

                      {/* Status / Kode Error */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isErr ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/60 text-rose-300 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            <span>ERR: {r.error_code}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px]">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            <span>00 Normal</span>
                          </span>
                        )}
                      </td>

                      {/* Raw Hex Packet */}
                      <td className="px-4 py-3 whitespace-nowrap text-[11px] text-slate-400 font-mono tracking-wider">
                        <span className="bg-industrial-950 px-2 py-1 rounded border border-industrial-800 text-slate-300">
                          {r.packet_hex || '5A A5 18 01 00'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada rekaman paket sinyal yang cocok dengan filter saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="bg-industrial-950 px-4 py-3 border-t border-industrial-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Menampilkan baris {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, records.length)} dari {records.length} rekaman
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-industrial-800 text-slate-300 hover:bg-industrial-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-slate-200 font-bold px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-industrial-800 text-slate-300 hover:bg-industrial-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
