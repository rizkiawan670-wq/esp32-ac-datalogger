// ============================================================================
// AI DIAGNOSTICS & SYSTEM CONSULTATION PAGE
// Halaman asisten AI cerdas FULL ONLINE bertenaga Google Gemini.
// 100% cloud reasoning untuk konsultasi alur proses, analisis telemetri,
// dan pemecahan masalah (troubleshooting) AC Datalogger IoT ESP32.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Cpu, 
  Zap, 
  Thermometer, 
  Droplets, 
  Gauge, 
  RotateCw, 
  Key, 
  Check, 
  Copy, 
  Trash2, 
  AlertTriangle, 
  ShieldCheck, 
  ExternalLink,
  MessageSquare,
  Activity,
  Layers,
  HelpCircle,
  Database,
  X,
  Wind
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateDewPoint } from '../utils/analytics';
import { 
  sendChatMessage, 
  getStoredGeminiKey, 
  saveStoredGeminiKey,
  testGeminiApiKey 
} from '../services/gemini';

export default function AiDiagnosticsPage() {
  const {
    selectedDeviceId,
    latestReading,
    isDeviceOnline,
    settings,
    applyAiCalibration,
  } = useApp();

  // State Modal Konfigurasi API Key
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keySaveStatus, setKeySaveStatus] = useState(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestFeedback, setKeyTestFeedback] = useState(null);

  // Inisialisasi API Key dari storage
  useEffect(() => {
    const existingKey = getStoredGeminiKey();
    if (existingKey) {
      setApiKeyInput(existingKey);
      setHasApiKey(true);
    }
  }, []);

  // State percakapan
  const [messages, setMessages] = useState(() => {
    return [
      {
        id: 'welcome',
        role: 'assistant',
        text: `### 🤖 Halo! Saya Agent AI AC Datalogger.
Saya beroperasi secara **100% Full AI Online** untuk membantu Anda menganalisis telemetri tegangan True-RMS, suhu udara, kelembapan relatif, titik embun (dew point), serta melakukan kalibrasi sensor otomatis langsung via chat.

Silakan pilih topik cepat di bawah atau ketik langsung perintah/pertanyaan Anda:`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        source: 'gemini',
        model: 'Agent AI'
      }
    ];
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeTelemetry, setIncludeTelemetry] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  const chatEndRef = useRef(null);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Snapshot telemetri terkini
  const currentVoltage = latestReading ? Number(latestReading.voltage_v ?? latestReading.voltage_rms ?? 0) : 0;
  const currentTemp = latestReading ? Number(latestReading.temperature_c ?? 0) : 0;
  const currentHumidity = latestReading ? Number(latestReading.humidity_rh ?? 0) : 0;
  const currentDewPoint = calculateDewPoint(currentTemp, currentHumidity);

  const telemetryContext = {
    deviceId: selectedDeviceId,
    isOnline: isDeviceOnline,
    voltage: currentVoltage,
    temperature: currentTemp,
    humidity: currentHumidity,
    dewPoint: currentDewPoint,
    settings: settings
  };

  // Simpan API Key
  const handleSaveApiKey = () => {
    const cleanKey = apiKeyInput.trim().replace(/^["']|["']$/g, '');
    saveStoredGeminiKey(cleanKey);
    setHasApiKey(Boolean(cleanKey));
    setKeySaveStatus('Kunci Berhasil Disimpan & Aktif!');
    setTimeout(() => {
      setKeySaveStatus(null);
      setShowKeyModal(false);
    }, 1200);
  };

  // Uji Validitas API Key Langsung ke Google
  const handleTestKey = async () => {
    const cleanKey = apiKeyInput.trim().replace(/^["']|["']$/g, '');
    if (!cleanKey) {
      setKeyTestFeedback({ success: false, message: 'Silakan masukkan API Key terlebih dahulu.' });
      return;
    }
    setIsTestingKey(true);
    setKeyTestFeedback(null);
    try {
      const res = await testGeminiApiKey(cleanKey);
      setKeyTestFeedback({ 
        success: true, 
        message: `✅ Kunci Valid! Terhubung ke Agent AI (${res.model} ${res.version || ''}). Kunci telah otomatis disimpan dan aktif online!` 
      });
      saveStoredGeminiKey(cleanKey);
      setHasApiKey(true);
      setKeySaveStatus('Kunci Valid & Aktif Online!');
    } catch (err) {
      setKeyTestFeedback({ 
        success: false, 
        message: `❌ Validasi Gagal: ${err.message}` 
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Hapus API Key
  const handleRemoveApiKey = () => {
    saveStoredGeminiKey('');
    setApiKeyInput('');
    setHasApiKey(false);
    setKeySaveStatus('Kunci Dihapus');
    setKeyTestFeedback(null);
    setTimeout(() => {
      setKeySaveStatus(null);
      setShowKeyModal(false);
    }, 1200);
  };

  // Kirim Pertanyaan (Full AI Online dengan Eksekusi Kalibrasi Otomatis)
  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputPrompt).trim();
    if (!query || isGenerating) return;

    const activeKey = (apiKeyInput || getStoredGeminiKey() || '').trim();

    // Validasi kunci secara tegas: JANGAN PERNAH respon dengan template lokal jika kunci belum ada
    if (!activeKey) {
      const userMessageId = `user_${Date.now()}`;
      const userTimestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: 'user',
          text: query,
          timestamp: userTimestamp
        },
        {
          id: `missing_key_${Date.now()}`,
          role: 'assistant',
          text: `⚠️ **API Key Belum Dikonfigurasi**\n\nSistem Agent AI beroperasi **100% Full AI Online** tanpa jawaban lokal/hardcoded.\n\nSilakan masukkan **API Key** Anda untuk mengaktifkan kecerdasan online. Anda bisa mendapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/app/apikey).`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          source: 'warning',
          model: 'Agent AI (Perlu API Key)'
        }
      ]);
      setInputPrompt('');
      setShowKeyModal(true);
      return;
    }

    const userMessageId = `user_${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Salin history sebelum pesan baru ditambahkan (agar turn tetap alternate user -> model)
    const historyBeforeNewPrompt = messages
      .filter(m => m.id !== 'welcome' && m.source !== 'warning')
      .map(m => ({
        role: m.role,
        text: m.isCalibrationResult 
          ? `[Sistem: Kalibrasi ${m.calibrationData?.parameter} berhasil diterapkan. Offset: ${m.calibrationData?.offset}] ${m.text || ''}`
          : m.text
      }));

    const newMessages = [
      ...messages,
      {
        id: userMessageId,
        role: 'user',
        text: query,
        timestamp: userTimestamp
      }
    ];

    setMessages(newMessages);
    setInputPrompt('');
    setIsGenerating(true);

    try {
      const result = await sendChatMessage({
        prompt: query,
        history: historyBeforeNewPrompt,
        telemetryContext: includeTelemetry ? telemetryContext : null,
        apiKey: activeKey,
      });

      const assistantMessageId = `assistant_${Date.now()}`;
      const assistantTimestamp = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      // Jika Google Gemini memutuskan untuk memanggil Tool Kalibrasi
      if (result.functionCall) {
        const { name, args } = result.functionCall;
        const calResult = await applyAiCalibration(name, args);

        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            isCalibrationResult: true,
            calibrationData: calResult,
            text: args.explanation || result.text || `Kalibrasi otomatis untuk ${calResult.parameter} berhasil diterapkan.`,
            timestamp: assistantTimestamp,
            source: 'gemini_tool',
            model: result.model
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            text: result.text,
            timestamp: assistantTimestamp,
            source: result.source,
            model: result.model
          }
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          text: `❌ **Gagal Terhubung ke Agent AI Online:**\n\n\`${err.message}\`\n\n> Pastikan perangkat Anda terhubung ke internet dan API Key memiliki izin akses aktif. Klik tombol **Pengaturan API Key** di atas untuk menguji atau memperbarui kunci.`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          source: 'error',
          model: 'Agent AI Error'
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick Prompt Chips (Termasuk Kalibrasi Cepat Otomatis)
  const quickPrompts = [
    {
      icon: Zap,
      label: '⚡ Kalibrasi Voltase (+5V)',
      query: 'Multimeter saya terbaca 225V sedangkan dashboard terbaca 220V, tolong kalibrasi voltase agar sesuai multimeter.'
    },
    {
      icon: Thermometer,
      label: '🌡️ Kalibrasi Suhu (-2°C)',
      query: 'Termometer ruangan terbaca 24.5°C sedangkan sensor terbaca 26.5°C, tolong kalibrasi suhu.'
    },
    {
      icon: Droplets,
      label: '💧 Kalibrasi Kelembaban (+4%)',
      query: 'Higrometer saya terbaca 62% sedangkan di dashboard 58%, tolong kalibrasi kelembaban.'
    },
    {
      icon: RotateCw,
      label: '🔄 Kompresor 6-Pole',
      query: 'Tolong ubah setting kutub kompresor menjadi 6-pole (LG Twin Rotary).'
    },
    {
      icon: Trash2,
      label: '⚙️ Reset Semua Kalibrasi',
      query: 'Tolong reset semua parameter kalibrasi sensor ke standar pabrik / default 0.'
    },
    {
      icon: Activity,
      label: 'Analisis Kondisi Saat Ini',
      query: 'Bagaimana analisis kondisi telemetri sistem saat ini berdasarkan tegangan True-RMS, suhu, dan kelembapan aktual?'
    },
    {
      icon: Layers,
      label: 'Alur Proses Aplikasi',
      query: 'Jelaskan alur dan proses kerja sistem AC datalogger ini dari mikrokontroler ESP32 hingga tampil di dashboard web.'
    },
    {
      icon: Wind,
      label: 'Evaluasi Titik Embun & Kondensasi',
      query: 'Bagaimana analisis titik embun (dew point) dan potensi kondensasi air pada unit AC berdasarkan suhu dan kelembapan saat ini?'
    }
  ];

  // Salin teks pesan ke clipboard
  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format teks Markdown sederhana (Bold, Code, Lists, Headers)
  const renderFormattedText = (content) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Header 3 (###)
      if (line.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-base font-bold text-white font-mono mt-3 mb-1.5 flex items-center space-x-2">
            <span>{line.replace('### ', '')}</span>
          </h3>
        );
      }
      // Header 4 (####)
      if (line.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-sm font-semibold text-electric-orange font-mono mt-2 mb-1">
            {line.replace('#### ', '')}
          </h4>
        );
      }
      // Bullet list item
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const itemText = line.trim().replace(/^[\*\-]\s+/, '');
        return (
          <li key={idx} className="ml-4 list-disc text-slate-200 my-0.5 leading-relaxed">
            {renderInlineMarkdown(itemText)}
          </li>
        );
      }
      // Numbered list item
      if (/^\d+\.\s/.test(line.trim())) {
        const itemText = line.trim().replace(/^\d+\.\s+/, '');
        return (
          <li key={idx} className="ml-4 list-decimal text-slate-200 my-0.5 leading-relaxed">
            {renderInlineMarkdown(itemText)}
          </li>
        );
      }
      // Quote line
      if (line.trim().startsWith('> ')) {
        return (
          <div key={idx} className="pl-3 py-1 my-1.5 border-l-2 border-electric-orange/60 bg-industrial-950/60 text-slate-300 text-xs italic">
            {renderInlineMarkdown(line.replace('> ', ''))}
          </div>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2"></div>;
      }
      // Standard paragraph
      return (
        <p key={idx} className="text-slate-200 leading-relaxed my-1">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  // Helper untuk bold (**), italic (*), dan inline code (`)
  const renderInlineMarkdown = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|\`.*?\`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-industrial-950 text-electric-amber font-mono text-xs border border-industrial-800">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-4">

      {/* 1. HEADER SECTION & STATUS ENGINE */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-start space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-electric-orange to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20 border border-electric-orange/40 flex-shrink-0">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-black text-white font-mono tracking-wide">
                  AGENT AI - ASISTEN DIAGNOSTIK & KALIBRASI
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-purple-400 mr-1" />
                  <span>FULL AI ONLINE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Asisten cerdas <strong>Agent AI</strong> untuk analisis telemetri AC True-RMS, kalibrasi sensor otomatis, dan panduan teknis mendalam secara online.
              </p>
            </div>
          </div>

          {/* Engine Status & Action Controls */}
          <div className="flex items-center flex-wrap gap-2 self-start md:self-center">
            
            {/* Status API Key Badge */}
            <button
              onClick={() => {
                const stored = getStoredGeminiKey();
                if (stored) setApiKeyInput(stored);
                setKeyTestFeedback(null);
                setShowKeyModal(true);
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all cursor-pointer ${
                hasApiKey
                  ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300 hover:bg-emerald-900/50 shadow-sm shadow-emerald-950'
                  : 'bg-amber-950/60 border-amber-500/70 text-amber-300 hover:bg-amber-900/50 animate-pulse'
              }`}
              title="Atur API Key Agent AI"
            >
              <Key className={`w-3.5 h-3.5 ${hasApiKey ? 'text-emerald-400' : 'text-amber-400'}`} />
              {hasApiKey ? (
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-bold">Agent AI Aktif</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="font-bold">Kunci AI Belum Diatur</span>
                </span>
              )}
            </button>

            {/* Clear Chat Button */}
            <button
              onClick={() => setMessages(messages.slice(0, 1))}
              className="p-2 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-rose-400 hover:border-rose-800/60 transition-colors cursor-pointer"
              title="Bersihkan Percakapan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* 2. ALERT BANNER JIKA BELUM ADA API KEY */}
      {!hasApiKey && (
        <div className="bg-gradient-to-r from-amber-950/50 to-industrial-900 border border-amber-600/60 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300 font-mono block">
                MODE FULL AI ONLINE MEMERLUKAN API KEY
              </span>
              <p className="text-slate-300 mt-0.5">
                Sistem beroperasi 100% online dengan Agent AI tanpa jawaban lokal/hardcoded. Masukkan API Key gratis dari Google AI Studio untuk mengaktifkan AI.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const stored = getStoredGeminiKey();
              if (stored) setApiKeyInput(stored);
              setKeyTestFeedback(null);
              setShowKeyModal(true);
            }}
            className="px-3.5 py-1.5 rounded-lg bg-electric-orange hover:bg-orange-600 text-white font-mono font-bold whitespace-nowrap cursor-pointer shadow flex items-center space-x-1.5"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Masukkan API Key</span>
          </button>
        </div>
      )}

      {/* 3. REALTIME TELEMETRY CONTEXT BAR */}
      <div className="bg-industrial-900/90 border border-industrial-800 rounded-xl p-3 sm:p-4 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-industrial-800/80">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
            <Activity className="w-4 h-4 text-electric-orange animate-pulse" />
            <span className="font-semibold text-white">SNAPSHOT TELEMETRI YANG DIBACA AI SECARA ONLINE:</span>
            <span className="text-slate-400 font-mono">({selectedDeviceId})</span>
          </div>

          <label className="flex items-center space-x-2 text-xs font-mono text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTelemetry}
              onChange={(e) => setIncludeTelemetry(e.target.checked)}
              className="rounded bg-industrial-950 border-industrial-700 text-electric-orange focus:ring-electric-orange/40"
            />
            <span>Sertakan Data Sensor Terkini</span>
          </label>
        </div>

        {/* Sensor Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5">
          
          {/* Tegangan Listrik */}
          <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">TEGANGAN AC RMS</span>
              <span className="text-sm font-bold font-mono text-amber-400">
                {telemetryContext.voltage.toFixed(1)} V
              </span>
            </div>
            <Zap className="w-4 h-4 text-amber-500/70" />
          </div>

          {/* Titik Embun */}
          <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">TITIK EMBUN</span>
              <span className="text-sm font-bold font-mono text-cyan-400">
                {telemetryContext.dewPoint !== null && telemetryContext.dewPoint !== undefined ? `${telemetryContext.dewPoint.toFixed(1)} °C` : '--.- °C'}
              </span>
            </div>
            <Wind className="w-4 h-4 text-cyan-500/70" />
          </div>

          {/* Suhu Evaporator */}
          <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">SUHU EVAPORATOR</span>
              <span className="text-sm font-bold font-mono text-rose-400">
                {telemetryContext.temperature.toFixed(1)} °C
              </span>
            </div>
            <Thermometer className="w-4 h-4 text-rose-500/70" />
          </div>

          {/* Kelembapan Relatif */}
          <div className="bg-industrial-950 p-2.5 rounded-lg border border-industrial-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">KELEMBAPAN RELATIF</span>
              <span className="text-sm font-bold font-mono text-cyan-400">
                {telemetryContext.humidity.toFixed(1)} %RH
              </span>
            </div>
            <Droplets className="w-4 h-4 text-cyan-500/70" />
          </div>

        </div>
      </div>

      {/* 4. QUICK PROMPT CHIPS */}
      <div className="space-y-1.5">
        <span className="text-xs font-mono text-slate-400 px-1">Topik Cepat yang Sering Ditanyakan:</span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          {quickPrompts.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => handleSendMessage(item.query)}
                disabled={isGenerating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-industrial-900 border border-industrial-800 hover:border-electric-orange/80 hover:bg-industrial-850 text-slate-300 hover:text-white transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Icon className="w-3.5 h-3.5 text-electric-orange" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. CHAT CONVERSATION CONTAINER */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl flex flex-col h-[520px] sm:h-[600px] shadow-xl overflow-hidden">
        
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${
                    isUser
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-sm'
                      : msg.source === 'error'
                      ? 'bg-rose-900 shadow-sm'
                      : 'bg-gradient-to-br from-electric-orange to-purple-600 shadow-sm'
                  }`}
                >
                  {isUser ? 'ME' : <Bot className="w-4 h-4 text-white" />}
                </div>

                {/* Message Bubble */}
                <div className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-md text-xs sm:text-sm ${
                  isUser
                    ? 'bg-blue-600/30 border border-blue-500/40 text-blue-50 rounded-tr-none'
                    : msg.source === 'error'
                    ? 'bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-tl-none'
                    : 'bg-industrial-950 border border-industrial-800 text-slate-200 rounded-tl-none'
                }`}>
                  
                  {/* Assistant Source Badge */}
                  {!isUser && msg.model && (
                    <div className="flex items-center justify-between border-b border-industrial-800/80 pb-1.5 mb-2 text-[10px] font-mono text-slate-400">
                      <span className={`flex items-center space-x-1 ${
                        msg.source === 'gemini' || msg.source === 'gemini_tool'
                          ? 'text-emerald-400 font-bold' 
                          : msg.source === 'error' 
                          ? 'text-rose-400 font-semibold' 
                          : 'text-amber-400 font-semibold'
                      }`}>
                        <Sparkles className={`w-3 h-3 ${msg.source === 'gemini' || msg.source === 'gemini_tool' ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span>{msg.model ? msg.model.replace(/Google Gemini Online( \([^)]+\))?/gi, 'Agent AI').replace(/Google Gemini( Co-Pilot)?/gi, 'Agent AI') : 'Agent AI'}</span>
                        {(msg.source === 'gemini' || msg.source === 'gemini_tool') && (
                          <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/50 font-bold">
                            {msg.source === 'gemini_tool' ? '⚡ KALIBRASI AI AKTIF' : 'ONLINE'}
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => handleCopyText(msg.id, msg.text)}
                        className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                        title="Salin Pesan"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Calibration Action Card (Jika aksi kalibrasi dieksekusi) */}
                  {msg.isCalibrationResult && msg.calibrationData && (
                    <div className="mb-3 p-3.5 rounded-xl bg-industrial-900 border border-emerald-500/50 shadow-inner">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-industrial-800">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/50">
                            <Check className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 block tracking-wider">
                              KALIBRASI OTOMATIS SUKSES DITERAPKAN
                            </span>
                            <span className="text-xs font-bold text-white font-mono">
                              {msg.calibrationData.parameter}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold">
                          AKTIF
                        </span>
                      </div>

                      {/* Metric Comparison Grid */}
                      <div className="grid grid-cols-3 gap-2 text-center font-mono my-2.5">
                        <div className="bg-industrial-950 p-2 rounded-lg border border-industrial-800">
                          <span className="text-[10px] text-slate-500 block">NILAI SEBELUM</span>
                          <span className="text-xs font-bold text-slate-300">
                            {typeof msg.calibrationData.oldValue === 'number' 
                              ? `${msg.calibrationData.oldValue} ${msg.calibrationData.unit}`
                              : msg.calibrationData.oldValue || '-'}
                          </span>
                        </div>
                        <div className="bg-industrial-950 p-2 rounded-lg border border-amber-500/40">
                          <span className="text-[10px] text-amber-400 block">OFFSET KOREKSI</span>
                          <span className="text-xs font-bold text-amber-300">
                            {typeof msg.calibrationData.offset === 'number'
                              ? `${msg.calibrationData.offset > 0 ? '+' : ''}${msg.calibrationData.offset} ${msg.calibrationData.unit}`
                              : msg.calibrationData.offset}
                          </span>
                        </div>
                        <div className="bg-industrial-950 p-2 rounded-lg border border-emerald-500/40">
                          <span className="text-[10px] text-emerald-400 block">NILAI SETELAH</span>
                          <span className="text-xs font-bold text-emerald-300">
                            {typeof msg.calibrationData.newValue === 'number'
                              ? `${msg.calibrationData.newValue} ${msg.calibrationData.unit}`
                              : msg.calibrationData.newValue || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Cloud Sync & Multi-Device Sync Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-industrial-800/80 text-[10px] font-mono">
                        <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-500/40">
                          <Database className="w-3 h-3 text-blue-400" />
                          <span>Tersimpan Permanen di Supabase Cloud</span>
                        </span>
                        <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-500/40">
                          <Activity className="w-3 h-3 text-purple-400" />
                          <span>Tersinkronisasi Real-time ke Semua Layar & Perangkat</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="prose prose-invert max-w-none text-xs sm:text-sm">
                    {renderFormattedText(msg.text)}
                  </div>

                  {/* Timestamp */}
                  <div className={`text-[10px] mt-2 font-mono ${isUser ? 'text-blue-300/80 text-right' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </div>

                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isGenerating && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-electric-orange to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs animate-pulse">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-industrial-950 border border-industrial-800 rounded-2xl rounded-tl-none px-4 py-3 text-xs sm:text-sm text-slate-300 flex items-center space-x-2">
                <RotateCw className="w-4 h-4 animate-spin text-electric-orange" />
                <span>Agent AI sedang menganalisis telemetri & memproses respons...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-industrial-950 border-t border-industrial-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Tanyakan analisis atau berikan perintah kalibrasi ke Agent AI..."
              disabled={isGenerating}
              className="flex-1 bg-industrial-900 border border-industrial-800 focus:border-electric-orange focus:ring-1 focus:ring-electric-orange rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none transition-all font-sans"
            />
            <button
              type="submit"
              disabled={!inputPrompt.trim() || isGenerating}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-electric-orange to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-medium text-xs sm:text-sm flex items-center space-x-1.5 transition-all shadow-md shadow-orange-900/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2 px-1">
            <span>Tekan Enter untuk mengirim pesan.</span>
            <span>100% Full AI Online bertenaga Agent AI.</span>
          </div>
        </div>

      </div>

      {/* 6. MODAL KONFIGURASI API KEY */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-industrial-900 border border-industrial-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-industrial-800">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-electric-orange" />
                <h3 className="text-base font-bold text-white font-mono">
                  PENGATURAN AGENT AI API KEY
                </h3>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <p>
                Sistem <strong>Agent AI</strong> beroperasi <strong>100% Full AI Online</strong> tanpa jawaban lokal atau offline yang digunakan.
              </p>

              <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg space-y-1.5">
                <span className="text-slate-400 font-mono block">Cara Mendapatkan API Key Gratis:</span>
                <ol className="list-decimal ml-4 space-y-1 text-slate-300">
                  <li>Buka konsol resmi Google AI Studio.</li>
                  <li>Login menggunakan akun Google Anda.</li>
                  <li>Klik tombol <strong>"Create API Key"</strong> lalu salin kunci yang diberikan.</li>
                </ol>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-electric-orange hover:underline font-mono pt-1 font-semibold"
                >
                  <span>Buka Google AI Studio (Gratis)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Input Form & Test Button */}
              <div className="space-y-2 pt-1">
                <label className="block text-xs font-mono text-slate-300">
                  Agent AI API Key:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setKeyTestFeedback(null);
                    }}
                    placeholder="AIzaSy..."
                    className="flex-1 bg-industrial-950 border border-industrial-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-electric-orange"
                  />
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isTestingKey || !apiKeyInput.trim()}
                    className="px-3 py-2 bg-industrial-800 hover:bg-industrial-700 border border-industrial-600 rounded-lg text-xs font-mono text-slate-200 transition-colors flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
                  >
                    {isTestingKey ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-electric-orange" />
                        <span>Menguji...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Uji Kunci</span>
                      </>
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 block font-mono">
                  🔒 Kunci disimpan di browser Anda (localStorage) dan dikirim langsung ke server resmi Google API.
                </span>
              </div>

              {/* Feedback Hasil Uji Kunci */}
              {keyTestFeedback && (
                <div className={`p-2.5 rounded-lg border font-mono text-xs flex items-start space-x-2 ${
                  keyTestFeedback.success
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                }`}>
                  {keyTestFeedback.success ? (
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{keyTestFeedback.message}</span>
                </div>
              )}

              {keySaveStatus && (
                <div className="p-2 rounded bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 font-mono text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{keySaveStatus}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-industrial-800">
              {hasApiKey ? (
                <button
                  onClick={handleRemoveApiKey}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 hover:bg-rose-900/60 text-xs font-mono cursor-pointer"
                >
                  Hapus Kunci
                </button>
              ) : <div></div>}

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-300 hover:text-white text-xs font-mono cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="px-4 py-1.5 rounded-lg bg-electric-orange hover:bg-orange-600 text-white font-mono font-bold text-xs cursor-pointer shadow"
                >
                  Simpan Kunci
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
