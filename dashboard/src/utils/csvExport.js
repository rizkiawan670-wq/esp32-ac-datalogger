// ============================================================================
// CSV EXPORT UTILITY
// Format ekspor CSV yang kompatibel penuh dengan Microsoft Excel
// Menggunakan BOM UTF-8 (\uFEFF) untuk karakter derajat °C dan simbol lainnya
// ============================================================================

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
    'Sumber Data'
  ];

  const rows = records.map((r) => {
    const dateObj = new Date(r.measured_at || r.recorded_at || r.created_at);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toISOString().replace('T', ' ').substring(0, 19)
      : String(r.measured_at || r.recorded_at);

    const voltageVal = r.voltage_v !== null && r.voltage_v !== undefined 
      ? Number(r.voltage_v).toFixed(2) 
      : '0.00';

    const validationStatus = r.voltage_valid 
      ? 'VALID' 
      : 'TIDAK VALID / BELUM KALIBRASI';

    const tempVal = r.temperature_c !== null && r.temperature_c !== undefined 
      ? Number(r.temperature_c).toFixed(2) 
      : '0.00';

    const humVal = r.humidity_rh !== null && r.humidity_rh !== undefined 
      ? Number(r.humidity_rh).toFixed(2) 
      : '0.00';

    const source = r.is_simulated || r.data_source === 'SIMULATOR' ? 'SIMULATOR' : 'REAL SENSOR';

    return [
      escapeCSV(formattedDate),
      escapeCSV(r.device_id || 'esp32-ac-01'),
      escapeCSV(voltageVal),
      escapeCSV(validationStatus),
      escapeCSV(tempVal),
      escapeCSV(humVal),
      escapeCSV(source)
    ].join(',');
  });

  const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  triggerDownload(csvContent, filename);
}

/**
 * Mengonversi array objek pembacaan RPM Kompresor menjadi file CSV
 * @param {Array} records - Array objek telemetri compressor_rpm_measurements
 * @param {string} filename - Nama file output
 */
export function exportRpmToCSV(records, filename = 'compressor_rpm_telemetry.csv') {
  if (!records || records.length === 0) {
    alert('Tidak ada data RPM untuk diekspor.');
    return;
  }

  const headers = [
    'Timestamp',
    'Device ID',
    'Estimated RPM',
    'Status Kompresor',
    'Kategori Kecepatan',
    'Arah Perubahan (Trend)',
    'Kanal Fasa',
    'Total Pulsa',
    'Interval Pulsa (µs)',
    'Status Sinyal',
    'Status Kalibrasi',
    'Sumber Data'
  ];

  const rows = records.map((r) => {
    const dateObj = new Date(r.recorded_at || r.measured_at || r.created_at);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toISOString().replace('T', ' ').substring(0, 19)
      : String(r.recorded_at || r.measured_at);

    return [
      escapeCSV(formattedDate),
      escapeCSV(r.device_id || 'esp32-ac-01'),
      escapeCSV(r.estimated_rpm !== undefined ? Math.round(Number(r.estimated_rpm)) : 0),
      escapeCSV(r.compressor_status || (r.estimated_rpm < 400 ? 'OFF' : 'RUNNING')),
      escapeCSV(r.speed_category || 'OFF'),
      escapeCSV(r.speed_trend || 'STABLE'),
      escapeCSV(r.sensor_channel || 'U'),
      escapeCSV(r.pulse_count ?? 0),
      escapeCSV(r.pulse_interval ? `${r.pulse_interval} µs` : '0'),
      escapeCSV(r.signal_status || 'VALID'),
      escapeCSV(r.calibration_status || 'UNCALIBRATED'),
      escapeCSV(r.data_source || (r.is_simulated ? 'SIMULATOR' : 'REAL'))
    ].join(',');
  });

  const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  triggerDownload(csvContent, filename);
}

/**
 * Mengonversi gabungan data telemetri AC & RPM Kompresor menjadi file CSV komprehensif
 */
export function exportCombinedTelemetryToCSV(records, filename = 'inverter_analyzer_full_telemetry.csv') {
  if (!records || records.length === 0) {
    alert('Tidak ada data untuk diekspor.');
    return;
  }

  const headers = [
    'Timestamp',
    'Device ID',
    'Tegangan AC (V RMS)',
    'Suhu (°C)',
    'Kelembapan (%RH)',
    'Estimated RPM Kompresor',
    'Status Kompresor',
    'Kategori Kecepatan',
    'Trend RPM',
    'Kanal Sensor',
    'Status Sinyal Sensor',
    'Status Kalibrasi RPM',
    'Sumber Data'
  ];

  const rows = records.map((r) => {
    const dateObj = new Date(r.recorded_at || r.measured_at || r.created_at);
    const formattedDate = !isNaN(dateObj.getTime())
      ? dateObj.toISOString().replace('T', ' ').substring(0, 19)
      : String(r.recorded_at || r.measured_at);

    return [
      escapeCSV(formattedDate),
      escapeCSV(r.device_id || 'esp32-ac-01'),
      escapeCSV(r.voltage_v !== undefined ? Number(r.voltage_v).toFixed(2) : '--'),
      escapeCSV(r.temperature_c !== undefined ? Number(r.temperature_c).toFixed(2) : '--'),
      escapeCSV(r.humidity_rh !== undefined ? Number(r.humidity_rh).toFixed(2) : '--'),
      escapeCSV(r.estimated_rpm !== undefined ? Math.round(Number(r.estimated_rpm)) : (r.rpm !== undefined ? r.rpm : '--')),
      escapeCSV(r.compressor_status || (Number(r.estimated_rpm || r.rpm || 0) < 400 ? 'OFF' : 'RUNNING')),
      escapeCSV(r.speed_category || r.category || '--'),
      escapeCSV(r.speed_trend || r.trend || '--'),
      escapeCSV(r.sensor_channel || 'U'),
      escapeCSV(r.signal_status || 'VALID'),
      escapeCSV(r.calibration_status || 'UNCALIBRATED'),
      escapeCSV(r.data_source || (r.is_simulated ? 'SIMULATOR' : 'REAL'))
    ].join(',');
  });

  const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
  triggerDownload(csvContent, filename);
}
