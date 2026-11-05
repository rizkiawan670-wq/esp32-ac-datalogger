// ============================================================================
// APPLICATION STATE CONTEXT
// Mengelola koneksi Supabase Realtime, buffer data grafik 1-detik,
// status perangkat ESP32, generator simulasi, ambang batas kelistrikan AC,
// dan sinkronisasi kalibrasi multi-device real-time.
// ============================================================================

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient, getSupabaseCredentials, testSupabaseConnection } from '../services/supabase';

const AppContext = createContext();

const DEFAULT_SETTINGS = {
  voltageLow: 198.0,   // SPLN 220V -10%
  voltageHigh: 242.0,  // SPLN 220V +10%
  voltageTrimOffset: 0.0, // Koreksi offset kalibrasi manual (Volt): misal +5.0 jika ESP32 lebih rendah 5V
  tempLow: 16.0,
  tempHigh: 32.0,
  tempTrimOffset: 0.0, // Koreksi offset kalibrasi suhu (°C)
  humidityLow: 30.0,
  humidityHigh: 75.0,
  humidityTrimOffset: 0.0, // Koreksi offset kalibrasi kelembaban (%RH)
  bufferLimit: 180,    // 180 titik = 3 menit telemetri per detik untuk grafik live
};

export function AppProvider({ children }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('ac_datalogger_device_id') || 
           import.meta.env.VITE_DEFAULT_DEVICE_ID || 
           'esp32-ac-01';
  });

  const [devices, setDevices] = useState(() => {
    const saved = localStorage.getItem('ac_datalogger_devices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_e) {}
    }
    return [
      {
        device_id: 'esp32-ac-01',
        name: 'ESP32 AC Datalogger Unit 01 (Server Room)',
        calibrated: false,
        last_seen_at: null,
      }
    ];
  });

  // Telemetri AC Listrik & SHT31
  const [latestReading, setLatestReading] = useState(null);
  const [realtimeBuffer, setRealtimeBuffer] = useState([]);

  const [dbStatus, setDbStatus] = useState('connecting'); // 'connected' | 'disconnected' | 'unconfigured'
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [secondsSinceLastPacket, setSecondsSinceLastPacket] = useState(null);
  const [isStreamPaused, setIsStreamPaused] = useState(false);

  // Mode Simulasi (aktif jika dikonfigurasi di env atau dinyalakan teknisi untuk testing UI)
  const [isSimulating, setIsSimulating] = useState(() => {
    const saved = localStorage.getItem('ac_datalogger_simulation');
    if (saved !== null) return saved === 'true';
    return import.meta.env.VITE_ENABLE_SIMULATION_MODE === 'true';
  });

  // Settings ambang batas
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('ac_datalogger_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const realtimeChannelRef = useRef(null);
  const syncChannelRef = useRef(null);
  const simulationTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const latestTimestampRef = useRef(Date.now());

  // Simpan pengaturan ke localStorage
  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      localStorage.setItem('ac_datalogger_settings', JSON.stringify(merged));
      return merged;
    });
  }, []);

  // Simpan perubahan device id terpilih
  const changeSelectedDevice = useCallback((deviceId) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('ac_datalogger_device_id', deviceId);
    setRealtimeBuffer([]);
  }, []);

  // Update dan simpan parameter perangkat ke memory & localStorage
  const updateDevice = useCallback((deviceId, updatedFields) => {
    setDevices((prev) => {
      const updated = prev.map((d) => (d.device_id === deviceId ? { ...d, ...updatedFields } : d));
      localStorage.setItem('ac_datalogger_devices', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Toggle Mode Simulasi
  const toggleSimulation = useCallback((val) => {
    const nextVal = typeof val === 'boolean' ? val : !isSimulating;
    setIsSimulating(nextVal);
    localStorage.setItem('ac_datalogger_simulation', String(nextVal));
  }, [isSimulating]);

  // Tambahkan pembacaan telemetri AC baru ke buffer
  const appendReading = useCallback((reading) => {
    if (isStreamPaused) return;

    // Terapkan koreksi kalibrasi offset jika disetel teknisi atau AI Agent
    const vOffset = Number(settings.voltageTrimOffset) || 0;
    const tOffset = Number(settings.tempTrimOffset) || 0;
    const hOffset = Number(settings.humidityTrimOffset) || 0;

    let processedReading = reading;
    if (reading) {
      let v = reading.voltage_v != null ? Number(reading.voltage_v) : (reading.voltage_rms != null ? Number(reading.voltage_rms) : null);
      let t = reading.temperature_c != null ? Number(reading.temperature_c) : null;
      let h = reading.humidity_rh != null ? Number(reading.humidity_rh) : null;

      if (v != null && v > 10 && vOffset !== 0) {
        v = Math.round((v + vOffset) * 10) / 10;
      }
      if (t != null && tOffset !== 0) {
        t = Math.round((t + tOffset) * 10) / 10;
      }
      if (h != null && hOffset !== 0) {
        h = Math.max(0, Math.min(100, Math.round((h + hOffset) * 10) / 10));
      }

      processedReading = {
        ...reading,
        ...(v != null ? { voltage_v: v } : {}),
        ...(t != null ? { temperature_c: t } : {}),
        ...(h != null ? { humidity_rh: h } : {}),
      };
    }

    setLatestReading(processedReading);
    latestTimestampRef.current = Date.now();
    setSecondsSinceLastPacket(0);
    setIsDeviceOnline(true);

    setRealtimeBuffer((prev) => {
      const updated = [...prev, processedReading];
      if (updated.length > settings.bufferLimit) {
        return updated.slice(updated.length - settings.bufferLimit);
      }
      return updated;
    });
  }, [isStreamPaused, settings.bufferLimit, settings.voltageTrimOffset, settings.tempTrimOffset, settings.humidityTrimOffset]);

  // Reset buffer data grafik lokal (RAM)
  const resetChartBuffer = useCallback(() => {
    setRealtimeBuffer([]);
  }, []);

  // Reset seluruh data tersimpan (Buffer lokal + Database Supabase)
  const resetStoredData = useCallback(async (includeDatabase = true) => {
    // 1. Kosongkan state buffer lokal seketika
    setRealtimeBuffer([]);

    if (!includeDatabase) {
      return { success: true, message: 'Buffer grafik lokal berhasil dibersihkan.' };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: true, message: 'Buffer lokal dibersihkan (Database offline).' };
    }

    try {
      // Panggil Stored Procedure reset_device_telemetry
      const { data, error } = await client.rpc('reset_device_telemetry', {
        p_device_id: selectedDeviceId,
      });

      if (error) {
        console.warn('RPC reset_device_telemetry gagal, mencoba delete langsung:', error);
        await client.from('ac_readings').delete().eq('device_id', selectedDeviceId);
      }

      setLatestReading(null);

      return { 
        success: true, 
        message: 'Seluruh riwayat data telemetri AC perangkat berhasil di-reset.',
        details: data 
      };
    } catch (err) {
      console.error('Error reset database:', err);
      return { success: false, error: err.message };
    }
  }, [selectedDeviceId]);

  // --------------------------------------------------------------------------
  // TIMER HEARTBEAT MONITOR (ONLINE/OFFLINE)
  // --------------------------------------------------------------------------
  useEffect(() => {
    heartbeatTimerRef.current = setInterval(() => {
      if (latestTimestampRef.current) {
        const diffSeconds = Math.floor((Date.now() - latestTimestampRef.current) / 1000);
        setSecondsSinceLastPacket(diffSeconds);
        if (diffSeconds > 10) {
          setIsDeviceOnline(false);
        }
      }
    }, 1000);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, []);

  // --------------------------------------------------------------------------
  // MODE SIMULASI REALISTIS (AC TEGANGAN + SHT31 SUHU & KELEMBAPAN)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isSimulating) {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      return;
    }

    let simStep = 0;
    simulationTimerRef.current = setInterval(() => {
      simStep++;
      const nowIso = new Date().toISOString();

      // Simulasi PLN True-RMS & Suhu SHT31
      const baseV = 220.0 + 3.0 * Math.sin(simStep * 0.1) + (Math.random() - 0.5) * 1.5;
      const cyclePos = (simStep % 120) / 120;
      const baseTemp = 24.5 - 3.5 * Math.sin(cyclePos * Math.PI) + (Math.random() - 0.5) * 0.2;
      const baseHum = 55.0 + 8.0 * Math.sin(cyclePos * Math.PI) + (Math.random() - 0.5) * 0.5;

      const simReading = {
        id: `sim-ac-${simStep}`,
        device_id: selectedDeviceId,
        measured_at: nowIso,
        voltage_v: Math.round(baseV * 100) / 100,
        voltage_valid: true,
        temperature_c: Math.round(baseTemp * 100) / 100,
        humidity_rh: Math.round(baseHum * 100) / 100,
        is_simulated: true,
      };
      appendReading(simReading);

    }, 1000);

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [isSimulating, selectedDeviceId, appendReading]);

  // --------------------------------------------------------------------------
  // KALIBRASI CLOUD PERSISTENCE & REALTIME MULTI-DEVICE SYNCHRONIZATION
  // --------------------------------------------------------------------------
  // Simpan kalibrasi secara permanen ke Supabase Database & Broadcast ke semua device
  const persistCalibrationToCloud = useCallback(async (calSettings) => {
    const client = getSupabaseClient();
    let cloudSaved = false;

    const currentSettings = calSettings || settings;

    const calData = {
      calibration: {
        voltageTrimOffset: Number(currentSettings.voltageTrimOffset) || 0,
        tempTrimOffset: Number(currentSettings.tempTrimOffset) || 0,
        humidityTrimOffset: Number(currentSettings.humidityTrimOffset) || 0,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Agent AI & Web Dashboard'
      }
    };

    if (client) {
      try {
        // Simpan permanen ke tabel konfigurasi
        const { error } = await client
          .from('compressor_profiles')
          .update({
            notes: JSON.stringify(calData),
            is_calibrated: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', 'universal');

        if (!error) {
          cloudSaved = true;
        }
      } catch (e) {
        console.warn('Gagal menyimpan kalibrasi ke Supabase:', e);
      }

      // Broadcast ke semua tab/browser/perangkat yang sedang terhubung
      try {
        const channel = syncChannelRef.current || client.channel('system_calibration_sync');
        await channel.send({
          type: 'broadcast',
          event: 'CALIBRATION_UPDATE',
          payload: calData
        });
      } catch (e) {
        console.warn('Gagal menyiarkan kalibrasi via realtime broadcast:', e);
      }
    }

    return { cloudSaved, calData };
  }, [settings]);

  // Eksekusi kalibrasi otomatis oleh Agent AI
  const applyAiCalibration = useCallback(async (actionType, args = {}) => {
    let result = {
      success: false,
      action: actionType,
      parameter: '',
      unit: '',
      oldValue: null,
      newValue: null,
      offset: null,
      notes: args.explanation || '',
      cloudSaved: false
    };

    let updatedSettings = { ...settings };

    if (actionType === 'calibrate_voltage') {
      const rawReading = latestReading?.voltage_v ?? 220;
      const oldOffset = Number(settings.voltageTrimOffset) || 0;
      const baseUncalibrated = rawReading - oldOffset;

      let newOffset = 0;
      if (args.offset_volts !== undefined && args.offset_volts !== null) {
        newOffset = Math.round(Number(args.offset_volts) * 10) / 10;
      } else if (args.target_volts !== undefined && args.target_volts !== null) {
        newOffset = Math.round((Number(args.target_volts) - baseUncalibrated) * 10) / 10;
      }

      const calculatedNew = Math.round((baseUncalibrated + newOffset) * 10) / 10;
      updatedSettings.voltageTrimOffset = newOffset;
      updateSettings({ voltageTrimOffset: newOffset });

      if (latestReading) {
        setLatestReading(prev => prev ? { ...prev, voltage_v: calculatedNew } : prev);
      }

      result = {
        success: true,
        action: actionType,
        parameter: 'Tegangan AC True-RMS (ZMPT101B)',
        unit: 'Volt RMS',
        oldValue: rawReading,
        newValue: calculatedNew,
        offset: newOffset,
        notes: args.explanation || `Offset tegangan disesuaikan menjadi ${newOffset > 0 ? '+' : ''}${newOffset} V`,
      };
    } else if (actionType === 'calibrate_temperature') {
      const rawReading = latestReading?.temperature_c ?? 25.0;
      const oldOffset = Number(settings.tempTrimOffset) || 0;
      const baseUncalibrated = rawReading - oldOffset;

      let newOffset = 0;
      if (args.offset_celsius !== undefined && args.offset_celsius !== null) {
        newOffset = Math.round(Number(args.offset_celsius) * 10) / 10;
      } else if (args.target_temp !== undefined && args.target_temp !== null) {
        newOffset = Math.round((Number(args.target_temp) - baseUncalibrated) * 10) / 10;
      }

      const calculatedNew = Math.round((baseUncalibrated + newOffset) * 10) / 10;
      updatedSettings.tempTrimOffset = newOffset;
      updateSettings({ tempTrimOffset: newOffset });

      if (latestReading) {
        setLatestReading(prev => prev ? { ...prev, temperature_c: calculatedNew } : prev);
      }

      result = {
        success: true,
        action: actionType,
        parameter: 'Suhu Udara (Sensirion SHT31)',
        unit: '°C',
        oldValue: rawReading,
        newValue: calculatedNew,
        offset: newOffset,
        notes: args.explanation || `Offset suhu disesuaikan menjadi ${newOffset > 0 ? '+' : ''}${newOffset} °C`,
      };
    } else if (actionType === 'calibrate_humidity') {
      const rawReading = latestReading?.humidity_rh ?? 60.0;
      const oldOffset = Number(settings.humidityTrimOffset) || 0;
      const baseUncalibrated = rawReading - oldOffset;

      let newOffset = 0;
      if (args.offset_humidity !== undefined && args.offset_humidity !== null) {
        newOffset = Math.round(Number(args.offset_humidity) * 10) / 10;
      } else if (args.target_humidity !== undefined && args.target_humidity !== null) {
        newOffset = Math.round((Number(args.target_humidity) - baseUncalibrated) * 10) / 10;
      }

      const calculatedNew = Math.min(100, Math.max(0, Math.round((baseUncalibrated + newOffset) * 10) / 10));
      updatedSettings.humidityTrimOffset = newOffset;
      updateSettings({ humidityTrimOffset: newOffset });

      if (latestReading) {
        setLatestReading(prev => prev ? { ...prev, humidity_rh: calculatedNew } : prev);
      }

      result = {
        success: true,
        action: actionType,
        parameter: 'Kelembapan Udara (Sensirion SHT31)',
        unit: '%RH',
        oldValue: rawReading,
        newValue: calculatedNew,
        offset: newOffset,
        notes: args.explanation || `Offset kelembapan disesuaikan menjadi ${newOffset > 0 ? '+' : ''}${newOffset} %RH`,
      };
    } else if (actionType === 'reset_calibration') {
      const param = (args.parameter || 'all').toLowerCase();
      if (param === 'voltage' || param === 'all') {
        updatedSettings.voltageTrimOffset = 0.0;
      }
      if (param === 'temperature' || param === 'all') {
        updatedSettings.tempTrimOffset = 0.0;
      }
      if (param === 'humidity' || param === 'all') {
        updatedSettings.humidityTrimOffset = 0.0;
      }

      updateSettings(updatedSettings);

      result = {
        success: true,
        action: actionType,
        parameter: param === 'all' ? 'Semua Parameter Sensor' : param.toUpperCase(),
        unit: '-',
        oldValue: 'Kalibrasi Kustom',
        newValue: 'Standar Default (0.0)',
        offset: 0,
        notes: args.explanation || `Kalibrasi parameter [${param}] berhasil di-reset ke nilai default pabrik.`,
      };
    }

    // Simpan permanen ke Supabase Cloud & Broadcast ke semua layar/koneksi aktif
    const { cloudSaved } = await persistCalibrationToCloud(updatedSettings);
    result.cloudSaved = cloudSaved;

    return result;
  }, [settings, latestReading, updateSettings, persistCalibrationToCloud]);

  // --------------------------------------------------------------------------
  // LOAD PERANGKAT & INITIAL READINGS DARI SUPABASE
  // --------------------------------------------------------------------------
  const loadInitialData = useCallback(async () => {
    const { isConfigured } = getSupabaseCredentials();
    if (!isConfigured) {
      setDbStatus('unconfigured');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setDbStatus('unconfigured');
      return;
    }

    try {
      // 0. Ambil Kalibrasi Permanen Terkini dari Supabase Cloud
      let effectiveSettings = { ...settings };
      try {
        const { data: profData, error: profErr } = await client
          .from('compressor_profiles')
          .select('*')
          .eq('id', 'universal')
          .single();

        if (!profErr && profData && profData.notes) {
          try {
            const parsedNotes = JSON.parse(profData.notes);
            if (parsedNotes && parsedNotes.calibration) {
              const cal = parsedNotes.calibration;
              console.log('📥 Memuat kalibrasi permanen dari Supabase Cloud:', cal);
              effectiveSettings = {
                ...effectiveSettings,
                voltageTrimOffset: cal.voltageTrimOffset !== undefined ? Number(cal.voltageTrimOffset) : effectiveSettings.voltageTrimOffset,
                tempTrimOffset: cal.tempTrimOffset !== undefined ? Number(cal.tempTrimOffset) : effectiveSettings.tempTrimOffset,
                humidityTrimOffset: cal.humidityTrimOffset !== undefined ? Number(cal.humidityTrimOffset) : effectiveSettings.humidityTrimOffset,
              };

              setSettings((prev) => {
                const merged = { ...prev, ...effectiveSettings };
                localStorage.setItem('ac_datalogger_settings', JSON.stringify(merged));
                return merged;
              });
            }
          } catch (_e) {}
        }
      } catch (errCal) {
        console.warn('Gagal membaca kalibrasi cloud saat init:', errCal);
      }

      // 1. Ambil daftar devices
      const savedLocal = localStorage.getItem('ac_datalogger_devices');
      let localMap = {};
      if (savedLocal) {
        try {
          JSON.parse(savedLocal).forEach((d) => {
            localMap[d.device_id] = d;
          });
        } catch (_e) {}
      }

      let devicesData = null;
      try {
        const { data, error: devErr } = await client
          .from('devices')
          .select('*')
          .order('device_id', { ascending: true });
        if (!devErr && data && data.length > 0) {
          devicesData = data;
        }
      } catch (_e) {}

      if (devicesData) {
        const merged = devicesData.map((d) => {
          const loc = localMap[d.device_id];
          return loc ? { ...d, ...loc, calibrated: Boolean(loc.calibrated) } : d;
        });
        setDevices(merged);
        localStorage.setItem('ac_datalogger_devices', JSON.stringify(merged));
      }

      // 2. Ambil data AC terakhir (60 record)
      const { data: readingsData, error: readErr } = await client
        .from('ac_readings')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .order('measured_at', { ascending: false })
        .limit(60);

      if (!readErr && readingsData && readingsData.length > 0) {
        const vOffset = Number(effectiveSettings.voltageTrimOffset) || 0;
        const tOffset = Number(effectiveSettings.tempTrimOffset) || 0;
        const hOffset = Number(effectiveSettings.humidityTrimOffset) || 0;

        const chronological = [...readingsData].reverse().map(r => {
          let v = r.voltage_v != null ? Number(r.voltage_v) : (r.voltage_rms != null ? Number(r.voltage_rms) : null);
          let t = r.temperature_c != null ? Number(r.temperature_c) : null;
          let h = r.humidity_rh != null ? Number(r.humidity_rh) : null;

          if (v != null && v > 10 && vOffset !== 0) {
            v = Math.round((v + vOffset) * 10) / 10;
          }
          if (t != null && tOffset !== 0) {
            t = Math.round((t + tOffset) * 10) / 10;
          }
          if (h != null && hOffset !== 0) {
            h = Math.max(0, Math.min(100, Math.round((h + hOffset) * 10) / 10));
          }

          return {
            ...r,
            ...(v != null ? { voltage_v: v } : {}),
            ...(t != null ? { temperature_c: t } : {}),
            ...(h != null ? { humidity_rh: h } : {}),
          };
        });
        setRealtimeBuffer(chronological);
        const latest = chronological[chronological.length - 1];
        setLatestReading(latest);
        latestTimestampRef.current = new Date(latest.measured_at).getTime();
        setDbStatus('connected');
      } else {
        setDbStatus('connected');
      }

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setDbStatus('disconnected');
    }
  }, [selectedDeviceId]);

  // --------------------------------------------------------------------------
  // SUPABASE REALTIME SUBSCRIPTION
  // Berlangganan event INSERT pada tabel ac_readings
  // Serta channel broadcast system_calibration_sync untuk update instan multi-device
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (isSimulating) {
      setDbStatus('simulated');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setDbStatus('unconfigured');
      return;
    }

    loadInitialData();

    // Channel 1: Telemetri AC
    const channelNameAC = `realtime-ac-${selectedDeviceId}`;
    if (realtimeChannelRef.current) {
      client.removeChannel(realtimeChannelRef.current);
    }

    const channelAC = client
      .channel(channelNameAC)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ac_readings',
          filter: `device_id=eq.${selectedDeviceId}`,
        },
        (payload) => {
          if (payload.new) {
            appendReading(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setDbStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setDbStatus('disconnected');
        }
      });

    realtimeChannelRef.current = channelAC;

    // Channel 2: Realtime Broadcast Synchronization untuk Kalibrasi antar Perangkat
    if (syncChannelRef.current) {
      client.removeChannel(syncChannelRef.current);
    }

    const channelSync = client
      .channel('system_calibration_sync')
      .on('broadcast', { event: 'CALIBRATION_UPDATE' }, (payload) => {
        if (payload && payload.payload && payload.payload.calibration) {
          const cal = payload.payload.calibration;
          console.log('⚡ Sinkronisasi Kalibrasi Real-time Diterima dari Perangkat Lain / AI:', cal);

          setSettings((prev) => {
            const merged = {
              ...prev,
              voltageTrimOffset: cal.voltageTrimOffset !== undefined ? Number(cal.voltageTrimOffset) : prev.voltageTrimOffset,
              tempTrimOffset: cal.tempTrimOffset !== undefined ? Number(cal.tempTrimOffset) : prev.tempTrimOffset,
              humidityTrimOffset: cal.humidityTrimOffset !== undefined ? Number(cal.humidityTrimOffset) : prev.humidityTrimOffset,
            };
            localStorage.setItem('ac_datalogger_settings', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .subscribe();

    syncChannelRef.current = channelSync;

    return () => {
      if (channelAC) client.removeChannel(channelAC);
      if (channelSync) client.removeChannel(channelSync);
    };
  }, [selectedDeviceId, isSimulating, loadInitialData, appendReading]);

  return (
    <AppContext.Provider
      value={{
        selectedDeviceId,
        changeSelectedDevice,
        devices,
        latestReading,
        realtimeBuffer,
        dbStatus,
        isDeviceOnline,
        secondsSinceLastPacket,
        isStreamPaused,
        setIsStreamPaused,
        isSimulating,
        toggleSimulation,
        settings,
        updateSettings,
        updateDevice,
        loadInitialData,
        resetChartBuffer,
        resetStoredData,
        persistCalibrationToCloud,
        applyAiCalibration,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp harus digunakan di dalam AppProvider');
  }
  return context;
}
