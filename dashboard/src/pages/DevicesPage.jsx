// ============================================================================
// DEVICES PAGE (MANAJEMEN PERANGKAT ESP32)
// Manajemen identitas perangkat, status kalibrasi, parameter sensor,
// dan pemantauan status heartbeat perangkat di lapangan.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Cpu, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  Edit3, 
  Check, 
  X, 
  Key, 
  Plus, 
  Clock,
  RotateCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSupabaseClient } from '../services/supabase';

export default function DevicesPage() {
  const { devices, selectedDeviceId, changeSelectedDevice, isDeviceOnline, updateDevice } = useApp();
  
  const [deviceList, setDeviceList] = useState(devices);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    voltage_calibration_factor: 1.0,
    voltage_zero_offset: 1.65,
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  useEffect(() => {
    setDeviceList(devices);
  }, [devices]);

  const startEdit = (dev) => {
    setEditingDeviceId(dev.device_id);
    setEditForm({
      name: dev.name || '',
      voltage_calibration_factor: dev.voltage_calibration_factor || 1.0,
      voltage_zero_offset: dev.voltage_zero_offset || 1.65,
      notes: dev.notes || '',
    });
    setSaveMessage(null);
  };

  const cancelEdit = () => {
    setEditingDeviceId(null);
  };

  const saveEdit = async (deviceId) => {
    setSaving(true);
    setSaveMessage(null);

    // 1. Simpan segera ke Context & LocalStorage agar tidak pernah hilang saat refresh
    updateDevice(deviceId, editForm);
    setDeviceList((prev) =>
      prev.map((d) => (d.device_id === deviceId ? { ...d, ...editForm } : d))
    );

    const client = getSupabaseClient();
    if (!client) {
      setSaving(false);
      setEditingDeviceId(null);
      setSaveMessage('Tersimpan di memori lokal (Koneksi Supabase belum aktif).');
      return;
    }

    try {
      const { error } = await client
        .from('devices')
        .update({
          name: editForm.name,
          calibrated: editForm.calibrated,
          voltage_calibration_factor: parseFloat(editForm.voltage_calibration_factor),
          voltage_zero_offset: parseFloat(editForm.voltage_zero_offset),
          notes: editForm.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (error) {
        // Tetap tersimpan di local storage
        setEditingDeviceId(null);
        setSaveMessage('Tersimpan di browser lokal (Catatan: Supabase RLS membatasi update dari publik).');
      } else {
        setEditingDeviceId(null);
        setSaveMessage('Parameter perangkat berhasil diperbarui di Supabase & Browser.');
      }
    } catch (err) {
      setEditingDeviceId(null);
      setSaveMessage('Tersimpan di browser lokal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Halaman */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center">
            <Cpu className="w-5 h-5 mr-2 text-electric-orange" />
            Inventaris & Status Perangkat ESP32
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola daftar perangkat telemetri, token keamanan, dan status verifikasi kalibrasi sensor tegangan.
          </p>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3 rounded-lg bg-industrial-950 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
          {saveMessage}
        </div>
      )}

      {/* Grid Kartu Perangkat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {deviceList.map((dev) => {
          const isSelected = dev.device_id === selectedDeviceId;
          const isEditing = editingDeviceId === dev.device_id;
          const lastSeen = dev.last_seen_at
            ? new Date(dev.last_seen_at).toLocaleString('id-ID')
            : 'Belum pernah terkoneksi';

          return (
            <div
              key={dev.device_id}
              className={`bg-industrial-900 border rounded-xl p-5 shadow-lg transition-all ${
                isSelected
                  ? 'border-electric-orange shadow-electric-orange/10'
                  : 'border-industrial-800'
              }`}
            >
              {/* Header Kartu */}
              <div className="flex items-start justify-between pb-3 border-b border-industrial-800 gap-2">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg border ${
                    isSelected ? 'bg-electric-orange/10 border-electric-orange/40 text-electric-orange' : 'bg-industrial-950 border-industrial-800 text-slate-400'
                  }`}>
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-white font-mono">{dev.device_id}</h3>
                      {isSelected && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-electric-orange/20 text-electric-orange border border-electric-orange/40 font-mono font-semibold">
                          AKTIF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 font-sans mt-0.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-industrial-950 border border-industrial-700 px-2 py-0.5 rounded text-xs text-white"
                        />
                      ) : (
                        dev.name || 'ESP32 Datalogger'
                      )}
                    </p>
                  </div>
                </div>

                {/* Tombol Aksi */}
                <div className="flex items-center space-x-1.5">
                  {!isEditing ? (
                    <>
                      {!isSelected && (
                        <button
                          onClick={() => changeSelectedDevice(dev.device_id)}
                          className="px-2.5 py-1 rounded bg-industrial-950 border border-industrial-800 hover:border-slate-600 text-xs font-mono text-slate-300 hover:text-white cursor-pointer"
                        >
                          Pilih
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(dev)}
                        className="p-1.5 rounded bg-industrial-950 border border-industrial-800 hover:border-slate-600 text-slate-300 hover:text-white cursor-pointer"
                        title="Edit parameter kalibrasi"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => saveEdit(dev.device_id)}
                        disabled={saving}
                        className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        title="Simpan"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-1.5 rounded bg-industrial-800 hover:bg-industrial-700 text-slate-300 cursor-pointer"
                        title="Batal"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Detail & Parameter Hardware */}
              <div className="mt-4 space-y-3 font-mono text-xs">
                
                {/* Faktor Pengali Kalibrasi */}
                <div className="flex justify-between items-center py-1 border-b border-industrial-850">
                  <span className="text-slate-400">Faktor Kalibrasi (Slope):</span>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.0001"
                      value={editForm.voltage_calibration_factor}
                      onChange={(e) => setEditForm({ ...editForm, voltage_calibration_factor: e.target.value })}
                      className="w-24 bg-industrial-950 border border-industrial-700 px-2 py-0.5 rounded text-right text-xs text-white"
                    />
                  ) : (
                    <span className="font-bold text-white font-mono">
                      {dev.voltage_calibration_factor || '1.0000'}
                    </span>
                  )}
                </div>

                {/* Zero Offset ADC */}
                <div className="flex justify-between items-center py-1 border-b border-industrial-850">
                  <span className="text-slate-400">Offset Nol ADC (Bias):</span>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.001"
                      value={editForm.voltage_zero_offset}
                      onChange={(e) => setEditForm({ ...editForm, voltage_zero_offset: e.target.value })}
                      className="w-24 bg-industrial-950 border border-industrial-700 px-2 py-0.5 rounded text-right text-xs text-white"
                    />
                  ) : (
                    <span className="font-bold text-white font-mono">
                      {dev.voltage_zero_offset || '1.6500'} V
                    </span>
                  )}
                </div>

                {/* Heartbeat Terakhir */}
                <div className="flex justify-between items-center py-1 border-b border-industrial-850">
                  <span className="text-slate-400">Pembaruan Terakhir (Ping):</span>
                  <span className="text-slate-300 font-mono flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    {lastSeen}
                  </span>
                </div>

                {/* Catatan Unit */}
                <div className="pt-1">
                  <span className="text-slate-400 block mb-1">Catatan Lokasi & Instalasi:</span>
                  {isEditing ? (
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                      className="w-full bg-industrial-950 border border-industrial-700 p-2 rounded text-xs text-white"
                    />
                  ) : (
                    <p className="text-slate-300 text-[11px] font-sans bg-industrial-950 p-2.5 rounded-lg border border-industrial-800">
                      {dev.notes || 'Belum ada catatan lokasi untuk unit ini.'}
                    </p>
                  )}
                </div>

                {/* Tombol Simpan Jelas saat Mode Edit */}
                {isEditing && (
                  <div className="pt-3 border-t border-industrial-800 flex justify-end space-x-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300 text-xs font-mono cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => saveEdit(dev.device_id)}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold flex items-center space-x-1 cursor-pointer shadow-md"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Panduan Token Otentikasi Perangkat */}
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center">
          <Key className="w-4 h-4 mr-2 text-electric-amber" />
          Protokol Otentikasi Token Perangkat (Device Security)
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-3">
          Setiap unit ESP32 mengirimkan header HTTP <code>x-device-id</code> dan <code>x-device-token</code> saat mengirimkan data telemetri.
          Supabase Edge Function menghitung hash <strong>SHA-256</strong> dari token tersebut dan membandingkannya dengan <code>device_token_hash</code> di database.
        </p>
        <div className="bg-industrial-950 p-3 rounded-lg border border-industrial-800 font-mono text-[11px] text-slate-400 space-y-1">
          <div>• Token default: <code className="text-electric-amber">esp32-secret-token-ac-01</code></div>
          <div>• Hash SHA-256: <code className="text-emerald-400">a3a2d3637be59dc2356ec39d33261623910c01cbff01e84ce40217be5fa4d41a</code></div>
          <div>• Untuk mengganti token, hitung hash baru lalu perbarui kolom <code>device_token_hash</code> di tabel <code>devices</code>.</div>
        </div>
      </div>

    </div>
  );
}
