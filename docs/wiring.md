# Panduan Pengkabelan (Wiring Diagram) & Keselamatan Listrik PLN

Dokumentasi ini menjelaskan secara rinci koneksi perangkat keras untuk **ESP32 AC Datalogger Online**, pemilihan transduser tegangan AC, sensor suhu/kelembapan SHT31, serta protokol keselamatan listrik tegangan tinggi 220–240 VAC.

---

## 1. Aturan Keselamatan Prioritas (Deadly Voltage Hazard)

> [!CAUTION]
> **BAHAYA TEGANGAN TINGGI 220–240 VAC DAPAT MEMATIKAN.**
> - JANGAN PERNAH menghubungkan kabel fasa (L) atau netral (N) PLN langsung ke pin GPIO mana pun pada ESP32. Pin GPIO ESP32 hanya toleran hingga 3.3 VDC!
> - DILARANG menggunakan breadboard plastik tanpa casing untuk merakit jalur 220 VAC. Terminal kontak breadboard mudah longgar dan dapat memicu loncatan bunga api (arc flash) serta kebakaran.
> - Wajib menggunakan transduser tegangan dengan **isolasi galvanik** (dielectric breakdown rating minimal 2.000 VAC hingga 3.000 VAC).
> - Seluruh instalasi sisi 220V wajib ditempatkan di dalam kotak enclosure tertutup (berbahan isolator Flame-Retardant ABS IP54/IP65) dengan cable gland strain-relief.

---

## 2. Tabel Pinout ESP32 DevKit V1

| Komponen / Sensor | Pin Sensor | Pin ESP32 | Tipe Sinyal | Deskripsi & Rekomendasi Teknis |
| :--- | :--- | :--- | :--- | :--- |
| **SHT31** | `VCC` | `3V3` | Power | Tegangan logika 3.3V DC (konsumsi arus ~100 µA) |
| **SHT31** | `GND` | `GND` | Ground | Ground logika bersama |
| **SHT31** | `SDA` | `GPIO21` | Digital I2C | Jalur data I2C (disarankan resistor pull-up 4.7kΩ ke 3.3V) |
| **SHT31** | `SCL` | `GPIO22` | Digital I2C | Jalur detak clock I2C (standar 100 kHz) |
| **Transduser AC** | `VCC` | `3V3` atau `VIN` | Power | Catu daya op-amp pengondisi sinyal sensor |
| **Transduser AC** | `GND` | `GND` | Ground | Ground sekunder (terisolasi penuh dari ground PLN) |
| **Transduser AC** | `OUT` | `GPIO34` | Analog In | Input ADC1_CH6 (Input-only, bebas noise Wi-Fi) |

---

## 3. Diagram Pengkabelan Lengkap

```text
       SISI TEGANGAN TINGGI (PLN 220 VAC)           SISI LOGIKA TEGANGAN RENDAH (ISOLASI)
    ======================================         =====================================
    
    [ KABEL FASA L (220V) ] ---[ Sekering 200mA ]---+
                                                    |
                                          +-------------------+
                                          | TRAFO TEGANGAN    |
                                          | ISOLASI GALVANIK  |-----[ Op-Amp Filter ]----> GPIO34 (ADC ESP32)
                                          | (cth: ZMPT101B)   |     + Bias DC 1.65V
                                          +-------------------+
                                                    |         +-----[ Ground Logika ]----> GND ESP32
    [ KABEL NETRAL N (0V) ] ------------------------+

                                                   +-------------------+
                                                   | SENSOR SHT31      |
                                                   | Suhu & Kelembapan |
                                                   +-------------------+
                                                      |     |     |     |
                                                     VCC   GND   SDA   SCL
                                                      |     |     |     |
                                                     3V3   GND  GPIO21 GPIO22
```

---

## 4. Analisis Transduser Tegangan AC: ZMPT101B vs Transduser Industri

### A. Modul ZMPT101B (Transformator Arus Mikro Presisi)
- **Kelebihan**: Ekonomis, banyak tersedia di pasaran, memiliki trafo isolasi mini di dalamnya.
- **Perhatian Keselamatan Khusus**:
  1. *Creepage / Clearance Distance*: Beberapa modul buatan pabrik murah memiliki jarak jalur tembaga sisi primer (220V) dan sekunder (<5V) yang hanya 1–2 mm. Wajib diperiksa di bawah kaca pembesar. Jika terlalu dekat, potong atau buat celah (milling slot) pada PCB untuk mencegah lompatan tegangan.
  2. *Tegangan Output*: Putar trimpot biru multi-turn pada modul agar tegangan puncak-ke-puncak (*peak-to-peak*) output gelombang AC tidak melebihi **0.5V – 2.8V** (berada aman dalam rentang ADC 0 – 3.3V ESP32).

### B. Transduser AC Industri Tertutup (Direkomendasikan untuk Lapangan)
- Contoh: Transduser AC 0–250 VAC dengan output linier 0–3.3V atau 0–5V (dengan pembagi tegangan) bersertifikat CE/UL (seperti seri Seneca, MeanWell, atau LEM).
- Sudah terkalibrasi pabrik dan tahan terhadap lingkungan keras outdoor AC unit.

---

## 5. Checklist Verifikasi Sebelum Menyalakan Daya Listrik

1. [ ] Sirkuit ESP32 dan modul sensor dirakit rapi di atas PCB prototipe bertimah, bukan breadboard lepas.
2. [ ] Sekering kaca cepat (*fast-blow fuse*) 250V 200mA terpasang pada jalur fasa (L).
3. [ ] Jalur sekunder dan primer transduser terpisah minimal 8 mm.
4. [ ] Resistansi isolasi antara pin primer PLN dan pin GPIO ESP32 diuji dengan multimeter (harus tak terhingga / Mega-Ohm).
5. [ ] Pengujian pertama firmware dilakukan dengan kondisi kabel PLN belum dihubungkan (hanya menggunakan sumber daya USB 5V).
6. [ ] Serial Monitor menampilkan suhu dan kelembapan normal SHT31 serta status tegangan `"BELUM_KALIBRASI"`.
