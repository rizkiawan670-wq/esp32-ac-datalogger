// ============================================================================
// APPLICATION STATE CONTEXT
// Mengelola koneksi Supabase Realtime, buffer data grafik 1-detik,
// status perangkat ESP32, generator simulasi, ambang batas AC,
// dan pemantauan real-time COMPRESSOR RPM INVERTER.
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
  humidityLow: 30.0,
  humidityHigh: 75.0,
  bufferLimit: 180,    // 180 titik = 3 menit telemetri per detik untuk grafik live
};

// Preset Profil Kompresor Inverter Default
export const DEFAULT_COMPRESSOR_PROFILES = [
  {
    id: 'universal',
    brand: 'Universal',
    model: 'Standard Inverter (Generic)',
    motor_poles: 4,
    pulses_per_revolution: 2.0,
    rpm_low_max: 1800,
    rpm_medium_max: 3200,
    rpm_high_min: 3200,
    sensor_channel: 'U',
    is_calibrated: false,
    notes: 'Profil universal konservatif untuk kompresor inverter umum (4-Pole BLDC)'
  },
  {
    id: 'daikin_ftkq',
    brand: 'Daikin',
    model: 'Flash Inverter FTKQ (1 PK)',
    motor_poles: 4,
    pulses_per_revolution: 2.0,
    rpm_low_max: 1750,
    rpm_medium_max: 3100,
    rpm_high_min: 3100,
    sensor_channel: 'U',
    is_calibrated: true,
    notes: 'Kompresor hermetik Daikin Swing/Scroll Inverter'
  },
  {
    id: 'sharp_jtech',
    brand: 'Sharp',
    model: 'J-Tech Inverter AH-X (1 PK)',
    motor_poles: 4,
    pulses_per_revolution: 2.0,
    rpm_low_max: 1600,
    rpm_medium_max: 3000,
    rpm_high_min: 3000,
    sensor_channel: 'U',
    is_calibrated: true,
    notes: 'Kompresor Sharp Eco Inverter dengan mode hemat energi'
  },
  {
    id: 'panasonic_si_biru',
    brand: 'Panasonic',
    model: 'si-BiRU Inverter CS-PU (1 PK)',
    motor_poles: 4,
    pulses_per_revolution: 2.0,
    rpm_low_max: 1800,
    rpm_medium_max: 3300,
    rpm_high_min: 3300,
    sensor_channel: 'U',
    is_calibrated: true,
    notes: 'Kompresor Panasonic Rotary Inverter R32'
  },
  {
    id: 'lg_dual_inverter',
    brand: 'LG',
    model: 'DualCool Dual Inverter (1 PK)',
    motor_poles: 6,
    pulses_per_revolution: 3.0,
    rpm_low_max: 1900,
    rpm_medium_max: 3400,
    rpm_high_min: 3400,
    sensor_channel: 'U',
    is_calibrated: true,
    notes: 'Kompresor LG Dual Rotary (Twin Rotary 6-Pole)'
  },
  {
    id: 'samsung_windfree',
    brand: 'Samsung',
    model: 'WindFree Digital Inverter (1 PK)',
    motor_poles: 8,
    pulses_per_revolution: 4.0,
    rpm_low_max: 1650,
    rpm_medium_max: 3150,
    rpm_high_min: 3150,
    sensor_channel: 'U',
    is_calibrated: true,
    notes: 'Kompresor Samsung Digital Inverter 8-Pole Multi-Magnet'
  }
];

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

  // Telemetri COMPRESSOR RPM INVERTER
  const [latestRpmReading, setLatestRpmReading] = useState(null);
  const [rpmRealtimeBuffer, setRpmRealtimeBuffer] = useState([]);

  // Profil Kompresor yang Aktif
  const [activeCompressorProfile, setActiveCompressorProfile] = useState(() => {
    const saved = localStorage.getItem('ac_datalogger_compressor_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_e) {}
    }
    return DEFAULT_COMPRESSOR_PROFILES[0]; // Default Universal
  });

  // Simulator RPM Mode: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ACCEL' | 'DECEL' | 'UNSTABLE' | 'LOST'
  const [rpmSimMode, setRpmSimMode] = useState('LOW');

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
  const rpmChannelRef = useRef(null);
  const simulationTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const latestTimestampRef = useRef(Date.now());
  const simCurrentRpmRef = useRef(1400);

  // Simpan pengaturan ke localStorage
  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      localStorage.setItem('ac_datalogger_settings', JSON.stringify(merged));
      return merged;
    });
  }, []);

  // Simpan profil kompresor ke localStorage
  const updateCompressorProfile = useCallback((profile) => {
    setActiveCompressorProfile(profile);
    localStorage.setItem('ac_datalogger_compressor_profile', JSON.stringify(profile));
  }, []);

  // Simpan perubahan device id terpilih
  const changeSelectedDevice = useCallback((deviceId) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('ac_datalogger_device_id', deviceId);
    setRealtimeBuffer([]);
    setRpmRealtimeBuffer([]);
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

    // Terapkan koreksi offset voltase jika disetel teknisi di Pengaturan Dashboard
    const offset = Number(settings.voltageTrimOffset) || 0;
    const processedReading = (offset !== 0 && reading && reading.voltage_v != null && Number(reading.voltage_v) > 10)
      ? { ...reading, voltage_v: Math.round((Number(reading.voltage_v) + offset) * 10) / 10 }
      : reading;

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
  }, [isStreamPaused, settings.bufferLimit, settings.voltageTrimOffset]);

  // Tambahkan pembacaan RPM kompresor baru ke buffer
  const appendRpmReading = useCallback((rpmReading) => {
    if (isStreamPaused) return;

    setLatestRpmReading(rpmReading);
    latestTimestampRef.current = Date.now();
    setSecondsSinceLastPacket(0);
    setIsDeviceOnline(true);

    setRpmRealtimeBuffer((prev) => {
      const updated = [...prev, rpmReading];
      if (updated.length > settings.bufferLimit) {
        return updated.slice(updated.length - settings.bufferLimit);
      }
      return updated;
    });
  }, [isStreamPaused, settings.bufferLimit]);

  // Reset buffer data grafik lokal (RAM)
  const resetChartBuffer = useCallback(() => {
    setRealtimeBuffer([]);
    setRpmRealtimeBuffer([]);
  }, []);

  // Reset seluruh data tersimpan (Buffer lokal + Database Supabase)
  const resetStoredData = useCallback(async (includeDatabase = true) => {
    // 1. Kosongkan state buffer lokal seketika
    setRealtimeBuffer([]);
    setRpmRealtimeBuffer([]);

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
        await Promise.all([
          client.from('ac_readings').delete().eq('device_id', selectedDeviceId),
          client.from('compressor_rpm_measurements').delete().eq('device_id', selectedDeviceId),
        ]);
      }

      setLatestReading(null);
      setLatestRpmReading(null);

      return { 
        success: true, 
        message: 'Seluruh riwayat data telemetri AC & RPM perangkat berhasil di-reset.',
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
  // MODE SIMULASI REALISTIS (AC TEGANGAN + KOMPRESOR RPM SIMULATOR)
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

      // 1. Simulasi PLN & Suhu
      const baseV = 220.0 + 3.0 * Math.sin(simStep * 0.1) + (Math.random() - 0.5) * 1.5;
      const cyclePos = (simStep % 120) / 120;
      const baseTemp = 25.0 - 3.5 * Math.sin(cyclePos * Math.PI) + (Math.random() - 0.5) * 0.2;
      const baseHum = 58.0 + 8.0 * Math.sin(cyclePos * Math.PI) + (Math.random() - 0.5) * 0.5;

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

      // 2. Simulasi Compressor RPM Berdasarkan Mode Terpilih
      let targetRpm = 0;
      let status = 'OFF';
      let trend = 'STOPPED';
      let signal = 'VALID';

      switch (rpmSimMode) {
        case 'OFF':
          simCurrentRpmRef.current = 0;
          status = 'OFF';
          trend = 'STOPPED';
          signal = 'NO_SIGNAL';
          break;

        case 'LOW':
          targetRpm = 1350 + Math.sin(simStep * 0.15) * 60;
          simCurrentRpmRef.current += (targetRpm - simCurrentRpmRef.current) * 0.2;
          status = 'LOW';
          trend = 'STABLE';
          signal = 'VALID';
          break;

        case 'MEDIUM':
          targetRpm = 2550 + Math.sin(simStep * 0.2) * 80;
          simCurrentRpmRef.current += (targetRpm - simCurrentRpmRef.current) * 0.2;
          status = 'MEDIUM';
          trend = 'STABLE';
          signal = 'VALID';
          break;

        case 'HIGH':
          targetRpm = 3900 + Math.sin(simStep * 0.25) * 110;
          simCurrentRpmRef.current += (targetRpm - simCurrentRpmRef.current) * 0.2;
          status = 'HIGH';
          trend = 'STABLE';
          signal = 'VALID';
          break;

        case 'ACCEL':
          if (simCurrentRpmRef.current < 900) simCurrentRpmRef.current = 1000;
          simCurrentRpmRef.current += 130;
          if (simCurrentRpmRef.current > 4200) simCurrentRpmRef.current = 1000;
          status = simCurrentRpmRef.current < 1800 ? 'LOW' : (simCurrentRpmRef.current < 3200 ? 'MEDIUM' : 'HIGH');
          trend = 'ACCELERATING';
          signal = 'VALID';
          break;

        case 'DECEL':
          if (simCurrentRpmRef.current > 4200 || simCurrentRpmRef.current < 900) simCurrentRpmRef.current = 4000;
          simCurrentRpmRef.current -= 130;
          if (simCurrentRpmRef.current < 900) simCurrentRpmRef.current = 4000;
          status = simCurrentRpmRef.current < 1800 ? 'LOW' : (simCurrentRpmRef.current < 3200 ? 'MEDIUM' : 'HIGH');
          trend = 'DECELERATING';
          signal = 'VALID';
          break;

        case 'UNSTABLE':
          simCurrentRpmRef.current = 1600 + (Math.random() - 0.5) * 2200;
          status = 'UNKNOWN';
          trend = 'UNKNOWN';
          signal = 'UNSTABLE';
          break;

        case 'LOST':
        default:
          simCurrentRpmRef.current = 0;
          status = 'OFF';
          trend = 'STOPPED';
          signal = 'NO_SIGNAL';
          break;
      }

      const calcRpm = Math.max(0, Math.round(simCurrentRpmRef.current));
      const pInterval = calcRpm > 0 ? Math.round(60000000 / (calcRpm * 2)) : 0;

      const simRpmReading = {
        id: `sim-rpm-${simStep}`,
        device_id: selectedDeviceId,
        recorded_at: nowIso,
        compressor_status: status,
        estimated_rpm: calcRpm,
        pulse_count: simStep * 30,
        pulse_interval: pInterval,
        speed_category: status,
        speed_trend: trend,
        signal_status: signal,
        calibration_status: activeCompressorProfile.is_calibrated ? 'CALIBRATED' : 'UNCALIBRATED',
        sensor_channel: activeCompressorProfile.sensor_channel || 'U',
        data_source: 'SIMULATOR',
      };
      appendRpmReading(simRpmReading);

    }, 1000);

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [isSimulating, selectedDeviceId, appendReading, appendRpmReading, rpmSimMode, activeCompressorProfile]);

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
        const offset = Number(settings.voltageTrimOffset) || 0;
        const chronological = [...readingsData].reverse().map(r => {
          if (offset !== 0 && r.voltage_v != null && Number(r.voltage_v) > 10) {
            return { ...r, voltage_v: Math.round((Number(r.voltage_v) + offset) * 10) / 10 };
          }
          return r;
        });
        setRealtimeBuffer(chronological);
        const latest = chronological[chronological.length - 1];
        setLatestReading(latest);
        latestTimestampRef.current = new Date(latest.measured_at).getTime();
        setDbStatus('connected');
      } else {
        setDbStatus('connected');
      }

      // 3. Ambil data COMPRESSOR RPM terakhir (60 record)
      try {
        const { data: rpmData, error: rpmErr } = await client
          .from('compressor_rpm_measurements')
          .select('*')
          .eq('device_id', selectedDeviceId)
          .order('recorded_at', { ascending: false })
          .limit(60);

        if (!rpmErr && rpmData && rpmData.length > 0) {
          const chronologicalRpm = [...rpmData].reverse();
          setRpmRealtimeBuffer(chronologicalRpm);
          const latestRpm = chronologicalRpm[chronologicalRpm.length - 1];
          setLatestRpmReading(latestRpm);
        }
      } catch (_e) {
        // Tabel compressor_rpm_measurements mungkin belum di-migrate, tidak apa-apa
      }

    } catch (err) {
      console.error('Error fetching initial data:', err);
      setDbStatus('disconnected');
    }
  }, [selectedDeviceId]);

  // --------------------------------------------------------------------------
  // SUPABASE REALTIME SUBSCRIPTION
  // Berlangganan event INSERT pada tabel ac_readings & compressor_rpm_measurements
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

    // Channel 2: Telemetri COMPRESSOR RPM
    const channelNameRPM = `realtime-rpm-${selectedDeviceId}`;
    if (rpmChannelRef.current) {
      client.removeChannel(rpmChannelRef.current);
    }

    const channelRPM = client
      .channel(channelNameRPM)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'compressor_rpm_measurements',
          filter: `device_id=eq.${selectedDeviceId}`,
        },
        (payload) => {
          if (payload.new) {
            appendRpmReading(payload.new);
          }
        }
      )
      .subscribe();

    rpmChannelRef.current = channelRPM;

    return () => {
      if (channelAC) client.removeChannel(channelAC);
      if (channelRPM) client.removeChannel(channelRPM);
    };
  }, [selectedDeviceId, isSimulating, loadInitialData, appendReading, appendRpmReading]);

  return (
    <AppContext.Provider
      value={{
        selectedDeviceId,
        changeSelectedDevice,
        devices,
        latestReading,
        realtimeBuffer,
        latestRpmReading,
        rpmRealtimeBuffer,
        activeCompressorProfile,
        updateCompressorProfile,
        rpmSimMode,
        setRpmSimMode,
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
