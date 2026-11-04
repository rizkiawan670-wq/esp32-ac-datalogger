// ============================================================================
// SUPABASE CLIENT SERVICE
// Mengelola koneksi ke Supabase PostgreSQL & Realtime channel
// Mendukung penyimpanan kredensial dinamis via localStorage (Settings)
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// Kredensial default bawaan sistem (agar Netlify & production langsung otomatis terhubung tanpa setup manual)
export const DEFAULT_SUPABASE_URL = 'https://ixgcqgtwzjjfleipdgzz.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4Z2NxZ3R3empqZmxlaXBkZ3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0Njg1OTYsImV4cCI6MjEwOTA0NDU5Nn0.BoD_md3nbdasrD3-tac3e0Ja6wADA36h82DRUjju2e8';

// Ambil dari localStorage (jika diubah di menu Pengaturan), dari .env, atau dari default
export function getSupabaseCredentials() {
  const localUrl = localStorage.getItem('ac_datalogger_supabase_url');
  const localKey = localStorage.getItem('ac_datalogger_supabase_anon_key');

  // Bersihkan URL — Supabase client butuh URL dasar tanpa /rest/v1/
  const supabaseUrl = (localUrl || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL)
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');
  const supabaseAnonKey = localKey || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const isConfigured = 
    Boolean(supabaseUrl) && 
    Boolean(supabaseAnonKey) && 
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-supabase-anon-key');

  return { supabaseUrl, supabaseAnonKey, isConfigured };
}

// Inisialisasi instance client
let supabaseInstance = null;

export function getSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return supabaseInstance;
}

// Reset instance jika pengguna mengubah kredensial di Pengaturan
export function resetSupabaseClient() {
  supabaseInstance = null;
  return getSupabaseClient();
}

// Cek konektivitas ke Supabase
export async function testSupabaseConnection() {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: 'URL atau Kunci Anon Supabase belum dikonfigurasi.' };
  }

  try {
    const { data, error } = await client
      .from('devices')
      .select('device_id')
      .limit(1);

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Terhubung ke database Supabase.' };
  } catch (err) {
    return { ok: false, message: err.message || 'Gagal menghubungi server Supabase.' };
  }
}
