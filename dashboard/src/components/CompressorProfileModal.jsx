// ============================================================================
// COMPRESSOR PROFILE & CALIBRATION MODAL
// Dialog konfigurasi parameter motor kompresor inverter, kabel sensing U/V/W,
// jumlah kutub (pole), dan batas ambang kalibrasi LOW/MED/HIGH.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Sliders, Save, X, Check, ShieldAlert, Info } from 'lucide-react';
import { useApp, DEFAULT_COMPRESSOR_PROFILES } from '../context/AppContext';

export default function CompressorProfileModal({ isOpen, onClose }) {
  const { activeCompressorProfile, updateCompressorProfile } = useApp();
  const [formData, setFormData] = useState(activeCompressorProfile);

  useEffect(() => {
    setFormData(activeCompressorProfile);
  }, [activeCompressorProfile, isOpen]);

  if (!isOpen) return null;

  const handlePresetSelect = (presetId) => {
    const preset = DEFAULT_COMPRESSOR_PROFILES.find((p) => p.id === presetId);
    if (preset) {
      setFormData({
        ...preset,
        sensor_channel: formData.sensor_channel || 'U'
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    updateCompressorProfile({
      ...formData,
      motor_poles: parseInt(formData.motor_poles, 10) || 4,
      pulses_per_revolution: parseFloat(formData.pulses_per_revolution) || 2.0,
      rpm_low_max: parseFloat(formData.rpm_low_max) || 1800,
      rpm_medium_max: parseFloat(formData.rpm_medium_max) || 3200,
      rpm_high_min: parseFloat(formData.rpm_high_min) || 3200,
      is_calibrated: Boolean(formData.is_calibrated),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-industrial-900 border border-industrial-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-industrial-800 pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-electric-orange" />
            <h3 className="text-base font-bold text-white font-mono">
              Kalibrasi & Profil Kompresor Inverter
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-industrial-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          
          {/* Preset Merek AC */}
          <div>
            <label className="block text-slate-300 mb-1 font-bold">
              Pilih Preset Merek AC Inverter:
            </label>
            <select
              value={formData.id || 'universal'}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="w-full bg-industrial-950 border border-industrial-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-electric-orange"
            >
              {DEFAULT_COMPRESSOR_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} - {p.model} ({p.motor_poles} Pole)
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              {formData.notes || 'Parameter disesuaikan dengan karakteristik motor BLDC kompresor.'}
            </p>
          </div>

          {/* Pemilihan Kanal Fasa Sensor U / V / W */}
          <div>
            <label className="block text-slate-300 mb-1.5 font-bold">
              Kabel Fasa Sensor yang Terhubung (1-Kanal Isolated):
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['U', 'V', 'W'].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setFormData({ ...formData, sensor_channel: ch })}
                  className={`py-2 rounded-lg border font-bold text-center cursor-pointer transition-colors ${
                    formData.sensor_channel === ch 
                      ? 'bg-electric-orange/20 border-electric-orange text-electric-orange' 
                      : 'bg-industrial-950 border-industrial-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Fasa {ch}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Sensor membaca pulsa frekuensi inverter melalui isolasi optocoupler pada salah satu kabel fasa.
            </span>
          </div>

          {/* Motor Poles & Pulsa per Putaran */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-bold">
                Jumlah Kutub (Motor Poles):
              </label>
              <input
                type="number"
                min="2"
                max="12"
                step="2"
                value={formData.motor_poles}
                onChange={(e) => {
                  const poles = parseInt(e.target.value, 10) || 4;
                  setFormData({
                    ...formData,
                    motor_poles: poles,
                    pulses_per_revolution: poles / 2
                  });
                }}
                className="w-full bg-industrial-950 border border-industrial-700 rounded-lg p-2 text-white"
              />
              <span className="text-[10px] text-slate-500">Umumnya 4, 6, atau 8 kutub</span>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-bold">
                Pulsa per Putaran (PPR):
              </label>
              <input
                type="number"
                min="0.5"
                max="10"
                step="0.5"
                value={formData.pulses_per_revolution}
                onChange={(e) => setFormData({ ...formData, pulses_per_revolution: e.target.value })}
                className="w-full bg-industrial-950 border border-industrial-700 rounded-lg p-2 text-white"
              />
              <span className="text-[10px] text-slate-500">Pole / 2 (4 pole = 2.0)</span>
            </div>
          </div>

          {/* Ambang Batas Kategori RPM Kalibrasi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-bold">
                Batas Atas LOW (RPM):
              </label>
              <input
                type="number"
                step="50"
                value={formData.rpm_low_max}
                onChange={(e) => setFormData({ ...formData, rpm_low_max: e.target.value })}
                className="w-full bg-industrial-950 border border-industrial-700 rounded-lg p-2 text-white"
              />
              <span className="text-[10px] text-cyan-400">Putaran pelan (&le; {formData.rpm_low_max} RPM)</span>
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-bold">
                Batas Bawah HIGH / Ngebut:
              </label>
              <input
                type="number"
                step="50"
                value={formData.rpm_high_min}
                onChange={(e) => setFormData({ ...formData, rpm_high_min: e.target.value })}
                className="w-full bg-industrial-950 border border-industrial-700 rounded-lg p-2 text-white"
              />
              <span className="text-[10px] text-rose-400">Putaran tinggi (&gt; {formData.rpm_high_min} RPM)</span>
            </div>
          </div>

          {/* Checkbox Status Kalibrasi */}
          <div className="p-3 bg-industrial-950 border border-industrial-800 rounded-lg">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.is_calibrated)}
                onChange={(e) => setFormData({ ...formData, is_calibrated: e.target.checked })}
                className="rounded border-industrial-700 text-electric-orange focus:ring-0 w-4 h-4"
              />
              <div>
                <span className="text-white font-bold block">
                  Tandai Terkalibrasi (CALIBRATED)
                </span>
                <span className="text-[11px] text-slate-400">
                  Centang jika rasio pulsa telah diverifikasi dengan tachometer optik atau spesifikasi pabrikan. Jika tidak dicentang, dashboard akan menampilkan peringatan <strong>RPM NOT CALIBRATED</strong>.
                </span>
              </div>
            </label>
          </div>

          {/* Tombol Aksi */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-industrial-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-industrial-800 hover:bg-industrial-700 text-slate-300 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-electric-orange to-electric-red hover:opacity-90 text-white font-bold rounded-lg shadow-lg flex items-center space-x-1 transition-all"
            >
              <Save className="w-4 h-4 mr-1" />
              <span>Terapkan Kalibrasi</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
