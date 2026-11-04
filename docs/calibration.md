# Panduan Kalibrasi Tegangan Listrik AC True-RMS

Dokumen ini menjelaskan prinsip matematis perhitungan nilai efektif (Root Mean Square / RMS) gelombang sinus AC pada ESP32, karakteristik ADC, dan tata cara kalibrasi dua titik (zero-offset dan gain slope).

---

## 1. Landasan Teori Perhitungan True-RMS

Tegangan AC jala-jala listrik PLN berubah polaritas secara bolak-balik 50 kali dalam satu detik (50 Hz). Satu siklus gelombang penuh berlangsung selama:

$$T = \frac{1}{50\text{ Hz}} = 20\text{ milidetik (ms)}$$

Tegangan efektif (**$V_{RMS}$**) didefinisikan sebagai akar kuadrat dari rata-rata kuadrat tegangan sesaat selama sejumlah siklus bulat:

$$V_{RMS} = \text{Faktor\_Kalibrasi} \times \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} \left( V_{\text{adc}}[i] - V_{\text{offset}} \right)^2}$$

Di mana:
- $N$: Jumlah total sampel diskrit yang diambil (dalam firmware: 5 siklus $\times$ 80 sampel = 400 sampel).
- $V_{\text{adc}}[i]$: Tegangan sesaat pada pin GPIO34 (dikonversi dari nilai digital 12-bit ADC).
- $V_{\text{offset}}$: Tegangan titik tengah bias DC (nominal 1.650 VDC).
- $\text{Faktor\_Kalibrasi}$: Pengali rasio transformasi transduser ke tegangan primer PLN 220V.

---

## 2. Karakteristik ADC ESP32 & Penanganan Non-Linearitas

ADC pada ESP32 memiliki resolusi 12-bit (0–4095) dengan tegangan referensi internal nominal 3.3V (saat atenuasi diatur ke `ADC_11db`). Namun, ADC bawaan ESP32 memiliki ketidaklinieran (*non-linearity*) pada ujung bawah (&lt; 0.15V) dan ujung atas (&gt; 3.1V).

**Solusi Desain Antigravity:**
1. Rangkaian bias transduser diatur agar titik tengah gelombang sinus berada di **1.65V** (tepat di tengah wilayah linear ADC).
2. Amplitudo puncak-ke-puncak (*peak-to-peak*) gelombang AC dibatasi maksimal **2.0 Vpp** (ayunan sinyal berkisar antara 0.65V hingga 2.65V). Dengan cara ini, sinyal tidak akan pernah memasuki wilayah non-linear ADC ESP32.

---

## 3. Langkah-Langkah Kalibrasi

### Tahap 1: Kalibrasi Tegangan Offset Nol (Zero-Bias)
1. Nyalakan ESP32 melalui kabel USB, namun **JANGAN hubungkan input transduser ke sumber listrik PLN** (input 0 VAC).
2. Ukur tegangan DC antara pin `GPIO34` dan `GND` ESP32 menggunakan multimeter DC presisi.
3. Catat nilai terukur (misalnya terbaca **1.648 V**).
4. Jika modul memiliki potensiometer offset (trimpot bias), sesuaikan perlahan hingga mendekati **1.650 V**.
5. Buka [`firmware/config.h`](file:///d:/datalogger/firmware/config.h) dan sesuaikan:
   ```cpp
   #define ADC_ZERO_OFFSET_VOLTS 1.648f
   ```

### Tahap 2: Pengujian Bertahap dengan Tegangan Rendah Terisolasi
1. Untuk mencegah risiko saat pertama kali mencoba, gunakan transformator step-down sekunder 12 VAC atau 24 VAC.
2. Pastikan Serial Monitor membaca tegangan dengan benar tanpa nilai minus atau distorsi.

### Tahap 3: Pengambilan Referensi Multimeter True-RMS PLN
1. Pasang alat ukur multimeter True-RMS bersertifikasi (misal Fluke, Sanwa, atau Uni-T True-RMS) paralel pada stopkontak PLN tempat transduser AC dihubungkan.
2. Catat tegangan aktual yang terukur pada multimeter:
   $$V_{\text{multimeter}} = 222.6\text{ VAC}$$
3. Amati nilai pembacaan mentah pada Serial Monitor ESP32 (dengan `VOLTAGE_CALIBRATION_FACTOR` sementara disetel 1.000):
   $$V_{\text{ESP32\_raw}} = 217.2\text{ VAC}$$
4. Hitung faktor kalibrasi baru:
   $$\text{Faktor} = \frac{V_{\text{multimeter}}}{V_{\text{ESP32\_raw}}} = \frac{222.6}{217.2} = 1.0248$$

### Tahap 4: Mengaktifkan Status Kalibrasi
1. Masukkan hasil kalkulasi ke dalam [`firmware/config.h`](file:///d:/datalogger/firmware/config.h):
   ```cpp
   #define IS_CALIBRATED               true
   #define VOLTAGE_CALIBRATION_FACTOR  1.0248f
   ```
2. Upload kembali firmware ke ESP32.
3. Buka menu **Perangkat** di Web Dashboard:
   - Klik tombol **Edit** pada perangkat yang bersangkutan.
   - Centang opsi **"Tandai Sudah Kalibrasi"**.
   - Masukkan nilai faktor kalibrasi `1.0248`.
   - Klik **Simpan**.
4. Kartu status di dashboard kini akan menampilkan badge hijau **NORMAL (Toleransi PLN)** dan pembacaan dinyatakan valid secara resmi.
