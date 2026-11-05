// ============================================================================
// AC PERFORMANCE & ELECTRICAL ANALYTICS UTILITY
// Menyediakan kalkulasi statistik, deteksi anomali jala-jala listrik PLN,
// indikator termal, dan perhitungan titik embun (dew point).
// ============================================================================

/**
 * Menghitung titik embun (Dew Point, °C) menggunakan rumus Magnus-Tetens
 * Digunakan teknisi AC untuk memprediksi kondensasi pipa dan evaporator
 */
export function calculateDewPoint(tempC, humidityRH) {
  if (tempC === null || humidityRH === null || humidityRH <= 0) return null;
  const a = 17.625;
  const b = 243.04;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidityRH / 100);
  const dewPoint = (b * alpha) / (a - alpha);
  return Math.round(dewPoint * 10) / 10;
}

/**
 * Menghitung ringkasan statistik (Min, Max, Avg, StdDev) dari dataset telemetri AC
 */
export function calculateStatistics(readings, lowThreshold = 198.0, highThreshold = 242.0) {
  if (!readings || readings.length === 0) {
    return {
      count: 0,
      validVCount: 0,
      voltage: { min: 0, max: 0, avg: 0, stdDev: 0, sags: 0, swells: 0, stabilityIndex: 100 },
      temperature: { min: 0, max: 0, avg: 0, delta: 0 },
      humidity: { min: 0, max: 0, avg: 0 },
      significantEvents: []
    };
  }

  let sumV = 0, sumT = 0, sumH = 0;
  let minV = Infinity, maxV = -Infinity;
  let minT = Infinity, maxT = -Infinity;
  let minH = Infinity, maxH = -Infinity;
  let sags = 0, swells = 0;
  let validVCount = 0;

  const validVoltages = [];

  for (let i = 0; i < readings.length; i++) {
    const r = readings[i];
    const v = r.voltage_v !== null && r.voltage_v !== undefined ? Number(r.voltage_v) : (r.voltage_rms !== null && r.voltage_rms !== undefined ? Number(r.voltage_rms) : null);
    const t = r.temperature_c !== null && r.temperature_c !== undefined ? Number(r.temperature_c) : null;
    const h = r.humidity_rh !== null && r.humidity_rh !== undefined ? Number(r.humidity_rh) : null;

    // Statistik Tegangan
    if (v !== null && !isNaN(v) && v > 10) {
      sumV += v;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
      validVoltages.push(v);
      validVCount++;

      // Deteksi Sag (tegangan anjlok di bawah batas SPLN)
      if (v < lowThreshold) sags++;
      // Deteksi Swell (tegangan melonjak di atas batas SPLN)
      if (v > highThreshold) swells++;
    }

    // Statistik Suhu
    if (t !== null && !isNaN(t)) {
      sumT += t;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }

    // Statistik Kelembapan
    if (h !== null && !isNaN(h)) {
      sumH += h;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
  }

  const count = readings.length;
  const avgV = validVCount > 0 ? sumV / validVCount : 0;
  const avgT = count > 0 ? sumT / count : 0;
  const avgH = count > 0 ? sumH / count : 0;

  // Standar deviasi tegangan
  let varianceV = 0;
  if (validVCount > 1) {
    const sumSqDiff = validVoltages.reduce((acc, val) => acc + Math.pow(val - avgV, 2), 0);
    varianceV = sumSqDiff / (validVCount - 1);
  }
  const stdDevV = Math.sqrt(varianceV);

  // Indeks stabilitas tegangan PLN (% pembacaan dalam toleransi normal)
  const abnormalCount = sags + swells;
  const stabilityIndex = validVCount > 0 
    ? Math.max(0, Math.round(((validVCount - abnormalCount) / validVCount) * 100))
    : 100;

  // Deteksi lonjakan drastis / anomali transien (Significant Events)
  const significantEvents = [];
  for (let i = 1; i < readings.length; i++) {
    const curr = readings[i];
    const prev = readings[i - 1];

    const curV = curr.voltage_v !== null && curr.voltage_v !== undefined ? Number(curr.voltage_v) : Number(curr.voltage_rms || 0);
    const preV = prev.voltage_v !== null && prev.voltage_v !== undefined ? Number(prev.voltage_v) : Number(prev.voltage_rms || 0);

    if (curV > 10 && preV > 10) {
      const deltaV = Math.abs(curV - preV);
      if (deltaV >= 8.0) { // Perubahan >= 8V dalam 1 interval
        significantEvents.push({
          time: curr.measured_at || curr.created_at,
          type: 'VOLTAGE_FLUCTUATION',
          description: `Perubahan tegangan tajam: ${preV.toFixed(1)}V → ${curV.toFixed(1)}V (Δ${deltaV.toFixed(1)}V)`,
          severity: deltaV >= 15 ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    const curT = curr.temperature_c !== null && curr.temperature_c !== undefined ? Number(curr.temperature_c) : null;
    const preT = prev.temperature_c !== null && prev.temperature_c !== undefined ? Number(prev.temperature_c) : null;

    if (curT !== null && preT !== null) {
      const deltaT = Math.abs(curT - preT);
      if (deltaT >= 1.5) { // Perubahan suhu >= 1.5°C mendadak
        significantEvents.push({
          time: curr.measured_at || curr.created_at,
          type: 'TEMP_SURGE',
          description: `Perubahan suhu signifikan: ${preT.toFixed(1)}°C → ${curT.toFixed(1)}°C`,
          severity: 'INFO'
        });
      }
    }
  }

  return {
    count,
    validVCount,
    voltage: {
      min: minV === Infinity ? 0 : Math.round(minV * 10) / 10,
      max: maxV === -Infinity ? 0 : Math.round(maxV * 10) / 10,
      avg: Math.round(avgV * 10) / 10,
      stdDev: Math.round(stdDevV * 100) / 100,
      sags,
      swells,
      stabilityIndex
    },
    temperature: {
      min: minT === Infinity ? 0 : Math.round(minT * 10) / 10,
      max: maxT === -Infinity ? 0 : Math.round(maxT * 10) / 10,
      avg: Math.round(avgT * 10) / 10,
      delta: minT !== Infinity && maxT !== -Infinity ? Math.round((maxT - minT) * 10) / 10 : 0
    },
    humidity: {
      min: minH === Infinity ? 0 : Math.round(minH * 10) / 10,
      max: maxH === -Infinity ? 0 : Math.round(maxH * 10) / 10,
      avg: Math.round(avgH * 10) / 10
    },
    significantEvents: significantEvents.slice(-10) // Ambil 10 kejadian terakhir
  };
}

/**
 * Format detik menjadi format human readable (e.g. 10m 25s atau 1j 15m)
 */
export function formatSecondsToTime(seconds) {
  if (!seconds || seconds <= 0) return '0 dtk';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) return `${h}j ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s} dtk`;
}
