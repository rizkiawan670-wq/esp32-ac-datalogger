// ============================================================================
// DASHBOARD PAGE (AC DATALOGGER TELEMETRI)
// Tampilan dashboard ringkas, bersih & fokus:
// 1. Indikator Sensor (StatusCards: Tegangan RMS, Suhu, Kelembapan, Titik Embun)
// 2. Grafik Monitoring Terpadu (RealtimeCharts: Multi-Series Realtime)
// ============================================================================

import React from 'react';
import StatusCards from '../components/StatusCards';
import RealtimeCharts from '../components/RealtimeCharts';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* 1. INDIKATOR SENSOR (TEGANGAN RMS, SUHU, KELEMBAPAN, TITIK EMBUN) */}
      <section aria-label="Indikator Sensor Utama AC">
        <StatusCards />
      </section>

      {/* 2. GRAFIK MONITORING TERPADU */}
      <section aria-label="Grafik Monitoring Utama Terpadu">
        <RealtimeCharts />
      </section>
    </div>
  );
}
