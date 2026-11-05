// ============================================================================
// APP ROOT COMPONENT
// ESP32 AC Datalogger Online & Inverter Signal Bus Platform
// Mendukung Autentikasi Multi-Akun (Proyek 1 Datalogger vs Proyek 2 Inverter Signal)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';

// Halaman Proyek 1 (Datalogger Listrik True-RMS & SHT31)
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import AnalysisPage from './pages/AnalysisPage';
import DevicesPage from './pages/DevicesPage';

// Halaman Proyek 2 (Inverter Signal Bus Analyzer Terminal 3)
import InverterSignalDashboardPage from './pages/InverterSignalDashboardPage';
import SensorComparisonPage from './pages/SensorComparisonPage';
import InverterSignalHistoryPage from './pages/InverterSignalHistoryPage';

// Halaman Bersama (Shared across projects)
import AiDiagnosticsPage from './pages/AiDiagnosticsPage';
import SettingsPage from './pages/SettingsPage';
import GuidePage from './pages/GuidePage';

function MainLayout() {
  const { currentUser } = useApp();
  const isProjectInverter = currentUser?.role === 'inverter';

  // Set tab awal sesuai akun yang sedang login
  const [currentTab, setCurrentTab] = useState(() => {
    return isProjectInverter ? 'signal-dashboard' : 'dashboard';
  });

  // Sinkronisasi tab jika pengguna berganti akun/proyek
  useEffect(() => {
    if (isProjectInverter) {
      setCurrentTab(prev => {
        const validInverterTabs = [
          'signal-dashboard', 
          'sensor-comparison', 
          'signal-history', 
          'ai-diagnostics', 
          'settings', 
          'guide'
        ];
        return validInverterTabs.includes(prev) ? prev : 'signal-dashboard';
      });
    } else {
      setCurrentTab(prev => {
        const validDataloggerTabs = [
          'dashboard', 
          'history', 
          'analysis', 
          'ai-diagnostics', 
          'devices', 
          'settings', 
          'guide'
        ];
        return validDataloggerTabs.includes(prev) ? prev : 'dashboard';
      });
    }
  }, [isProjectInverter]);

  // Jika belum login, tampilkan layar pemilihan akun & login terlebih dahulu
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-industrial-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header Industri Dinamis */}
      <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Konten Halaman Berdasarkan Tab Aktif */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* --- TAMPILAN PROYEK 2: INVERTER SIGNAL BUS ANALYZER --- */}
        {isProjectInverter ? (
          <>
            {currentTab === 'signal-dashboard' && <InverterSignalDashboardPage />}
            {currentTab === 'sensor-comparison' && <SensorComparisonPage />}
            {currentTab === 'signal-history' && <InverterSignalHistoryPage />}
            {currentTab === 'ai-diagnostics' && <AiDiagnosticsPage />}
            {currentTab === 'settings' && <SettingsPage />}
            {currentTab === 'guide' && <GuidePage />}
          </>
        ) : (
          /* --- TAMPILAN PROYEK 1: AC DATALOGGER TRUE-RMS & SHT31 --- */
          <>
            {currentTab === 'dashboard' && <DashboardPage />}
            {currentTab === 'history' && <HistoryPage />}
            {currentTab === 'analysis' && <AnalysisPage />}
            {currentTab === 'ai-diagnostics' && <AiDiagnosticsPage />}
            {currentTab === 'devices' && <DevicesPage />}
            {currentTab === 'settings' && <SettingsPage />}
            {currentTab === 'guide' && <GuidePage />}
          </>
        )}

      </main>

      {/* Footer Industrial Dark Mode */}
      <footer className="border-t border-industrial-800 bg-industrial-900/60 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-2">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${isProjectInverter ? 'bg-cyan-400' : 'bg-electric-amber'}`}></span>
            <span className="text-slate-200 font-semibold">
              {isProjectInverter ? 'Inverter Signal Bus Telemetry Platform' : 'ESP32 AC Datalogger Online'}
            </span>
            <span>•</span>
            <span className="text-slate-400">
              {isProjectInverter ? 'Sharp AH-XP13DPY / Universal Protocol' : 'Firmware v1.0 (True-RMS ZMPT101B & SHT31)'}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span>Supabase Realtime</span>
            <span>•</span>
            <span>Dual Telemetry Pipeline</span>
            <span>•</span>
            <span>Netlify Production</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
