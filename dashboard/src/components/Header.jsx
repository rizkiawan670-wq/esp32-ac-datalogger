// ============================================================================
// HEADER COMPONENT
// Tampilan header industrial dark-mode dengan:
// 1. Indikator status konektivitas, database, dan simulasi
// 2. Navigasi tab berbasis akun aktif (Datalogger Proyek 1 vs Sinyal Inverter Proyek 2)
// 3. Tombol alih proyek instan dan logout / ganti akun
// ============================================================================

import React from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Database, 
  Cpu, 
  FlaskConical, 
  LayoutDashboard, 
  History, 
  LineChart, 
  HardDrive, 
  Settings, 
  BookOpen,
  Bot,
  Radio,
  GitCompare,
  LogOut,
  ArrowRightLeft,
  User,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Header({ currentTab, setCurrentTab }) {
  const {
    currentUser,
    logout,
    switchProject,
    selectedDeviceId,
    changeSelectedDevice,
    devices,
    isDeviceOnline,
    secondsSinceLastPacket,
    dbStatus,
    isSimulating,
    toggleSimulation,
  } = useApp();

  const isProjectInverter = currentUser?.role === 'inverter';

  // Menu tab untuk Akun 1 (Datalogger Listrik True-RMS & SHT31)
  const dataloggerNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'Riwayat', icon: History },
    { id: 'analysis', label: 'Analisis', icon: LineChart },
    { id: 'ai-diagnostics', label: 'Agent AI', icon: Bot, isAi: true },
    { id: 'devices', label: 'Perangkat', icon: HardDrive },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'guide', label: 'Panduan', icon: BookOpen },
  ];

  // Menu tab untuk Akun 2 (Inverter Signal Bus Analyzer & Komparasi Sensor)
  const inverterNavItems = [
    { id: 'signal-dashboard', label: 'Dashboard Sinyal AC', icon: Radio },
    { id: 'sensor-comparison', label: 'Komparasi Sensor', icon: GitCompare },
    { id: 'signal-history', label: 'Riwayat Sinyal', icon: History },
    { id: 'ai-diagnostics', label: 'Agent AI', icon: Bot, isAi: true },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
    { id: 'guide', label: 'Panduan Sniffing', icon: BookOpen },
  ];

  const activeNavItems = isProjectInverter ? inverterNavItems : dataloggerNavItems;

  return (
    <header className="bg-industrial-900 border-b border-industrial-800 sticky top-0 z-50">
      
      {/* Top Banner: Logo, Active Account, Quick Switch, Device Picker, Live Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between py-3 gap-3">
          
          {/* Logo & Identitas Proyek */}
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border ${
              isProjectInverter
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/20 border-cyan-400/50'
                : 'bg-gradient-to-br from-electric-orange to-electric-red shadow-red-500/20 border-electric-orange/40'
            }`}>
              {isProjectInverter ? (
                <Radio className="w-5 h-5 text-white animate-pulse" />
              ) : (
                <Activity className="w-6 h-6 text-white" />
              )}
            </div>
            
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base sm:text-lg font-black tracking-wider text-white font-mono">
                  {isProjectInverter ? 'INVERTER SIGNAL BUS' : 'AC DATALOGGER'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                  isProjectInverter
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                    : 'bg-industrial-800 text-electric-amber border-electric-amber/30'
                }`}>
                  {isProjectInverter ? 'TERMINAL 3' : 'ESP32'}
                </span>
                {isSimulating && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-500/40 font-mono font-bold animate-pulse flex items-center space-x-1">
                    <FlaskConical className="w-3 h-3 mr-1" />
                    SIMULASI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isProjectInverter
                  ? 'Sniffer Serial Optocoupler Indoor-Outdoor (Sharp J-Tech Telemetri)'
                  : 'Sistem Telemetri Tegangan AC RMS, Suhu & Kelembapan'}
              </p>
            </div>
          </div>

          {/* Right Controls: Account Pill, Switch Project, Online/Offline, Simulation */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            
            {/* Active User Badge & Switch Button */}
            <div className="flex items-center space-x-1.5 bg-industrial-950 border border-industrial-800 rounded-lg p-1">
              <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-industrial-900 text-xs font-mono">
                <span className={`w-2 h-2 rounded-full ${isProjectInverter ? 'bg-cyan-400' : 'bg-electric-amber'}`}></span>
                <span className="text-slate-300 font-semibold max-w-[120px] sm:max-w-none truncate">
                  {currentUser?.name || (isProjectInverter ? 'Akun Inverter' : 'Akun Datalogger')}
                </span>
              </div>

              {/* Quick Switch Project Button */}
              <button
                onClick={() => switchProject(isProjectInverter ? 'datalogger' : 'inverter')}
                title={`Beralih langsung ke ${isProjectInverter ? 'Proyek 1 (Datalogger)' : 'Proyek 2 (Inverter Signal)'}`}
                className="px-2 py-1 rounded text-xs font-mono text-slate-400 hover:text-white hover:bg-industrial-800 transition-colors flex items-center space-x-1"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">
                  {isProjectInverter ? 'Ke Proyek 1' : 'Ke Proyek 2'}
                </span>
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Keluar / Ganti Akun"
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Device Selector Dropdown (Untuk Datalogger) */}
            {!isProjectInverter && (
              <div className="flex items-center bg-industrial-950 border border-industrial-800 rounded-lg px-2.5 py-1.5">
                <Cpu className="w-4 h-4 text-slate-400 mr-2" />
                <select
                  value={selectedDeviceId}
                  onChange={(e) => changeSelectedDevice(e.target.value)}
                  className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none cursor-pointer"
                >
                  {devices.map((dev) => (
                    <option key={dev.device_id} value={dev.device_id} className="bg-industrial-900 text-slate-200">
                      {dev.name || dev.device_id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Online/Offline Status Badge */}
            <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium ${
              isDeviceOnline
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
            }`}>
              {isDeviceOnline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ONLINE</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">OFFLINE</span>
                </>
              )}
            </div>

            {/* Database Connection Badge */}
            <div className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono ${
              dbStatus === 'connected'
                ? 'bg-industrial-950 border-emerald-500/30 text-emerald-300'
                : dbStatus === 'simulated'
                ? 'bg-industrial-950 border-purple-500/30 text-purple-300'
                : 'bg-industrial-950 border-amber-500/30 text-amber-300'
            }`} title={`Status Database: ${dbStatus}`}>
              <Database className="w-3.5 h-3.5" />
              <span className="hidden md:inline capitalize">{dbStatus}</span>
            </div>

            {/* Last Update Counter */}
            <div className="text-xs font-mono text-slate-400 bg-industrial-950 px-2.5 py-1.5 rounded-lg border border-industrial-800 hidden sm:block">
              {secondsSinceLastPacket !== null ? (
                <span>
                  <strong className="text-slate-200">{secondsSinceLastPacket}s</strong> lalu
                </span>
              ) : (
                <span className="text-slate-500">Wait...</span>
              )}
            </div>

            {/* Quick Simulation Mode Toggle Button */}
            <button
              onClick={() => toggleSimulation()}
              title="Aktifkan/nonaktifkan simulasi data untuk demonstrasi tanpa hardware fisik"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors flex items-center space-x-1 ${
                isSimulating
                  ? 'bg-purple-600/20 border-purple-500 text-purple-300 hover:bg-purple-600/30'
                  : 'bg-industrial-850 border-industrial-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{isSimulating ? 'Stop Demo' : 'Mode Demo'}</span>
            </button>
          </div>

        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 border-t border-industrial-800/80 pt-1 overflow-x-auto scrollbar-none">
          {activeNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-all whitespace-nowrap border-b-2 ${
                  isActive
                    ? isProjectInverter
                      ? 'border-cyan-400 text-cyan-300 bg-industrial-800/60 font-semibold shadow-inner'
                      : 'border-electric-orange text-white bg-industrial-800/60 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-industrial-800/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${
                  isActive 
                    ? isProjectInverter ? 'text-cyan-400' : 'text-electric-orange' 
                    : item.isAi ? 'text-purple-400' : 'text-slate-400'
                }`} />
                <span>{item.label}</span>
                {item.isAi && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/50 font-mono font-bold">
                    AI
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
