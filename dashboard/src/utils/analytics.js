// ============================================================================
// AC PERFORMANCE & ELECTRICAL ANALYTICS UTILITY
// Menyediakan kalkulasi statistik, deteksi anomali jala-jala listrik PLN,
// indikator termal, perhitungan titik embun (dew point),
// dan analisis perilaku kecepatan motor kompresor (COMPRESSOR RPM ANALYTICS).
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
    const v = Number(r.voltage_v);
    const t = Number(r.temperature_c);
    const h = Number(r.humidity_rh);

    // Statistik Tegangan (hanya yang bertanda valid)
    if (r.voltage_valid && !isNaN(v) && v > 0) {
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
    if (!isNaN(t)) {
      sumT += t;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }

    // Statistik Kelembapan
    if (!isNaN(h)) {
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

    if (curr.voltage_valid && prev.voltage_valid) {
      const deltaV = Math.abs(Number(curr.voltage_v) - Number(prev.voltage_v));
      if (deltaV >= 8.0) { // Perubahan >= 8V dalam 1 interval
        significantEvents.push({
          time: curr.measured_at,
          type: 'VOLTAGE_FLUCTUATION',
          description: `Perubahan tegangan tajam: ${Number(prev.voltage_v).toFixed(1)}V → ${Number(curr.voltage_v).toFixed(1)}V (Δ${deltaV.toFixed(1)}V)`,
          severity: deltaV >= 15 ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    const deltaT = Math.abs(Number(curr.temperature_c) - Number(prev.temperature_c));
    if (deltaT >= 1.5) { // Perubahan suhu >= 1.5°C mendadak
      significantEvents.push({
        time: curr.measured_at,
        type: 'TEMP_SURGE',
        description: `Perubahan suhu signifikan: ${Number(prev.temperature_c).toFixed(1)}°C → ${Number(curr.temperature_c).toFixed(1)}°C`,
        severity: 'INFO'
      });
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

/**
 * Analisis komprehensif perilaku kecepatan compressor (Section 3C & 3D)
 * Menghitung durasi LOW/MEDIUM/HIGH, persentase, min/max/avg RPM,
 * mendeteksi pola perubahan kecepatan, serta menghasilkan narasi teknisi otomatis.
 *
 * @param {Array} dataList - List data RPM terurut kronologis
 * @param {Object} profile - Profil kalibrasi kompresor aktif (rpm_low_max, rpm_medium_max, rpm_high_min)
 */
export function calculateCompressorAnalytics(dataList, profile) {
  const lowMax = profile?.rpm_low_max || 1800;
  const medMax = profile?.rpm_medium_max || 3200;
  const highMin = profile?.rpm_high_min || 3200;

  if (!dataList || dataList.length === 0) {
    return {
      isSufficient: false,
      totalSeconds: 0,
      activeSeconds: 0,
      offSeconds: 0,
      lowSeconds: 0,
      medSeconds: 0,
      highSeconds: 0,
      lowPct: 0,
      medPct: 0,
      highPct: 0,
      minRpm: 0,
      maxRpm: 0,
      avgRpm: 0,
      accelCount: 0,
      decelCount: 0,
      startStopCycles: 0,
      stabilityScore: 'STABIL',
      narrative: 'Data telemetri belum mencukupi untuk membuat kesimpulan analisis perilaku kompresor. Menunggu data pengukuran operasional.',
      behaviorFlags: {
        isAccelerating: false,
        reachedHigh: false,
        sustainingHigh: false,
        isDecelerating: false,
        isHunting: false,
        isStopped: true,
      },
      markers: []
    };
  }

  let offSec = 0;
  let lowSec = 0;
  let medSec = 0;
  let highSec = 0;
  let sumRpm = 0;
  let activeCount = 0;
  let minRpm = Infinity;
  let maxRpm = 0;
  let accelCount = 0;
  let decelCount = 0;
  let cycles = 0;
  let prevRpm = 0;
  let prevCategory = 'OFF';

  // State sequence untuk narasi otomatis
  const phaseDurations = [];
  let currentPhase = null;

  // Markers untuk grafik (waktu mulai ngebut, melambat, berhenti)
  const markers = [];

  dataList.forEach((pt, idx) => {
    const rpm = Number(pt.estimated_rpm !== undefined ? pt.estimated_rpm : pt.rpm) || 0;
    const trend = pt.speed_trend || pt.trend || (rpm === 0 ? 'STOPPED' : 'STABLE');
    const timeLabel = pt.time || (pt.recorded_at ? new Date(pt.recorded_at).toLocaleTimeString('id-ID') : `T-${idx}`);

    // Kategorisasi berdasarkan batas kalibrasi profil
    let cat = 'OFF';
    if (rpm < 400) {
      cat = 'OFF';
      offSec++;
    } else {
      activeCount++;
      sumRpm += rpm;
      if (rpm < minRpm) minRpm = rpm;
      if (rpm > maxRpm) maxRpm = rpm;

      if (rpm <= lowMax) {
        cat = 'LOW';
        lowSec++;
      } else if (rpm <= medMax) {
        cat = 'MEDIUM';
        medSec++;
      } else {
        cat = 'HIGH';
        highSec++;
      }
    }

    if (trend === 'ACCELERATING') accelCount++;
    if (trend === 'DECELERATING') decelCount++;

    // Deteksi siklus start-stop
    if (cat !== 'OFF' && prevCategory === 'OFF' && idx > 0) {
      cycles++;
    }

    // Deteksi marker kejadian (mulai ngebut, melambat, berhenti)
    if (idx > 0) {
      if (prevCategory !== 'HIGH' && cat === 'HIGH') {
        markers.push({
          type: 'HIGH_REACHED',
          label: 'Mulai Ngebut (HIGH)',
          time: timeLabel,
          rpm,
          color: '#ef4444'
        });
      } else if (prevRpm > medMax && rpm <= medMax && trend === 'DECELERATING') {
        markers.push({
          type: 'DECEL_START',
          label: 'Melambat (Deselerasi)',
          time: timeLabel,
          rpm,
          color: '#06b6d4'
        });
      } else if (prevRpm >= 400 && rpm < 400) {
        markers.push({
          type: 'STOPPED',
          label: 'Kompresor Berhenti',
          time: timeLabel,
          rpm,
          color: '#94a3b8'
        });
      }
    }

    // Pelacakan urutan fase operasional
    if (!currentPhase || currentPhase.category !== cat) {
      if (currentPhase) {
        phaseDurations.push({ ...currentPhase });
      }
      currentPhase = {
        category: cat,
        seconds: 1,
        avgRpm: rpm,
        startRpm: rpm,
        endRpm: rpm
      };
    } else {
      currentPhase.seconds += 1;
      currentPhase.avgRpm = (currentPhase.avgRpm * (currentPhase.seconds - 1) + rpm) / currentPhase.seconds;
      currentPhase.endRpm = rpm;
    }

    prevRpm = rpm;
    prevCategory = cat;
  });

  if (currentPhase) {
    phaseDurations.push(currentPhase);
  }

  const totalSec = dataList.length;
  const avgRpm = activeCount > 0 ? Math.round(sumRpm / activeCount) : 0;
  const finalMinRpm = minRpm === Infinity ? 0 : minRpm;

  // Persentase durasi terhadap total waktu aktif
  const lowPct = activeCount > 0 ? Math.round((lowSec / activeCount) * 100) : 0;
  const medPct = activeCount > 0 ? Math.round((medSec / activeCount) * 100) : 0;
  const highPct = activeCount > 0 ? Math.round((highSec / activeCount) * 100) : 0;

  // Evaluasi stabilitas
  let stability = 'STABIL';
  const isHunting = (accelCount + decelCount) > (activeCount * 0.35) && activeCount >= 15;
  if (isHunting) {
    stability = 'PERUBAHAN BERULANG (HUNTING / FLUKTUATIF)';
  } else if (cycles >= 4 && activeCount < 300) {
    stability = 'SHORT CYCLING (SERING MATI-HIDUP)';
  }

  // Evaluasi perilaku compressor saat ini & historis
  const latestPt = dataList[dataList.length - 1];
  const latestRpm = Number(latestPt?.estimated_rpm !== undefined ? latestPt.estimated_rpm : latestPt?.rpm) || 0;
  const latestTrend = latestPt?.speed_trend || latestPt?.trend || 'STOPPED';

  const behaviorFlags = {
    isAccelerating: latestTrend === 'ACCELERATING',
    reachedHigh: latestRpm >= highMin || highSec > 0,
    sustainingHigh: highSec >= 60, // Mempertahankan kecepatan tinggi minimal 1 menit
    isDecelerating: latestTrend === 'DECELERATING',
    isHunting,
    isStopped: latestRpm < 400 || latestPt?.compressor_status === 'OFF',
  };

  // --------------------------------------------------------------------------
  // GENERATOR RINGKASAN NARATIF OTOMATIS BERDASARKAN DATA SEBENARNYA
  // --------------------------------------------------------------------------
  const isSufficient = activeCount >= 10 || totalSec >= 20;
  let narrative = '';

  if (!isSufficient) {
    narrative = 'Data telemetri belum mencukupi untuk membuat kesimpulan analisis perilaku kompresor. Diperlukan minimal observasi kompresor beroperasi beberapa menit.';
  } else {
    // Bangun narasi teknisi berdasarkan fase operasional
    const sentences = [];

    // 1. Ringkasan durasi awal dan kategori kerja
    if (activeCount === 0) {
      sentences.push(`Kompresor tercatat dalam kondisi mati (OFF) selama keseluruhan ${formatSecondsToTime(offSec)} pengamatan.`);
    } else {
      const activePhases = phaseDurations.filter(p => p.category !== 'OFF');
      
      if (activePhases.length === 1) {
        const single = activePhases[0];
        sentences.push(`Kompresor bekerja stabil pada kategori ${single.category} (~${Math.round(single.avgRpm)} RPM) selama ${formatSecondsToTime(single.seconds)} tanpa perubahan kecepatan signifikan.`);
      } else {
        // Ambil urutan penting
        const prominentParts = [];
        if (lowSec > 0) prominentParts.push(`kecepatan LOW selama ${formatSecondsToTime(lowSec)}`);
        if (medSec > 0) prominentParts.push(`kecepatan MEDIUM selama ${formatSecondsToTime(medSec)}`);
        if (highSec > 0) prominentParts.push(`kecepatan HIGH (ngebut) selama ${formatSecondsToTime(highSec)}`);

        if (prominentParts.length > 0) {
          sentences.push(`Kompresor beroperasi aktif dengan alokasi ${prominentParts.join(', kemudian dilanjutkan ')}.`);
        }

        // Analisis transisi kecepatan tinggi
        if (highSec > 0 && lowSec > 0) {
          sentences.push(`Terdeteksi proses peningkatan kecepatan bertahap dari putaran rendah hingga mencapai puncak ${maxRpm.toLocaleString('id-ID')} RPM (${highPct}% dari waktu aktif).`);
        } else if (highSec > (activeCount * 0.6)) {
          sentences.push(`Kompresor mempertahankan kecepatan tinggi (HIGH) secara dominan (${highPct}% durasi), mengindikasikan beban pendinginan berat atau permintaan kapasitas pendinginan maksimal.`);
        }
      }

      // Deteksi fluktuasi atau hunting
      if (isHunting) {
        sentences.push(`Perhatian: Terdeteksi fluktuasi akselerasi-deselerasi berulang (${accelCount} akselerasi, ${decelCount} deselerasi), mengindikasikan modulasi beban dinamis atau sinyal inverter tidak konstan.`);
      }

      // Deteksi stop
      if (offSec > 0 && behaviorFlags.isStopped) {
        sentences.push(`Saat ini kompresor telah berhenti berputar (0 RPM / OFF).`);
      }
    }

    narrative = sentences.join(' ');
  }

  return {
    isSufficient,
    totalSeconds: totalSec,
    activeSeconds: activeCount,
    offSeconds: offSec,
    lowSeconds: lowSec,
    medSeconds: medSec,
    highSeconds: highSec,
    lowPct,
    medPct,
    highPct,
    minRpm: finalMinRpm,
    maxRpm,
    avgRpm,
    accelCount,
    decelCount,
    startStopCycles: cycles,
    stabilityScore: stability,
    narrative,
    behaviorFlags,
    markers: markers.slice(-10) // 10 marker terakhir
  };
}
