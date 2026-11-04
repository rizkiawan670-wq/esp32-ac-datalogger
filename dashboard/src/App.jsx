// ============================================================================
// APP ROOT COMPONENT
// ESP32 AC Datalogger Online - Industrial Monitoring Frontend
// ============================================================================

import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import AnalysisPage from './pages/AnalysisPage';
import DevicesPage from './pages/DevicesPage';
import SettingsPage from './pages/SettingsPage';
import GuidePage from './pages/GuidePage';
import { Activity, ShieldCheck, Heart } from 'lucide-react';

function MainLayout() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-industrial-950 text-slate-100 flex flex-col font-sans">
      
      {/* Header Utama */}
      <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Konten Halaman */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && <DashboardPage />}
        {currentTab === 'history' && <HistoryPage />}
        {currentTab === 'analysis' && <AnalysisPage />}
        {currentTab === 'devices' && <DevicesPage />}
        {currentTab === 'settings' && <SettingsPage />}
        {currentTab === 'guide' && <GuidePage />}
      </main>

      {/* Footer Industrial Dark Mode */}
      <footer className="border-t border-industrial-800 bg-industrial-900/60 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-400 gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-electric-amber"></span>
            <span>ESP32 AC Datalogger Online</span>
            <span>•</span>
            <span className="text-slate-400">Firmware v1.0 (True-RMS & SHT31)</span>
          </div>

          <div className="flex items-center space-x-3 text-slate-400">
            <span>Supabase Edge Functions</span>
            <span>•</span>
            <span>PostgreSQL Realtime</span>
            <span>•</span>
            <span>Netlify Ready</span>
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
