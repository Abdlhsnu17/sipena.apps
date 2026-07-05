type NonMedicalAssetTypeDefinition = {
  label: string
  category: string
  color: string
}

export const NON_MEDICAL_ASSET_TYPE_DEFINITIONS = {
  // =========================
  // IT dan ELEKTRONIK
  // =========================
  laptop: {
    label: "Laptop",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  notebook: {
    label: "Notebook",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "pc-desktop": {
    label: "PC Desktop dan Monitor",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  printer: {
    label: "Printer / Scanner",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  server: {
    label: "Server dan Network Rack",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "wifi-router": {
    label: "WiFi Router / Access Point",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  ups: {
    label: "UPS (Uninterruptible Power Supply)",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  // =========================
  // FURNITURE KANTOR
  // =========================
  "office-desk": {
    label: "Meja Kantor (Staff/Executive)",
    category: "Furniture Kantor",
    color: "bg-amber-100 text-amber-800",
  },
  "office-chair": {
    label: "Kursi Kantor (Ergonomis)",
    category: "Furniture Kantor",
    color: "bg-amber-100 text-amber-800",
  },
  "kursi-kerja": {
    label: "Kursi Kerja",
    category: "Furniture Kantor",
    color: "bg-amber-100 text-amber-800",
  },
  "filing-cabinet": {
    label: "Lemari Arsip / Filing Cabinet",
    category: "Furniture Kantor",
    color: "bg-amber-100 text-amber-800",
  },
  "meeting-table": {
    label: "Meja Rapat / Meeting Table",
    category: "Furniture Kantor",
    color: "bg-amber-100 text-amber-800",
  },

  // =========================
  // PERLENGKAPAN UMUM
  // =========================
  "waiting-chair": {
    label: "Kursi Tunggu (Deret/Besi)",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },
  sofa: {
    label: "Sofa Tamu",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },
  "ac-split": {
    label: "AC Split / Cassette",
    category: "Perlengkapan Umum",
    color: "bg-cyan-100 text-cyan-800",
  },
  tv: {
    label: "Televisi (TV)",
    category: "Perlengkapan Umum",
    color: "bg-cyan-100 text-cyan-800",
  },
  dispenser: {
    label: "Water Dispenser",
    category: "Perlengkapan Umum",
    color: "bg-cyan-100 text-cyan-800",
  },
  refrigerator: {
    label: "Kulkas / Refrigerator (Pantry)",
    category: "Perlengkapan Umum",
    color: "bg-cyan-100 text-cyan-800",
  },
  "sofa-kursi-penunggu": {
    label: "Sofa / Kursi Penunggu",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },
  "digital-clock-led": {
    label: "Digital Clock LED",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },
  "display-informasi-ruangan": {
    label: "Display Informasi Lokal",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },
  "jam-dinding-ruangan": {
    label: "Jam Dinding Lokal",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },
  "jam-meja-meja-perawat-admin": {
    label: "Jam Meja (Meja Perawat/Admin)",
    category: "Perlengkapan Umum",
    color: "bg-slate-100 text-slate-800",
  },

  // =========================
  // KENDARAAN OPERASIONAL
  // =========================
  "operational-car": {
    label: "Mobil Operasional",
    category: "Kendaraan Operasional",
    color: "bg-zinc-100 text-zinc-800",
  },
  motorcycle: {
    label: "Motor Operasional",
    category: "Kendaraan Operasional",
    color: "bg-zinc-100 text-zinc-800",
  },
  ambulance: {
    label: "Ambulans",
    category: "Kendaraan Operasional",
    color: "bg-zinc-100 text-zinc-800",
  },
  "fleet-management-system-ambulans": {
    label: "Fleet Management System (ambulans)",
    category: "Kendaraan Operasional",
    color: "bg-zinc-100 text-zinc-800",
  },
  "pickup-box-logistic": {
    label: "Pickup/Box Logistic",
    category: "Kendaraan Operasional",
    color: "bg-zinc-100 text-zinc-800",
  },

  // =========================
  // KELISTRIKAN dan POWER SYSTEM
  // =========================
  "genset-generator-set": {
    label: "Genset (Generator Set)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "panel-ats-amf": {
    label: "Panel ATS/AMF",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "stabilizer-avr": {
    label: "Stabilizer/AVR",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "panel-distribusi-mdp-sdp": {
    label: "Panel Distribusi (MDP/SDP)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "mcb-mccb-elcb": {
    label: "MCB/MCCB/ELCB",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "trafo-distribusi": {
    label: "Trafo Distribusi",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "busbar-trunking": {
    label: "Busbar Trunking",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "kabel-power-grounding-system": {
    label: "Kabel Power dan Grounding System",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "grounding-rod-earth-pit": {
    label: "Grounding Rod dan Earth Pit",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "lightning-arrester-penangkal-petir": {
    label: "Lightning Arrester (Penangkal Petir)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "surge-protection-device-spd": {
    label: "Surge Protection Device (SPD)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "emergency-lamp-exit-sign": {
    label: "Emergency Lamp / Exit Sign",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "meteran-listrik-kwh-meter": {
    label: "Meteran Listrik (kWh Meter)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "power-factor-correction-capacitor-bank": {
    label: "Power Factor Correction (Capacitor Bank)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "power-quality-analyzer-alat-ukur-kelistrikan": {
    label: "Power Quality Analyzer (alat ukur kelistrikan)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  // =========================
  // HVAC dan TATA UDARA
  // =========================
  "ac-sentral-chiller-system": {
    label: "AC Sentral (Chiller System)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  chiller: {
    label: "Chiller",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "cooling-tower": {
    label: "Cooling Tower",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  boiler: {
    label: "Boiler (jika ada)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "heat-pump-water-heater": {
    label: "Heat Pump Water Heater (jika ada)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "air-handling-unit-ahu": {
    label: "Air Handling Unit (AHU)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "fan-coil-unit-fcu": {
    label: "Fan Coil Unit (FCU)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "ducting-diffuser": {
    label: "Ducting dan Diffuser",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "exhaust-fan": {
    label: "Exhaust Fan",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "fresh-air-fan": {
    label: "Fresh Air Fan",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  blower: {
    label: "Blower",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "hepa-filter-unit": {
    label: "HEPA Filter Unit (untuk ruang operasi/isolasi)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  dehumidifier: {
    label: "Dehumidifier (pengatur kelembapan)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  humidifier: {
    label: "Humidifier (pengatur kelembapan)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "thermostat-building-hvac-controller": {
    label: "Thermostat dan Building HVAC Controller",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "vfd-hvac": {
    label: "Variable Frequency Drive (VFD) HVAC",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  // =========================
  // PROTEKSI KEBAKARAN
  // =========================
  "apar-alat-pemadam-api-ringan": {
    label: "APAR (Alat Pemadam Api Ringan)",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "hydrant-pillar": {
    label: "Hydrant Pillar",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "hydrant-box": {
    label: "Hydrant Box",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "fire-hose-nozzle": {
    label: "Fire Hose dan Nozzle",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "fire-pump": {
    label: "Fire Pump (Jockey/Main/Diesel Pump)",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "sprinkler-system": {
    label: "Sprinkler System",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  facp: {
    label: "Fire Alarm Control Panel (FACP)",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "smoke-detector": {
    label: "Smoke Detector",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "heat-detector": {
    label: "Heat Detector",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "manual-call-point": {
    label: "Manual Call Point",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "alarm-bell-siren-strobe": {
    label: "Alarm Bell/Siren/Strobe",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "fire-door-fire-damper": {
    label: "Fire Door dan Fire Damper",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "emergency-exit-lighting-system": {
    label: "Emergency Exit Lighting System",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "fire-blanket": {
    label: "Fire Blanket",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "hydrant-system": {
    label: "Hydrant System (jika dicatat terpisah)",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  "sistem-alarm-kebakaran": {
    label: "Sistem Alarm Kebakaran",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-red-100 text-red-800",
  },
  // =========================
  // Keselamatan Darurat
  // =========================
  "emergency-stretcher": {
    label: "Emergency Stretcher",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "tandu-lipat": {
    label: "Tandu Lipat",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "evacuation-chair": {
    label: "Evacuation Chair",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "emergency-flashlight": {
    label: "Emergency Flashlight",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "emergency-toolkit": {
    label: "Emergency Toolkit",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "first-aid-kit-p3k": {
    label: "First Aid Kit (P3K)",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "oxygen-signage-ruangan": {
    label: "Oxygen Signage Lokal",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "emergency-instruction-board": {
    label: "Emergency Instruction Board",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  "panic-button-ruangan": {
    label: "Panic Button Lokal",
    category: "Keselamatan Darurat",
    color: "bg-rose-100 text-rose-800",
  },

  // =========================
  // Dapur dan Pantry
  // =========================
  "food-trolley": {
    label: "Food Trolley",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "meal-cart": {
    label: "Meal Cart",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "dispenser-air-panas": {
    label: "Dispenser Air Panas",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "dispenser-air-dingin": {
    label: "Dispenser Air Dingin",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "dispenser-air-panas-and-dingin": {
    label: "Dispenser Air Panas dan Dingin",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "rice-cooker-ruangan": {
    label: "Rice Cooker Lokal",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "microwave-ruangan": {
    label: "Microwave Lokal",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "pemanas-makanan": {
    label: "Pemanas Makanan",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  "rak-peralatan-makan": {
    label: "Rak Peralatan Makan",
    category: "Dapur dan Pantry",
    color: "bg-amber-100 text-amber-800",
  },

  // =========================
  // Logistik dan Penyimpanan
  // =========================
  "rak-logistik-ruangan": {
    label: "Rak Logistik Lokal",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "rak-besi": {
    label: "Rak Besi",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "rak-stainless-steel": {
    label: "Rak Stainless Steel",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "container-box-plastik": {
    label: "Container Box Plastik",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "box-penyimpanan-medis": {
    label: "Box Penyimpanan Medis",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "troli-logistik-ruangan": {
    label: "Troli Logistik Lokal",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "hand-trolley": {
    label: "Hand Trolley",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "timbangan-digital-ruangan": {
    label: "Timbangan Digital Lokal",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "locker-penyimpanan": {
    label: "Locker Penyimpanan",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "rak-penyimpanan-alat": {
    label: "Rak Penyimpanan Alat",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "rak-linen": {
    label: "Rak Linen",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "troli-serbaguna-ruangan": {
    label: "Troli Serbaguna Lokal",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "troli-linen": {
    label: "Troli Linen",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  "troli-logistik-kecil": {
    label: "Troli Logistik Kecil",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },
  "rak-dokumen-medis": {
    label: "Rak Dokumen Medis",
    category: "Logistik dan Penyimpanan",
    color: "bg-slate-100 text-slate-800",
  },

  // =========================
  // Identifikasi Aset
  // =========================
  "label-barcode-asset": {
    label: "Label Barcode Asset",
    category: "Identifikasi Aset",
    color: "bg-purple-100 text-purple-800",
  },

  "label-rak-inventaris": {
    label: "Label Rak Inventaris",
    category: "Identifikasi Aset",
    color: "bg-purple-100 text-purple-800",
  },

  // =========================
  // Sanitasi dan Kebersihan
  // =========================
  "wastafel-stainless-steel-ruangan": {
    label: "Wastafel Stainless Steel Lokal",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "keran-air-sensor": {
    label: "Keran Air Sensor",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "hand-sanitizer-dispenser": {
    label: "Hand Sanitizer Dispenser",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "soap-dispenser": {
    label: "Soap Dispenser",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "tissue-dispenser": {
    label: "Tissue Dispenser",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "tempat-sampah-medis": {
    label: "Tempat Sampah Medis",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "tempat-sampah-non-medis": {
    label: "Tempat Sampah Non Medis",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "tempat-sampah-b3": {
    label: "Tempat Sampah B3",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "tempat-sampah-sharps": {
    label: "Tempat Sampah Sharps",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "tempat-sampah-sisa-makanan": {
    label: "Tempat Sampah Sisa Makanan",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "spill-kit-ruangan": {
    label: "Spill Kit Lokal",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "cleaning-trolley-ruangan": {
    label: "Cleaning Trolley Lokal",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },
  "cleaning-trolley-cart": {
    label: "Cleaning Trolley Cart",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "mop-set-ruangan": {
    label: "Mop Set Lokal",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "bucket-cleaning": {
    label: "Bucket Cleaning",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "disinfectant-sprayer": {
    label: "Disinfectant Sprayer",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },
  "hydrogen-peroxide-vapor-hpv-disinfection-system": {
    label: "Hydrogen Peroxide Vapor (HPV) Disinfection System",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },
  "uv-disinfection-robot": {
    label: "UV Disinfection Robot (bukan hanya lamp)",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "vacuum-cleaner-ruangan": {
    label: "Vacuum Cleaner Lokal",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },
  "vacuum-cleaner-dry": {
    label: "Vacuum Cleaner (Dry)",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  "troli-sampah-ruangan": {
    label: "Troli Sampah Lokal",
    category: "Sanitasi dan Kebersihan",
    color: "bg-emerald-100 text-emerald-800",
  },

  // =========================
  // HVAC dan Tata Udara
  // =========================
  "air-conditioner-split": {
    label: "Air Conditioner Split",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "air-conditioner-central": {
    label: "Air Conditioner Central",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "exhaust-fan-ruangan": {
    label: "Exhaust Fan Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "fresh-air-ventilation": {
    label: "Fresh Air Ventilation",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "hepa-filter-ruangan": {
    label: "HEPA Filter Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "dehumidifier-ruangan": {
    label: "Dehumidifier Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "humidifier-ruangan": {
    label: "Humidifier Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "air-curtain-ruangan": {
    label: "Air Curtain Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "thermometer-ruangan": {
    label: "Thermometer Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "laminar-flow-ceiling-ok": {
    label: "Laminar Flow Ceiling (OK)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },
  "pressure-gradient-monitoring-system": {
    label: "Pressure Gradient Monitoring System (lebih advance)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "hygrometer-ruangan": {
    label: "Hygrometer Lokal",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "wall-mounted-fan": {
    label: "Wall Mounted Fan",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  "ceiling-fan-jika-ada": {
    label: "Ceiling Fan (jika ada)",
    category: "HVAC dan Tata Udara",
    color: "bg-cyan-100 text-cyan-800",
  },

  // =========================
  // Kelistrikan dan Utilitas
  // =========================
  "panel-listrik-sub-ruangan": {
    label: "Panel Listrik Sub Lokal",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "mcb-ruangan": {
    label: "MCB Lokal",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "stop-kontak-medis": {
    label: "Stop Kontak Medis",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "stop-kontak-umum": {
    label: "Stop Kontak Umum",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "emergency-power-outlet": {
    label: "Emergency Power Outlet",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "isolated-power-system-ips-ruang-ok-icu": {
    label: "Isolated Power System (IPS) ruang OK/ICU",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "line-isolation-monitor-lim": {
    label: "Line Isolation Monitor (LIM)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "ups-ruangan": {
    label: "UPS Lokal",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "ups-kecil-pc-printer": {
    label: "UPS Kecil (PC/Printer)",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },
  "static-ups-khusus-medis-critical": {
    label: "Static UPS khusus medis critical",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "stabilizer-tegangan": {
    label: "Stabilizer Tegangan",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "grounding-system-ruangan": {
    label: "Grounding System Lokal",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "power-extension-industri": {
    label: "Power Extension Industri",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "timer-switch": {
    label: "Timer Switch",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "voltage-regulator": {
    label: "Voltage Regulator",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  "panel-kontrol-ruangan": {
    label: "Panel Kontrol Lokal",
    category: "Kelistrikan dan Utilitas",
    color: "bg-blue-100 text-blue-800",
  },

  // =========================
  // Utilitas dan Sistem Mekanik
  // =========================
  "medical-gas-manifold-system": {
    label: "Medical Gas Manifold System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "medical-gas-pipeline-system": {
    label: "Medical Gas Pipeline System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "medical-vacuum-plant": {
    label: "Medical Vacuum Plant",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "compressed-air-plant": {
    label: "Compressed Air Plant",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "central-boiler-steam-plant": {
    label: "Central Boiler Steam Plant",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "hot-water-generator-system": {
    label: "Hot Water Generator System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "hot-water-storage-tank": {
    label: "Hot Water Storage Tank",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "water-treatment-plant-wtp": {
    label: "Water Treatment Plant (WTP)",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "reverse-osmosis-ro-system": {
    label: "Reverse Osmosis (RO) System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "sewage-treatment-plant-stp-ipal": {
    label: "Sewage Treatment Plant (STP/IPAL)",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "grease-trap-system": {
    label: "Grease Trap System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "rain-water-harvesting-system": {
    label: "Rain Water Harvesting System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "central-pumping-system": {
    label: "Central Pumping System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "hydrophore-pump-system": {
    label: "Hydrophore Pump System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "fire-pump-system-main-jockey-diesel": {
    label: "Fire Pump System (Main/Jockey/Diesel)",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "chemical-dosing-pump": {
    label: "Chemical Dosing Pump",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  "pressurization-fan-system": {
    label: "Pressurization Fan System",
    category: "Utilitas dan Sistem Mekanik",
    color: "bg-sky-100 text-sky-800",
  },

  // =========================
  // Otomasi dan Monitoring Gedung
  // =========================
  "building-management-system-bms": {
    label: "Building Management System (BMS)",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "integrated-building-management-system-ibms": {
    label: "Integrated Building Management System (IBMS)",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "energy-management-system-ems": {
    label: "Energy Management System (EMS)",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "environmental-monitoring-system": {
    label: "Environmental Monitoring System",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "central-clock-system": {
    label: "Central Clock System",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "cctv-central-server": {
    label: "CCTV Central Server",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "central-fire-alarm-control-panel": {
    label: "Central Fire Alarm Control Panel",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "emergency-lighting-central-battery-system": {
    label: "Emergency Lighting Central Battery System",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "smoke-management-system": {
    label: "Smoke Management System",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "gas-leak-detection-system": {
    label: "Gas Leak Detection System",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "earthquake-sensor-system": {
    label: "Earthquake Sensor System",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "fire-command-center": {
    label: "Fire Command Center",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "emergency-operations-center-eoc": {
    label: "Emergency Operations Center (EOC)",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  "disaster-response-equipment-set": {
    label: "Disaster Response Equipment Set",
    category: "Otomasi dan Monitoring Gedung",
    color: "bg-teal-100 text-teal-800",
  },

  // =========================
  // Keamanan dan Akses
  // =========================
  "cctv-ruangan": {
    label: "CCTV Lokal",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "kamera-cctv-dome": {
    label: "Kamera CCTV Dome",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "kamera-cctv-indoor": {
    label: "Kamera CCTV Indoor",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "nvr-cctv-shared": {
    label: "NVR CCTV (Shared)",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "dvr-cctv-shared": {
    label: "DVR CCTV (Shared)",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "monitor-cctv-nurse-station": {
    label: "Monitor CCTV Nurse Station",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "access-door-control-ruangan-rfid": {
    label: "Access Door Control Lokal (RFID)",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "access-door-control-ruangan-biometric": {
    label: "Access Door Control Lokal (Biometric)",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "electric-door-lock": {
    label: "Electric Door Lock",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "magnetic-door-lock": {
    label: "Magnetic Door Lock",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "intercom-ruangan": {
    label: "Intercom Lokal",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "calling-bell-ruangan": {
    label: "Calling Bell Lokal",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "nurse-call-system": {
    label: "Nurse Call System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "public-address-pa-system": {
    label: "Public Address (PA) System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "real-time-location-system-rtls": {
    label: "Real Time Location System (RTLS)",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "digital-wayfinding-system": {
    label: "Digital Wayfinding System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "visitor-management-system": {
    label: "Visitor Management System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "central-access-control-server": {
    label: "Central Access Control Server",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "license-plate-recognition-system-lpr": {
    label: "License Plate Recognition System (LPR)",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "boom-gate-system": {
    label: "Boom Gate System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "parking-management-system": {
    label: "Parking Management System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  "panic-alarm-central-system": {
    label: "Panic Alarm Central System",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  // =========================
  // Pendukung Fasilitas dan Logistik
  // =========================
  "mobile-maintenance-cart": {
    label: "Mobile Maintenance Cart",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "portable-generator": {
    label: "Portable Generator",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "portable-lighting-tower": {
    label: "Portable Lighting Tower",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "waste-compactor": {
    label: "Waste Compactor",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "waste-weighing-scale": {
    label: "Waste Weighing Scale",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "linen-chute-system": {
    label: "Linen Chute System",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "automated-linen-management-system": {
    label: "Automated Linen Management System",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "ride-on-floor-scrubber": {
    label: "Ride-On Floor Scrubber",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "ride-on-sweeper": {
    label: "Ride-On Sweeper",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "automated-guided-vehicle-agv-logistik": {
    label: "Automated Guided Vehicle (AGV) Logistik",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "pneumatic-tube-system": {
    label: "Pneumatic Tube System",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "central-warehouse-management-system": {
    label: "Central Warehouse Management System",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "cold-chain-monitoring-system": {
    label: "Cold Chain Monitoring System",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },
  "bed-tracking-system": {
    label: "Bed Tracking System",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },
  "asset-tracking-berbasis-iot": {
    label: "Asset Tracking berbasis IoT (selain RTLS basic)",
    category: "Pendukung Fasilitas dan Logistik",
    color: "bg-purple-100 text-purple-800",
  },

  "sensor-pintu-ruangan": {
    label: "Sensor Pintu Lokal",
    category: "Keamanan dan Akses",
    color: "bg-red-100 text-red-800",
  },

  // =========================
  // Proteksi Kebakaran dan Evakuasi
  // =========================
  "fire-extinguisher-apar-ruangan": {
    label: "Fire Extinguisher (APAR) Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "fire-blanket-ruangan": {
    label: "Fire Blanket Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "smoke-detector-ruangan": {
    label: "Smoke Detector Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "heat-detector-ruangan": {
    label: "Heat Detector Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "manual-call-point-mcp-ruangan": {
    label: "Manual Call Point (MCP) Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "fire-alarm-bell-ruangan": {
    label: "Fire Alarm Bell Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "fire-alarm-strobe-light-ruangan": {
    label: "Fire Alarm Strobe Light Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "emergency-exit-sign-dalam-ruangan": {
    label: "Emergency Exit Sign",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "emergency-lamp-lampu-darurat-ruangan": {
    label: "Emergency Lamp / Lampu Darurat Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "rambu-evakuasi-dalam-ruangan": {
    label: "Rambu Evakuasi",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "peta-jalur-evakuasi-ruangan": {
    label: "Peta Jalur Evakuasi Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "pintu-darurat-ruangan": {
    label: "Pintu Darurat Lokal",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "fire-rated-door": {
    label: "Fire Rated Door",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  "fire-door-closer": {
    label: "Fire Door Closer",
    category: "Proteksi Kebakaran dan Evakuasi",
    color: "bg-orange-100 text-orange-800",
  },

  // =========================
  // Furnitur dan Perlengkapan Pasien
  // =========================
  "kursi-tunggu-penunggu-pasien": {
    label: "Kursi Tunggu Penunggu Pasien",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "kursi-penunggu-lipat": {
    label: "Kursi Penunggu Lipat",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "kursi-roda-ruangan": {
    label: "Kursi Roda Lokal",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "meja-pasien": {
    label: "Meja Pasien",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "meja-serbaguna": {
    label: "Meja Serbaguna",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },
  "meja-kerja-perawat": {
    label: "Meja Kerja Perawat",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },
  "overbed-table-meja-makan-pasien": {
    label: "Overbed Table (Meja Makan Pasien)",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "lemari-pasien": {
    label: "Lemari Pasien",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "lemari-linen-ruangan": {
    label: "Lemari Linen Lokal",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "lemari-penyimpanan": {
    label: "Lemari Penyimpanan",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "partisi-ruangan": {
    label: "Partisi Lokal",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  "tirai-curtain-privasi": {
    label: "Tirai / Curtain Privasi",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },
  "tirai-pembatas": {
    label: "Tirai Pembatas",
    category: "Furnitur dan Perlengkapan Pasien",
    color: "bg-lime-100 text-lime-800",
  },

  // =========================
  // IT dan Komunikasi
  // =========================
  "monitor-komputer": {
    label: "Monitor Komputer",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "monitor-ruangan": {
    label: "Monitor",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "keyboard": {
    label: "Keyboard",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "keyboard-mouse": {
    label: "Keyboard dan Mouse",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "mouse": {
    label: "Mouse",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "printer-inkjet": {
    label: "Printer Inkjet",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "printer-laser": {
    label: "Printer Laser",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "printer-inkjet-laser": {
    label: "Printer (Inkjet / Laser)",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "scanner-dokumen": {
    label: "Scanner Dokumen",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "barcode-scanner": {
    label: "Barcode Scanner",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "label-printer": {
    label: "Label Printer",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "telephone-ip-ruangan": {
    label: "Telephone IP Lokal",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "telepon-extensi-ip-phone": {
    label: "Telepon Extensi / IP Phone",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "handy-talky-ht": {
    label: "Handy Talky (HT)",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "charging-dock-ht": {
    label: "Charging Dock HT",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "access-point-wifi-ruangan": {
    label: "Access Point (WiFi Lokal)",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "router-ruangan": {
    label: "Router Lokal",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "network-switch": {
    label: "Network Switch",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "network-switch-mini": {
    label: "Network Switch Mini",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "ups-it-ruangan": {
    label: "UPS IT Lokal",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "komputer-nurse-station": {
    label: "Komputer Nurse Station",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
  "komputer-pc-ruangan": {
    label: "Komputer/PC Lokal",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },

  "cpu-komputer": {
    label: "CPU Komputer",
    category: "IT dan Komunikasi",
    color: "bg-indigo-100 text-indigo-800",
  },
} as const satisfies Record<string, NonMedicalAssetTypeDefinition>

export type NonMedicalAssetType = keyof typeof NON_MEDICAL_ASSET_TYPE_DEFINITIONS

export type NonMedicalAssetTypeOption = {
  value: NonMedicalAssetType
  label: string
  category: string
}

export const NON_MEDICAL_ASSET_TYPE_OPTIONS: NonMedicalAssetTypeOption[] = (
  Object.keys(NON_MEDICAL_ASSET_TYPE_DEFINITIONS) as NonMedicalAssetType[]
).map((type) => ({
  value: type,
  label: NON_MEDICAL_ASSET_TYPE_DEFINITIONS[type].label,
  category: NON_MEDICAL_ASSET_TYPE_DEFINITIONS[type].category,
}))

const NON_MEDICAL_ASSET_CATEGORY_COLORS: Record<string, string> = NON_MEDICAL_ASSET_TYPE_OPTIONS.reduce(
  (acc, option) => {
    const color = NON_MEDICAL_ASSET_TYPE_DEFINITIONS[option.value].color
    if (!acc[option.category]) {
      acc[option.category] = color
    }
    return acc
  },
  {} as Record<string, string>,
)

export const getNonMedicalAssetTypeLabel = (type?: string) => {
  if (!type) return ""
  const entry = NON_MEDICAL_ASSET_TYPE_DEFINITIONS[type as NonMedicalAssetType]
  return entry?.label ?? type
}

export const getNonMedicalAssetTypeColor = (type?: string) => {
  if (!type) return "bg-gray-100 text-gray-800"
  const entry = NON_MEDICAL_ASSET_TYPE_DEFINITIONS[type as NonMedicalAssetType]
  return entry?.color ?? NON_MEDICAL_ASSET_CATEGORY_COLORS[type] ?? "bg-gray-100 text-gray-800"
}
