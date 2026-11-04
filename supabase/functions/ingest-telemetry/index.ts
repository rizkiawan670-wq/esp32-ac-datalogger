// ============================================================================
// Supabase Edge Function: ingest-telemetry
// Endpoint aman untuk menerima data telemetri dari ESP32 AC Datalogger
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-id, x-device-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Interface payload pembacaan
interface CompressorRpmPayload {
  estimated_rpm: number;
  pulse_count?: number;
  pulse_interval_us?: number;
  compressor_status?: string;
  speed_category?: string;
  speed_trend?: string;
  signal_status?: string;
  calibration_status?: string;
  sensor_channel?: string;
  data_source?: string;
}

interface ReadingPayload {
  voltage_v: number;
  voltage_valid?: boolean;
  temperature_c: number;
  humidity_rh: number;
  measured_at?: string;
  compressor_rpm?: CompressorRpmPayload;
}

interface IngestRequestBody {
  device_id?: string;
  device_token?: string;
  readings?: ReadingPayload[];
  // Single reading shorthand
  voltage_v?: number;
  voltage_valid?: boolean;
  temperature_c?: number;
  humidity_rh?: number;
  measured_at?: string;
  compressor_rpm?: CompressorRpmPayload;
}

// Fungsi helper hash SHA-256 untuk memverifikasi token perangkat
async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  // Tangani HTTP OPTIONS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Gunakan metode POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Environment variables SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum disetel.");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ambil kredensial dari Header atau Body
    const headerDeviceId = req.headers.get("x-device-id");
    const headerDeviceToken = req.headers.get("x-device-token");

    let body: IngestRequestBody = {};
    try {
      body = await req.json();
    } catch (_e) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deviceId = headerDeviceId || body.device_id;
    const deviceToken = headerDeviceToken || body.device_token;

    if (!deviceId || !deviceToken) {
      return new Response(
        JSON.stringify({ error: "Otentikasi gagal: x-device-id dan x-device-token wajib disertakan." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hitung hash token
    const tokenHash = await sha256Hex(deviceToken);

    // Verifikasi identitas perangkat di tabel devices
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("device_id, device_token_hash, calibrated")
      .eq("device_id", deviceId)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: "Perangkat tidak ditemukan atau belum terdaftar." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verifikasi token hash
    if (device.device_token_hash !== tokenHash) {
      return new Response(
        JSON.stringify({ error: "Token perangkat tidak valid. Akses ditolak." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ekstrak pembacaan: bisa berupa batch array 'readings' atau single record langsung
    let rawReadings: ReadingPayload[] = [];
    if (Array.isArray(body.readings) && body.readings.length > 0) {
      rawReadings = body.readings;
    } else if (body.voltage_v !== undefined && body.temperature_c !== undefined) {
      rawReadings = [{
        voltage_v: body.voltage_v,
        voltage_valid: body.voltage_valid,
        temperature_c: body.temperature_c,
        humidity_rh: body.humidity_rh ?? 0,
        measured_at: body.measured_at,
        compressor_rpm: body.compressor_rpm,
      }];
    } else {
      return new Response(
        JSON.stringify({ error: "Payload tidak memuat data telemetri yang valid (voltage_v, temperature_c, humidity_rh)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serverNow = new Date().toISOString();
    const validatedRecords = [];
    const validatedRpmRecords = [];

    // Validasi data dan pastikan rentang fisik masuk akal
    for (const r of rawReadings) {
      const v = Number(r.voltage_v);
      const t = Number(r.temperature_c);
      const h = Number(r.humidity_rh);

      // Cek apakah angka numerik valid
      if (isNaN(v) || isNaN(t) || isNaN(h)) {
        continue;
      }

      // Validasi rentang fisik
      const isVoltagePhysical = v >= 0 && v <= 350; // PLN 220V normal batas aman max 350V
      const isTempPhysical = t >= -40 && t <= 85;    // Rentang operasional SHT31
      const isHumPhysical = h >= 0 && h <= 100;

      if (!isTempPhysical || !isHumPhysical) {
        continue; // Abaikan data sensor cacat
      }

      // Pastikan status validitas tegangan:
      // Jika perangkat belum ditandai calibrated di DB, voltage_valid dipaksa FALSE
      const isDeviceCalibrated = Boolean(device.calibrated);
      const reportedValid = r.voltage_valid !== undefined ? Boolean(r.voltage_valid) : true;
      const finalVoltageValid = isDeviceCalibrated && reportedValid && isVoltagePhysical;

      // Timestamp: gunakan measured_at dari client jika valid (misal dari queue offline),
      // jika tidak ada, gunakan waktu server sekarang
      let measuredTimestamp = serverNow;
      if (r.measured_at) {
        const parsed = new Date(r.measured_at);
        if (!isNaN(parsed.getTime())) {
          measuredTimestamp = parsed.toISOString();
        }
      }

      validatedRecords.push({
        device_id: deviceId,
        measured_at: measuredTimestamp,
        voltage_v: isVoltagePhysical ? Math.round(v * 100) / 100 : 0.0,
        voltage_valid: finalVoltageValid,
        temperature_c: Math.round(t * 100) / 100,
        humidity_rh: Math.round(h * 100) / 100,
      });

      // Validasi & ekstrak data Compressor RPM jika tersedia di payload
      if (r.compressor_rpm && typeof r.compressor_rpm === "object") {
        const rpm = r.compressor_rpm;
        const estRpm = Number(rpm.estimated_rpm);
        const pCount = Number(rpm.pulse_count) || 0;
        const pInterval = Number(rpm.pulse_interval_us) || 0;

        if (!isNaN(estRpm) && estRpm >= 0 && estRpm <= 12000) {
          validatedRpmRecords.push({
            device_id: deviceId,
            recorded_at: measuredTimestamp,
            compressor_status: rpm.compressor_status || (estRpm < 400 ? "OFF" : "LOW"),
            estimated_rpm: Math.round(estRpm * 10) / 10,
            pulse_count: pCount,
            pulse_interval: pInterval,
            speed_category: rpm.speed_category || (estRpm < 400 ? "OFF" : "LOW"),
            speed_trend: rpm.speed_trend || "STABLE",
            signal_status: rpm.signal_status || "VALID",
            calibration_status: rpm.calibration_status || "UNCALIBRATED",
            sensor_channel: (rpm.sensor_channel && ['U', 'V', 'W'].includes(rpm.sensor_channel.toUpperCase())) 
                            ? rpm.sensor_channel.toUpperCase() : "U",
            data_source: rpm.data_source || "REAL",
          });
        }
      }
    }

    if (validatedRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: "Tidak ada data yang lulus validasi fisik." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ingest ke PostgreSQL secara paralel menggunakan Promise.all (mempercepat respons <500ms dan mencegah timeout ESP32)
    const dbPromises: Promise<any>[] = [
      supabase
        .from("ac_readings")
        .upsert(validatedRecords, {
          onConflict: "device_id,measured_at",
          ignoreDuplicates: true,
        }),
      supabase
        .from("devices")
        .update({ last_seen_at: serverNow })
        .eq("device_id", deviceId),
    ];

    if (validatedRpmRecords.length > 0) {
      dbPromises.push(
        supabase
          .from("compressor_rpm_measurements")
          .upsert(validatedRpmRecords, {
            onConflict: "device_id,recorded_at",
            ignoreDuplicates: true,
          })
      );
    }

    const [acRes, _devRes, rpmRes] = await Promise.all(dbPromises);

    if (acRes?.error) {
      console.error("Gagal insert ke ac_readings:", acRes.error);
      return new Response(
        JSON.stringify({ error: "Gagal menyimpan ke database", details: acRes.error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rpmRes?.error) {
      console.warn("Peringatan: Gagal simpan ke compressor_rpm_measurements:", rpmRes.error.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        device_id: deviceId,
        calibrated: device.calibrated,
        ingested_count: validatedRecords.length,
        rpm_ingested_count: validatedRpmRecords.length,
        server_time: serverNow,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Internal error in ingest-telemetry:", errorMsg);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
