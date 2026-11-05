// ============================================================================
// CSV EXPORT UTILITY
// Format ekspor CSV yang kompatibel penuh dengan Microsoft Excel
// Menggunakan BOM UTF-8 (\uFEFF) untuk karakter derajat °C dan simbol lainnya
// ============================================================================

import { calculateDewPoint } from './analytics';

// Helper untuk escape nilai CSV (jika ada koma, kutip dua, atau baris baru)
function escapeCSV(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

// Helper untuk mentrigger download CSV di browser
function triggerDownload(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Mengonversi array objek pembacaan AC menjadi file CSV dan memicu download browser
 * @param {Array} records - Array objek telemetri ac_readings
 * @param {string} filename - Nama file output
 */
export function exportReadingsToCSV(records, filename = 'esp32_ac_telemetry.csv') {
  if (!records || records.length === 0) {
    alert('Tidak ada data untuk diekspor.');
    return;
  }

  const headers = [
    'Timestamp',
    'Device ID',
    'Tegangan AC (V RMS)',
    'Status Validasi Tegangan',
    'Suhu (°C)',
    'Kelembapan (%RH)',
    'Titik Embun (°C)',
    'Sumber Data'
  ];

  const rows = records.map((r) => {
    const dateObj = new Date(r.measured_at || r.recorded_at || r.created_at);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toISOString().replace('T', ' ').substring(0, 19)
      : String(r.measured_at || r.recorded_at);

    const voltageVal = r.voltage_v !== null && r.voltage_v !== undefined 
      ? Number(r.voltage_v).toFixed(2) 
      : (r.voltage_rms !== null && r.voltage_rms !== undefined ? Number(r.voltage_rms).toFixed(2) : '0.00');

    const validationStatus = r.voltage_valid 
      ? 'VALID' 
      : 'NORMAL';

    const tempVal = r.temperature_c !== null && r.temperature_c !== undefined 
      ? Number(r.temperature_c).toFixed(2) 
      : null;

    const humVal = r.humidity_rh !== null && r.humidity_rh !== undefined 
      ? Number(r.humidity_rh).toFixed(2) 
      : null;

    const dp = calculateDewPoint(tempVal !== null ? Number(tempVal) : null, humVal !== null ? Number(humVal) : null);

    const source = r.is_simulated || r.data_source === 'SIMULATOR' ? 'SIMULATOR' : 'REAL SENSOR';

    return [
      escapeCSV(formattedDate),
      escapeCSV(r.device_id || 'esp32-ac-01'),
      escapeCSV(voltageVal),
      escapeCSV(validationStatus),
      escapeCSV(tempVal !== null ? tempVal : '--'),
      escapeCSV(humVal !== null ? humVal : '--'),
      escapeCSV(dp !== null ? dp.toFixed(2) : '--'),
      escapeCSV(source)
    ].join(',');
  });

  const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  triggerDownload(csvContent, filename);
}
