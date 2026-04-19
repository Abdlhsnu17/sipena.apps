import type { MedicalAsset } from "@/types/medical-assets-types"

type MedicalAssetTypeDefinition = {
  label: string
  category: string
  color: string
}

const MEDICAL_ASSET_TYPE_DEFINITIONS: Record<string, MedicalAssetTypeDefinition> = {
 "hospital-bed": {
    label: "Hospital Bed / Tempat Tidur Pasien (Manual/Electric)",
    category: "Perlengkapan Ruang Perawatan",
    color: "bg-slate-100 text-slate-800",
  },
  "bedside-cabinet": {
    label: "Bedside Cabinet (Lemari Pasien)",
    category: "Perlengkapan Ruang Perawatan",
    color: "bg-slate-100 text-slate-800",
  },
  "overbed-table": {
    label: "Overbed Table (Meja Makan Pasien)",
    category: "Perlengkapan Ruang Perawatan",
    color: "bg-slate-100 text-slate-800",
  },
  "iv-pole": {
    label: "IV Pole / Tiang Infus",
    category: "Perlengkapan Ruang Perawatan",
    color: "bg-slate-100 text-slate-800",
  },
  "bedside-commode": {
    label: "Bedside Commode/Urinal (Penunjang)",
    category: "Perlengkapan Ruang Perawatan",
    color: "bg-slate-100 text-slate-800",
  },
  "trolley-medication": {
    label: "Trolley Tindakan/Obat",
    category: "Perlengkapan Ruang Perawatan",
    color: "bg-slate-100 text-slate-800",
  },
  "emergency-bed": {
    label: "Emergency Bed / Stretcher Bed",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  // =========================
  // MONITORING & PEMERIKSAAN
  // =========================
  "patient-monitor": {
    label: "Patient Monitor (ECG/NIBP/SpO₂/Temp)",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "central-monitoring": {
    label: "Central Monitoring System",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  thermometer: {
    label: "Thermometer Digital/Infrared",
    category: "Alat Kesehatan Dasar dan P3K",
    color: "bg-cyan-100 text-cyan-800",
  },
  sphygmomanometer: {
    label: "Sphygmomanometer (Tensimeter) Manual/Digital",
    category: "Alat Kesehatan Dasar dan P3K",
    color: "bg-cyan-100 text-cyan-800",
  },
  stethoscope: {
    label: "Stethoscope",
    category: "Alat Kesehatan Dasar dan P3K",
    color: "bg-cyan-100 text-cyan-800",
  },
  "pulse-oximeter": {
    label: "Pulse Oximeter",
    category: "Alat Kesehatan Dasar dan P3K",
    color: "bg-cyan-100 text-cyan-800",
  },
  glucometer: {
    label: "Glucometer",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  otoscope: {
    label: "Otoscope",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  ophthalmoscope: {
    label: "Ophthalmoscope",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  "reflex-hammer": {
    label: "Reflex Hammer",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  "tuning-fork": {
    label: "Tuning Fork",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  "examination-bed": {
    label: "Medical Examination Bed / Bed Periksa",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  "examination-lamp": {
    label: "Examination Lamp / Lampu Periksa",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },
  "medical-examination-lamp": {
    label: "Medical Examination Lamp (Lampu Periksa)",
    category: "Alat Pemeriksaan & Tindakan",
    color: "bg-cyan-100 text-cyan-800",
  },

  // =========================
  // TERAPI, OKSIGEN, NAFAS
  // =========================
  "oxygen-flowmeter": {
    label: "Oxygen Flowmeter & Humidifier",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "oxygen-cylinder": {
    label: "Oxygen Cylinder + Regulator (Portable)",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "portable-oxygen-cylinder": {
    label: "Portable Oxygen Cylinder",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "oxygen-concentrator": {
    label: "Oxygen Concentrator",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  nebulizer: {
    label: "Nebulizer",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "suction-pump": {
    label: "Suction Pump (Portable)",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "wall-suction": {
    label: "Suction Pump (Wall Suction)",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "infusion-pump": {
    label: "Infusion Pump",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "syringe-pump": {
    label: "Syringe Pump",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  ventilator: {
    label: "Ventilator",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "ventilator-transport": {
    label: "Ventilator Transport",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "ventilator-portable": {
    label: "Portable Ventilator",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  hfnc: {
    label: "HFNC (High Flow Nasal Cannula)",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  cpap: {
    label: "CPAP",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  bipap: {
    label: "BiPAP",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "bag-valve-mask-bvm": {
    label: "Bag Valve Mask (BVM)",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "ambu-bag": {
    label: "Ambu Bag (Adult)",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  // =========================
  // JANTUNG & RESUSITASI
  // =========================
  ekg: {
    label: "ECG/EKG (Portable/Bedside)",
    category: "Alat Diagnostik dan Pencitraan",
    color: "bg-blue-100 text-blue-800",
  },
  "ekg-12-lead": {
    label: "ECG/EKG (12 Lead)",
    category: "Alat Diagnostik dan Pencitraan",
    color: "bg-blue-100 text-blue-800",
  },
  "defibrillator-manual": {
    label: "Defibrillator Manual",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "defibrillator-aed": {
    label: "Defibrillator AED",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "crash-cart": {
    label: "Emergency Crash Cart",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  // =========================
  // AIRWAY & TRAUMA IGD
  // =========================
  laryngoscope: {
    label: "Laryngoscope Set",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "video-laryngoscope": {
    label: "Video Laryngoscope",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "portable-xray-igd": {
    label: "Portable X-Ray (IGD)",
    category: "Alat Diagnostik dan Pencitraan",
    color: "bg-blue-100 text-blue-800",
  },
  "usg-pocus": {
    label: "USG Bedside / POCUS",
    category: "Alat Diagnostik dan Pencitraan",
    color: "bg-blue-100 text-blue-800",
  },
  "blood-gas-analyzer": {
    label: "Blood Gas Analyzer (POCT)",
    category: "Alat Laboratorium Medis",
    color: "bg-purple-100 text-purple-800",
  },
  "spine-board": {
    label: "Spine Board",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },
  "cervical-collar": {
    label: "Cervical Collar",
    category: "Alat Gawat Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  // =========================
  // POLI / STERILISASI MINI
  // =========================
  "autoclave-mini": {
    label: "Autoclave Kecil / Sterilizer Kecil",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "minor-surgery-set": {
    label: "Minor Surgery Set (Set Jahit Luka Ringan)",
    category: "Set Instrumen",
    color: "bg-gray-100 text-gray-800",
  },
  "emergency-set": {
    label: "Emergency Set (Oksigen Portable + Ambu Bag)",
    category: "Set Instrumen",
    color: "bg-gray-100 text-gray-800",
  },

  // =========================
  // SET PERAWATAN LUKA (PENGGANTI “GANTI BALUT”)
  // =========================
  "wound-care-set-minor": {
    label: "Set Ganti Balut Kecil(GBK)",
    category: "Set Instrumen",
    color: "bg-gray-100 text-gray-800",
  },
  "wound-care-set-major": {
    label: "Set Ganti Balut Sedang (GBS)",
    category: "Set Instrumen",
    color: "bg-gray-100 text-gray-800",
  },
  
  // =========================
  // OBSTETRI / IGD KEBIDANAN
  // =========================
  "delivery-bed": {
    label: "Delivery Bed / Bed Persalinan",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  ctg: {
    label: "CTG (Cardiotocography)",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "fetal-monitor": {
    label: "Fetal Monitor",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "doppler-fetal": {
    label: "Doppler Fetal",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "maternal-monitor": {
    label: "Maternal Patient Monitor",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "crash-cart-obgyn": {
    label: "Emergency Crash Cart (Obstetri)",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "baby-resuscitation-unit": {
    label: "Baby Resuscitation Unit",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "ambu-bag-neonatal": {
    label: "Ambu Bag Neonatal",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "vacuum-extractor": {
    label: "Vacuum Extractor",
    category: "Alat Kebidanan dan Kandungan",
    color: "bg-pink-100 text-pink-800",
  },
  "usg-obgyn": {
    label: "USG (Portable/Ruang Kebidanan)",
    category: "Alat Diagnostik dan Pencitraan",
    color: "bg-blue-100 text-blue-800",
  },
  "delivery-set-sterile": {
    label: "Set Persalinan Steril",
    category: "Set Instrumen",
    color: "bg-gray-100 text-gray-800",
  },
  "perineum-suture-set": {
    label: "Instrument Set Jahit Perineum",
    category: "Set Instrumen",
    color: "bg-gray-100 text-gray-800",
  },
  phototherapy: {
    label: "Phototherapy Unit",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "infant-warmer": {
    label: "Infant Warmer",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },

  // SET OPERASI KEBIDANAN (yang Anda minta)
  "obgyn-set-sc": {
    label: "Set Operasi Sectio Caesarea",
    category: "Set Operasi Kebidanan",
    color: "bg-gray-100 text-gray-800",
  },
  "obgyn-set-curettage": {
    label: "Set Operasi Kuretase",
    category: "Set Operasi Kebidanan",
    color: "bg-gray-100 text-gray-800",
  },
  "obgyn-set-ponek": {
    label: "Set Operasi Emergency Obstetri (PONEK)",
    category: "Set Operasi Kebidanan",
    color: "bg-gray-100 text-gray-800",
  },

  // =========================
  // HEMODIALISIS
  // =========================
  hemodialisa: {
    label: "Hemodialysis Machine",
    category: "Hemodialisis",
    color: "bg-amber-100 text-amber-800",
  },
  "hd-chair-bed": {
    label: "Hemodialysis Chair / Bed HD",
    category: "Hemodialisis",
    color: "bg-amber-100 text-amber-800",
  },
  "water-treatment-ro": {
    label: "Water Treatment System (RO) untuk HD",
    category: "Hemodialisis",
    color: "bg-amber-100 text-amber-800",
  },
  "dialysate-mixing": {
    label: "Dialysate Mixing System",
    category: "Hemodialisis",
    color: "bg-amber-100 text-amber-800",
  },
  "hd-monitor": {
    label: "Patient Monitor (HD/Bedside Monitor)",
    category: "Hemodialisis",
    color: "bg-amber-100 text-amber-800",
  },
  "blood-warmer": {
    label: "Blood Warmer",
    category: "Alat Terapi dan Perawatan",
    color: "bg-green-100 text-green-800",
  },
  "patient-scale": {
    label: "Scales / Timbangan Pasien (Pre-Post HD)",
    category: "Hemodialisis",
    color: "bg-amber-100 text-amber-800",
  },

  // =========================
  // KEMOTERAPI
  // =========================
  "chemo-chair": {
    label: "Chemotherapy Chair / Bed Kemoterapi",
    category: "Kemoterapi",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  bsc: {
    label: "Laminar Air Flow / Biological Safety Cabinet",
    category: "Kemoterapi",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "chemo-fridge": {
    label: "Refrigerator Obat (Khusus Kemoterapi)",
    category: "Kemoterapi",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "spill-kit": {
    label: "PPE & Spill Kit Kemoterapi",
    category: "Kemoterapi",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },

  // =========================
  // ICU / HCU
  // =========================
  "icu-bed": {
    label: "ICU Bed",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  "icu-monitor": {
    label: "ICU Patient Monitor (Multi-Parameter)",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  "central-monitoring-icu": {
    label: "Central Monitoring System (ICU)",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  "ventilator-icu": {
    label: "Ventilator ICU",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  capnography: {
    label: "Capnography Monitor",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  "gas-analyzer": {
    label: "Gas Analyzer (Anestesi/ICU tertentu)",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  "fluid-warmer": {
    label: "Fluid Warmer",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  ecmo: {
    label: "ECMO Machine",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },
  "crash-cart-icu": {
    label: "Emergency Crash Cart (ICU)",
    category: "Alat ICU/HCU",
    color: "bg-orange-100 text-orange-800",
  },

  // =========================
  // NICU / PERINATOLOGI
  // =========================
  incubator: {
    label: "Infant Incubator",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "neonatal-monitor": {
    label: "Neonatal Monitor",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "pulse-oximeter-neonatal": {
    label: "Pulse Oximeter Neonatal",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "neonatal-cpap": {
    label: "Neonatal CPAP",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "neonatal-ventilator": {
    label: "Neonatal Ventilator",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "suction-neonatal": {
    label: "Suction Unit Neonatal",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "infant-scale": {
    label: "Infant Scale",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "oxygen-blender": {
    label: "Oxygen Blender",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "oxygen-flowmeter-neonatal": {
    label: "Oxygen Flowmeter Neonatal",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "thermometer-neonatal": {
    label: "Thermometer Neonatal",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "neonatal-resus-trolley": {
    label: "Trolley Resusitasi Bayi",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "nicu-incubator-intensive": {
    label: "Neonatal ICU Bed / Incubator Intensive",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "hfnc-neonatal": {
    label: "HFNC Neonatal",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "central-monitoring-nicu": {
    label: "Central Monitoring System (NICU)",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "infusion-pump-neonatal": {
    label: "Infusion Pump (Neonatal Compatible)",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },
  "syringe-pump-neonatal": {
    label: "Syringe Pump (Neonatal)",
    category: "Perinatologi / NICU",
    color: "bg-indigo-100 text-indigo-800",
  },

  // =========================
  // IBS / OK (BEDAH)
  // =========================
  "operating-table": {
    label: "Operating Table",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "operating-lamp": {
    label: "Operating Lamp (Shadowless)",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "anesthesia-machine": {
    label: "Anesthesia Machine",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "anesthesia-workstation": {
    label: "Anesthesia Workstation",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "anesthesia-ventilator": {
    label: "Anesthesia Ventilator",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "anesthesia-monitor": {
    label: "Anesthesia Monitor",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  esu: {
    label: "Electrosurgical Unit (ESU)",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  diathermy: {
    label: "Diathermy Machine",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "surgical-suction": {
    label: "Surgical Suction System",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "c-arm": {
    label: "C-Arm Imaging",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "laparoscopy-tower": {
    label: "Laparoscopy Tower",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "endoscopic-camera": {
    label: "Endoscopic Camera System",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "insufflator-co2": {
    label: "Insufflator CO₂",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  laparoscope: {
    label: "Laparoscope",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  arthroscope: {
    label: "Arthroscope",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "microsurgery-set": {
    label: "Microsurgery Instrument Set",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "surgical-instrument-set": {
    label: "Surgical Instrument Set (Major/Minor)",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "portable-anesthesia-workstation": {
    label: "Portable Anesthesia Workstation",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "ventilator-anesthesia-portable": {
    label: "Ventilator (Anestesi/Portable)",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "crash-cart-ok": {
    label: "Emergency Crash Cart (OK)",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "rapid-infuser": {
    label: "Rapid Infuser",
    category: "Alat Bedah dan Operasi",
    color: "bg-red-100 text-red-800",
  },
  "instrument-set-cito": {
    label: "Instrument Set Cito (Laparotomi/Ortopedi/Trauma)",
    category: "Set Operasi Bedah",
    color: "bg-gray-100 text-gray-800",
  },
  "portable-xray-ok": {
    label: "Portable X-Ray (Akses Area Bedah)",
    category: "Alat Diagnostik dan Pencitraan",
    color: "bg-blue-100 text-blue-800",
  },

  // =========================
  // LABORATORIUM DIAGNOSTIK
  // =========================
  "hematology-analyzer": {
    label: "Hematology Analyzer (3-part / 5-part)",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "clinical-chemistry-analyzer": {
    label: "Clinical Chemistry Analyzer",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "immunoassay-analyzer": {
    label: "Immunoassay Analyzer",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "urine-analyzer": {
    label: "Urine Analyzer",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "blood-culture-system": {
    label: "Blood Culture System",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "microbiology-incubator": {
    label: "Microbiology Incubator",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "biosafety-cabinet-lab": {
    label: "Biosafety Cabinet (Lab)",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "pcr-analyzer": {
    label: "PCR Analyzer (Real-Time PCR)",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "genexpert-system": {
    label: "GeneXpert System",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "elisa-reader-washer": {
    label: "ELISA Reader & Washer",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "centrifuge-lab-blood-bank": {
    label: "Centrifuge (Lab & Blood Bank)",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "coagulation-analyzer": {
    label: "Coagulation Analyzer (Lab)",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "hba1c-analyzer": {
    label: "HbA1c Analyzer",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "electrolyte-analyzer": {
    label: "Electrolyte Analyzer",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "pathology-grossing-station": {
    label: "Pathology Grossing Station",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "tissue-processor": {
    label: "Tissue Processor",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "microtome": {
    label: "Microtome",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "cryostat": {
    label: "Cryostat",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "slide-stainer": {
    label: "Slide Stainer (H&E / IHC)",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },
  "digital-pathology-scanner": {
    label: "Digital Pathology Scanner",
    category: "Laboratorium Diagnostik",
    color: "bg-orange-100 text-orange-800",
  },

  // =========================
  // BLOOD BANK & BIOLOGICS
  // =========================
  "blood-bank-refrigerator": {
    label: "Blood Bank Refrigerator",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "plasma-freezer": {
    label: "Plasma Freezer (-30°C / -80°C)",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "platelet-agitator-incubator": {
    label: "Platelet Agitator & Incubator",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "blood-thawing-system": {
    label: "Blood Thawing System",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "blood-irradiator": {
    label: "Blood Irradiator",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "apheresis-machine": {
    label: "Apheresis Machine",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "blood-bag-sealer": {
    label: "Blood Bag Sealer",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "hemoglobinometer": {
    label: "Hemoglobinometer",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },
  "crossmatch-analyzer": {
    label: "Crossmatch Analyzer",
    category: "Blood Bank & Biologics",
    color: "bg-fuchsia-100 text-fuchsia-800",
  },

  // =========================
  // STERILISASI & CSSD
  // =========================
  "steam-generator-autoclave": {
    label: "Steam Generator Autoclave",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "pass-through-autoclave": {
    label: "Pass-Through Autoclave",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "instrument-tracking-system-rfid": {
    label: "Instrument Tracking System (RFID)",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "endoscope-reprocessor-aer": {
    label: "Endoscope Reprocessor (AER)",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "drying-cabinet-endoscope": {
    label: "Drying Cabinet Endoscope",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "sterile-storage-cabinet-hepa": {
    label: "Sterile Storage Cabinet (HEPA)",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "packing-sealing-machine": {
    label: "Packing & Sealing Machine",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "bowie-dick-test-system": {
    label: "Bowie-Dick Test System",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },
  "chemical-biological-indicator-reader": {
    label: "Chemical & Biological Indicator Reader",
    category: "Sterilisasi & CSSD",
    color: "bg-teal-100 text-teal-800",
  },

  // =========================
  // HEMODINAMIKA & ICU
  // =========================
  "hemodynamic-monitoring-system": {
    label: "Hemodynamic Monitoring System",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  "cardiac-output-monitor": {
    label: "Cardiac Output Monitor",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  iabp: {
    label: "IABP (Intra-Aortic Balloon Pump)",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  "nitric-oxide-delivery-system": {
    label: "Nitric Oxide Delivery System",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  "bed-scale-icu-integrated": {
    label: "Bed Scale (ICU Integrated)",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  "pressure-ulcer-prevention-system": {
    label: "Pressure Ulcer Prevention System",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  "closed-suction-system": {
    label: "Closed Suction System",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },
  "icu-ceiling-pendant": {
    label: "ICU Ceiling Pendant (Gas & Electric)",
    category: "Hemodinamika & ICU",
    color: "bg-rose-100 text-rose-800",
  },

  // =========================
  // NEUROLOGI & MONITORING
  // =========================
  "eeg-system": {
    label: "EEG System",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },
  "emg-nerve-conduction-study": {
    label: "EMG / Nerve Conduction Study",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },
  "tcd-transcranial-doppler": {
    label: "TCD (Transcranial Doppler)",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },
  "intracranial-pressure-monitor": {
    label: "Intracranial Pressure Monitor (ICP)",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },
  "brain-oxygen-monitor": {
    label: "Brain Oxygen Monitor",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },
  "neuro-navigation-system": {
    label: "Neuro Navigation System",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },
  "stereotactic-frame": {
    label: "Stereotactic Frame",
    category: "Neurologi & Neuro Monitoring",
    color: "bg-indigo-100 text-indigo-800",
  },

  // =========================
  // OFTALMOLOGI & OPTOMETRI
  // =========================
  "slit-lamp": {
    label: "Slit Lamp",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "fundus-camera": {
    label: "Fundus Camera",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "oct-scanner": {
    label: "OCT (Optical Coherence Tomography)",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "auto-refractometer": {
    label: "Auto Refractometer",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "phacoemulsification-system": {
    label: "Phacoemulsification System",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "yag-laser": {
    label: "YAG Laser",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "operating-microscope-eye": {
    label: "Operating Microscope (Eye)",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },
  "visual-field-analyzer": {
    label: "Visual Field Analyzer",
    category: "Oftalmologi & Optometri",
    color: "bg-cyan-100 text-cyan-800",
  },

  // =========================
  // DENTAL & ENT
  // =========================
  "dental-unit": {
    label: "Dental Unit",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "dental-xray": {
    label: "Dental X-Ray",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "panoramic-xray-opg": {
    label: "Panoramic X-Ray (OPG)",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "cbct-dental": {
    label: "CBCT Dental",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "ultrasonic-scaler": {
    label: "Ultrasonic Scaler",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "dental-autoclave": {
    label: "Dental Autoclave",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "dental-suction-system": {
    label: "Dental Suction System",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "ent-examination-unit": {
    label: "ENT Examination Unit",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  audiometer: {
    label: "Audiometer",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  tympanometer: {
    label: "Tympanometer",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "endoscopy-ent-tower": {
    label: "Endoscopy ENT Tower",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "ent-microscope": {
    label: "ENT Microscope",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "coblator-system": {
    label: "Coblator System",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },
  "hearing-screening-device": {
    label: "Hearing Screening Device (OAE/ABR)",
    category: "Dental & ENT",
    color: "bg-purple-100 text-purple-800",
  },

  // =========================
  // REHABILITASI & MOBILITAS
  // =========================
  "parallel-bar": {
    label: "Parallel Bar",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "gait-trainer": {
    label: "Gait Trainer",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "standing-frame": {
    label: "Standing Frame",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "robotic-gait-training-system": {
    label: "Robotic Gait Training System",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "upper-limb-rehabilitation-robot": {
    label: "Upper Limb Rehabilitation Robot",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "balance-trainer-system": {
    label: "Balance Trainer System",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "wheelchair-medical-grade": {
    label: "Wheelchair Medical Grade",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },
  "patient-hoist-lifter": {
    label: "Patient Hoist / Lifter",
    category: "Rehabilitasi & Mobilitas",
    color: "bg-amber-100 text-amber-800",
  },

  // =========================
  // KEAMANAN & MONITORING PASIEN
  // =========================
  "anti-fall-monitoring-system": {
    label: "Anti-Fall Monitoring System",
    category: "Keamanan & Monitoring Pasien",
    color: "bg-slate-100 text-slate-800",
  },
  "patient-fall-detection-system": {
    label: "Patient Fall Detection System",
    category: "Keamanan & Monitoring Pasien",
    color: "bg-slate-100 text-slate-800",
  },
  "nurse-call-system-medical": {
    label: "Nurse Call System",
    category: "Keamanan & Monitoring Pasien",
    color: "bg-slate-100 text-slate-800",
  },
  "bed-exit-alarm": {
    label: "Bed Exit Alarm",
    category: "Keamanan & Monitoring Pasien",
    color: "bg-slate-100 text-slate-800",
  },
  "medical-gas-alarm-system": {
    label: "Medical Gas Alarm System",
    category: "Keamanan & Monitoring Pasien",
    color: "bg-slate-100 text-slate-800",
  },

  // =========================
  // FARMASI & PENYIMPANAN SENSITIF
  // =========================
  "temperature-humidity-monitoring-pharmacy-cssd": {
    label: "Temperature & Humidity Monitoring (Pharmacy/CSSD)",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },
  "refrigerator-monitoring-vaccine-drug": {
    label: "Refrigerator Monitoring System (Vaccine/Drug)",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },
  "ups-medical-grade": {
    label: "UPS Medical Grade",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },
  "isolation-room-pressure-monitor": {
    label: "Isolation Room Pressure Monitor",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },
  "medical-refrigerator": {
    label: "Medical Refrigerator (Drug/Vaccine)",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },
  "warming-cabinet": {
    label: "Warming Cabinet (Blanket/Fluid)",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },
  "medication-cart-locked": {
    label: "Medication Cart (Locked)",
    category: "Farmasi & Penyimpanan Sensitif",
    color: "bg-sky-100 text-sky-800",
  },

  // =========================
  // TELEHEALTH & IDENTIFIKASI PASIEN
  // =========================
  "smart-iv-pole": {
    label: "Smart IV Pole",
    category: "Telehealth & Identifikasi Pasien",
    color: "bg-blue-100 text-blue-800",
  },
  "mobile-workstation-wow": {
    label: "Mobile Workstation on Wheels (WOW)",
    category: "Telehealth & Identifikasi Pasien",
    color: "bg-blue-100 text-blue-800",
  },
  "telemedicine-cart": {
    label: "Telemedicine Cart",
    category: "Telehealth & Identifikasi Pasien",
    color: "bg-blue-100 text-blue-800",
  },
  "digital-consent-system-bedside": {
    label: "Digital Consent System (Bedside)",
    category: "Telehealth & Identifikasi Pasien",
    color: "bg-blue-100 text-blue-800",
  },
  "smart-patient-id-wristband-system": {
    label: "Smart Patient ID Wristband System",
    category: "Telehealth & Identifikasi Pasien",
    color: "bg-blue-100 text-blue-800",
  },


  // SET OPERASI BEDAH (yang Anda minta)
  "surgery-set-minor": {
    label: "Set Operasi Bedah Minor",
    category: "Set Operasi Bedah",
    color: "bg-gray-100 text-gray-800",
  },
  "surgery-set-major": {
    label: "Set Operasi Bedah Mayor",
    category: "Set Operasi Bedah",
    color: "bg-gray-100 text-gray-800",
  },

  // =========================
  // (Opsional) Tambahkan imaging high-end di RS Tipe A
  // =========================
  "pet-ct": {
    label: "PET-CT",
    category: "Penunjang & Khusus RS Tipe A",
    color: "bg-teal-100 text-teal-800",
  },
  dsa: {
    label: "DSA / Cath Lab",
    category: "Penunjang & Khusus RS Tipe A",
    color: "bg-teal-100 text-teal-800",
  },
}


export type MedicalAssetTypeOption = {
  value: MedicalAsset["type"]
  label: string
  category: string
}

export const MEDICAL_ASSET_TYPE_OPTIONS: MedicalAssetTypeOption[] = (
  Object.keys(MEDICAL_ASSET_TYPE_DEFINITIONS) as MedicalAsset["type"][]
).map((type) => ({
  value: type,
  label: MEDICAL_ASSET_TYPE_DEFINITIONS[type].label,
  category: MEDICAL_ASSET_TYPE_DEFINITIONS[type].category,
}))

export const getMedicalAssetTypeLabel = (type?: string) => {
  if (!type) return ""
  const entry = MEDICAL_ASSET_TYPE_DEFINITIONS[type as MedicalAsset["type"]]
  return entry?.label ?? type
}

export const getMedicalAssetTypeColor = (type?: string) => {
  if (!type) return "bg-gray-100 text-gray-800"
  const entry = MEDICAL_ASSET_TYPE_DEFINITIONS[type as MedicalAsset["type"]]
  return entry?.color ?? "bg-gray-100 text-gray-800"
}
