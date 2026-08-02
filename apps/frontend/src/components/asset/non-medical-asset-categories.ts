import { NON_MEDICAL_ASSET_TYPE_OPTIONS } from "@/constants/non-medical-asset-types"
import { USAGE_OPTIONS } from "@/utils/asset-usage"

export interface NonMedicalAssetClassification {
  inventoryName: string
  aliases: string[]
  usagePurpose: (typeof USAGE_OPTIONS)[number]
  recommendedType: string
  recommendedTypeCategory: string
}

export interface NonMedicalAssetCategory {
  description: string
  assetTypes: string[]
  classifications?: NonMedicalAssetClassification[]
}

const RAW_NON_MEDICAL_ASSET_TYPES = [
      "Access Door Control (RFID/Biometric)",
      "Access Door Control Lokal (Biometric)",
      "Access Door Control Lokal (RFID)",
      "Access Point (WiFi)",
      "Access Point WiFi Lokal",
      "Air Conditioner Central",
      "Air Conditioner Split",
      "Air Curtain Lokal",
      "Air Handling Unit (AHU)",
      "Air Purifier HEPA (area tertentu)",
      "All-in-One PC",
      "Ambulans",
      "Ambulans Jenazah (jika ada)",
      "APAR (Alat Pemadam Api Ringan)",
      "Asset Tracking berbasis IoT (selain RTLS basic)",
      "Automated Guided Vehicle (AGV) Logistik",
      "Automated Linen Management System",
      "Barcode Scanner",
      "Barcode Scanner (administrasi/logistik)",
      "Barcode/Label Printer",
      "Bed Tracking System",
      "Blender Industri",
      "Blower",
      "Boom Gate System",
      "Boiler (jika ada)",
      "Bor Listrik",
      "Box File",
      "Box Penyimpanan Medis",
      "Bucket Cleaning",
      "Building Management System (BMS)",
      "Busbar Trunking",
      "Calling Bell Lokal",
      "Cash Drawer",
      "Cash Register",
      "Ceiling Fan (jika ada)",
      "Central Access Control Server",
      "Central Boiler Steam Plant",
      "Central Clock System",
      "Central Fire Alarm Control Panel",
      "Central Pumping System",
      "Central Warehouse Management System",
      "Charging Dock HT",
      "Chemical Dosing Pump",
      "Chiller",
      "Chiller (kulkas besar)",
      "Cleaning Trolley Cart",
      "Cleaning Trolley Lokal",
      "Cold Chain Monitoring System",
      "Cold Room (Walk-in Cooler)",
      "Compressed Air Plant",
      "Container Box Plastik",
      "Container Food Grade",
      "Container Sampah Besar (Wheel Bin)",
      "Cooling Tower",
      "CPU Komputer",
      "CCTV (Closed-Circuit Television)",
      "CCTV Central Server",
      "CCTV Lokal",
      "Customer Display",
      "Deep Fryer",
      "Dehumidifier (pengatur kelembapan)",
      "Dehumidifier Lokal",
      "Digital Clock LED",
      "Digital Control",
      "Digital Signage Display",
      "Digital Wayfinding System",
      "Disaster Response Equipment Set",
      "Dishwasher Industri",
      "Disinfectant Sprayer",
      "Dispenser Air Dingin",
      "Dispenser Air Minum",
      "Dispenser Air Panas",
      "Dispenser Air Panas dan Dingin",
      "Display Antrian",
      "Display Informasi Lokal",
      "Door Closer Fire",
      "Ducting dan Diffuser",
      "DVR CCTV (Shared)",
      "Earth Tester",
      "Earthquake Sensor System",
      "Electric Door Lock",
      "Emergency Exit Sign",
      "Emergency Flashlight",
      "Emergency Instruction Board",
      "Emergency Lamp / Exit Sign",
      "Emergency Lamp / Lampu Darurat Lokal",
      "Emergency Lighting Central Battery System",
      "Emergency Megaphone",
      "Emergency Operations Center (EOC)",
      "Emergency Power Outlet",
      "Emergency Stretcher",
      "Energy Management System (EMS)",
      "Environmental Monitoring System",
      "Exhaust Fan",
      "Exhaust Fan Lokal",
      "Exhaust Hood Dapur",
      "Fan Coil Unit (FCU)",
      "Fire Alarm Bell Lokal",
      "Fire Alarm Strobe Light Lokal",
      "Fire Blanket",
      "Fire Blanket Lokal",
      "Fire Command Center",
      "Fire Door Closer",
      "Fire Extinguisher (APAR) Lokal",
      "Fleet Management System (ambulans)",
      "Fire Pump System (Main/Jockey/Diesel)",
      "Fire Rated Door",
      "First Aid Kit (P3K)",
      "Fogging Machine (disinfeksi ruangan)",
      "Food Processor",
      "Food Trolley",
      "Food Trolley / Trolley Makanan",
      "Fresh Air Fan",
      "Fresh Air Ventilation",
      "Freezer",
      "Gas Leak Detection System",
      "Generator Set (Genset)",
      "Gerinda",
      "Grease Trap System",
      "Grill/Pemanggang",
      "Grounding Rod dan Earth Pit",
      "Grounding System Lokal",
      "Hand Pallet",
      "Hand Sanitizer Dispenser",
      "Hand Sanitizer Dispenser (Wall Mounted)",
      "Hand Trolley",
      "Handheld Metal Detector",
      "Handphone Operasional",
      "Handy Talky (HT)",
      "HEPA Filter Lokal",
      "HEPA Filter Unit (untuk ruang operasi/isolasi)",
      "Heat Detector Lokal",
      "Heat Pump Water Heater (jika ada)",
      "Hydrogen Peroxide Vapor (HPV) Disinfection System",
      "Hot Water Generator System",
      "Hot Water Storage Tank",
      "Humidifier (pengatur kelembapan)",
      "Humidifier Lokal",
      "Hydrant System (jika dicatat terpisah)",
      "Hydrophore Pump System",
      "Hygrometer Lokal",
      "Integrated Building Management System (IBMS)",
      "Intercom Lokal",
      "Isolated Power System (IPS) ruang OK/ICU",
      "Jam Dinding Lokal",
      "Jam Digital Lokal",
      "Jam Meja (Meja Perawat/Admin)",
      "Kabel Power dan Grounding System",
      "Kabel UTP/Fiber Optic",
      "Kamera CCTV Dome",
      "Kamera CCTV Indoor",
      "Keyboard",
      "Keyboard dan Mouse",
      "Kompor Industri",
      "Kompressor Angin",
      "Komputer Nurse Station",
      "Komputer/PC Lokal",
      "Kursi Ergonomis",
      "Kursi Kerja",
      "Kursi Penunggu",
      "Kursi Penunggu Lipat",
      "Kursi Rapat",
      "Kursi Roda Lokal",
      "Kursi Tunggu di Lobby/Poliklinik",
      "Kursi Tunggu Penunggu Pasien",
      "Laminar Flow Ceiling (OK)",
      "Label Barcode Asset",
      "Label Maker",
      "Label Printer",
      "Label Rak Inventaris",
      "Laptop",
      "Notebook",
      "Lemari Arsip",
      "Lemari Buku/Dokumen",
      "Lemari Linen Lokal",
      "Lemari Pasien",
      "Lemari Pasien (Bedside Cabinet)",
      "Lemari Peralatan",
      "Lemari Penyimpanan",
      "License Plate Recognition System (LPR)",
      "Line Isolation Monitor (LIM)",
      "Lightning Arrester (Penangkal Petir)",
      "Linen Chute System",
      "Lockout Tagout Kit (LOTO)",
      "Magnetic Door Lock",
      "Manual Call Point (MCP) Lokal",
      "Meja dan Kursi Kerja",
      "Meja Informasi/Resepsionis",
      "Meja Kerja Perawat",
      "Meja Makan Pasien (Overbed Table)",
      "Meja Packing",
      "Meja Pasien",
      "Meja Rapat",
      "Meja Serbaguna",
      "Medical Gas Manifold System",
      "Medical Gas Pipeline System",
      "Medical Vacuum Plant",
      "Meteran Listrik (kWh Meter)",
      "Microwave Lokal",
      "Mini PC / Thin Client",
      "Mixer Adonan",
      "Mobile File (Lemari Geser)",
      "Mobile Maintenance Cart",
      "Modem/ONT Internet",
      "Monitor",
      "Monitor CCTV",
      "Monitor CCTV Nurse Station",
      "Monitor Komputer",
      "Mop dan Bucket (Wringer)",
      "Mop Set Lokal",
      "Motor Operasional",
      "Multimeter",
      "Network Rack",
      "Network Switch",
      "Network Switch Mini",
      "Nurse Call System",
      "NVR CCTV (Shared)",
      "NVR/DVR CCTV",
      "Oven Industri",
      "Overbed Table (Meja Makan Pasien)",
      "Pallet",
      "Panel ATS/AMF",
      "Panel Distribusi (MDP/SDP)",
      "Panel Kontrol Lokal",
      "Panel Listrik Sub Lokal",
      "Panic Alarm Central System",
      "Panic Button Lokal",
      "Parking Management System",
      "Partisi Lokal",
      "Patch Panel",
      "Pemanas Makanan",
      "Petunjuk Evakuasi",
      "Pickup/Box Logistic",
      "Platform Trolley",
      "Pneumatic Tube System",
      "Pompa Air Portable",
      "Portable Generator",
      "Portable Lighting Tower",
      "Power Extension Industri",
      "Power Factor Correction (Capacitor Bank)",
      "Pressure Gradient Monitoring System (lebih advance)",
      "Power Quality Analyzer (alat ukur kelistrikan)",
      "Pressurization Fan System",
      "Pressure Washer",
      "Printer (Inkjet / Laser)",
      "Printer Dot Matrix (jika ada)",
      "Printer Inkjet",
      "Printer Laser",
      "Public Address (PA) System",
      "Rain Water Harvesting System",
      "Rak Besi",
      "Rak Brosur",
      "Rak Dokumen Medis",
      "Rak Gudang (Heavy Duty Rack)",
      "Rak Linen",
      "Rak Logistik Lokal",
      "Rak Penyimpanan",
      "Rak Penyimpanan Alat",
      "Rak Penyimpanan Bahan Makanan",
      "Rak Stainless Steel",
      "Rambu Evakuasi",
      "Real Time Location System (RTLS)",
      "Reverse Osmosis (RO) System",
      "Rice Cooker Industri",
      "Rice Cooker Lokal",
      "Ride-On Floor Scrubber",
      "Ride-On Sweeper",
      "Rompi Safety",
      "Router",
      "Router Lokal",
      "Safety Cone dan Barrier",
      "Safety Harness",
      "Scanner Dokumen",
      "Scaffolding",
      "Sensor Pintu Lokal",
      "Sepatu Safety",
      "Server",
      "Sewage Treatment Plant (STP/IPAL)",
      "SFP Module",
      "Sink Stainless 1/2/3 Bowl",
      "Smoke Detector Lokal",
      "Smoke Management System",
      "Soap Dispenser",
      "Sofa/Kursi Tunggu",
      "Speaker Panggilan",
      "Speakerphone Conference",
      "Spill Kit (tumpahan cairan)",
      "Spill Kit Lokal",
      "Stabilizer Tegangan",
      "Stabilizer/AVR",
      "Standing Banner Holder",
      "Static UPS khusus medis critical",
      "Steam Cleaner",
      "Steam Press",
      "Steamer",
      "Stop Kontak Medis",
      "Stop Kontak Umum",
      "Surge Protection Device (SPD)",
      "Switch (Managed/Unmanaged)",
      "Table",
      "Tang Ampere (Clamp Meter)",
      "Tangga Lipat",
      "Telepon Extensi / IP Phone",
      "Telephone IP Lokal",
      "Thermal Camera (jika ada)",
      "Thermometer Lokal",
      "Thermostat dan Building HVAC Controller",
      "Timer Switch",
      "Timbangan Digital Lokal",
      "Tirai / Curtain Privasi",
      "Tirai Pembatas",
      "Tirai Pembatas (Curtain)",
      "Tool Set (kunci pas/ring/soket)",
      "Trafo Distribusi",
      "Tray dan Tray Rack",
      "Troli Linen",
      "Troli Logistik Kecil",
      "Troli Logistik Lokal",
      "Troli Sampah Lokal",
      "Troli Serbaguna Lokal",
      "UPS (Uninterruptible Power Supply)",
      "UPS IT Lokal",
      "UPS Kecil (PC/Printer)",
      "UPS Lokal",
      "UV Disinfection Robot (bukan hanya lamp)",
      "UV-C Disinfection Lamp (ruang tertentu)",
      "Vacuum Cleaner (Dry)",
      "Vacuum Cleaner Industri (Wet dan Dry)",
      "Vacuum Cleaner Lokal",
      "Variable Frequency Drive (VFD) HVAC",
      "Visitor Management System",
      "Voltage Regulator",
      "Wall Mounted Fan",
      "Walkie-talkie (HT)",
      "Waste Compactor",
      "Waste Weighing Scale",
      "Water Treatment Plant (WTP)",
      "Wastafel Stainless Steel Lokal",
      "Whiteboard",
      "Whiteboard/Glassboard",
      "X-Ray Baggage Scanner (jika ada)",
]

const DEFAULT_USAGE_PURPOSE: (typeof USAGE_OPTIONS)[number] = "Operasional"
const DEFAULT_TYPE_LABEL = "Lainnya / Belum diklasifikasikan"
const DEFAULT_TYPE_CATEGORY = "Umum"

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const compactText = (value: string) => normalizeText(value).replace(/\s+/g, "")

const NOISE_PATTERNS = [
  /\bruangan\b/g,
  /\bshared\b/g,
  /\bjika ada\b/g,
  /\bdalam ruangan\b/g,
  /\barea tertentu\b/g,
  /\buntuk ruang operasi isolasi\b/g,
]

const buildGroupingKey = (name: string) => {
  let normalized = normalizeText(name)
  if (!normalized) return ""

  NOISE_PATTERNS.forEach((pattern) => {
    normalized = normalized.replace(pattern, "")
  })

  return normalized.replace(/\s+/g, "")
}

const getDisplayNameScore = (name: string) => {
  const normalized = normalizeText(name)
  let score = 0

  if (!normalized.includes("ruangan")) score += 3
  if (!normalized.includes("shared")) score += 2
  if (!normalized.includes("jika ada")) score += 2
  if (!normalized.includes(" dalam ruangan")) score += 1
  if (!name.includes("(")) score += 1

  return score
}

const pickPreferredName = (names: string[]) =>
  [...names].sort((a, b) => {
    const scoreDiff = getDisplayNameScore(b) - getDisplayNameScore(a)
    if (scoreDiff !== 0) return scoreDiff
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  })[0]

const NON_MEDICAL_USAGE_RULES: Array<{
  usagePurpose: (typeof USAGE_OPTIONS)[number]
  keywords: string[]
}> = [
  {
    usagePurpose: "Admin",
    keywords: [
      "access point",
      "barcode",
      "cctv",
      "cpu",
      "display",
      "intercom",
      "ip phone",
      "keyboard",
      "label printer",
      "laptop",
      "modem",
      "monitor",
      "network",
      "nvr",
      "pc",
      "printer",
      "router",
      "scanner",
      "server",
      "switch",
      "telephone",
      "walkie",
      "wifi",
    ],
  },
  {
    usagePurpose: "Keamanan",
    keywords: [
      "alarm",
      "apar",
      "command center",
      "detector",
      "door lock",
      "emergency",
      "evakuasi",
      "exit sign",
      "fire",
      "first aid",
      "hydrant",
      "megaphone",
      "panic",
      "safety",
      "smoke",
      "stretcher",
      "thermal camera",
      "x-ray baggage",
    ],
  },
  {
    usagePurpose: "Utilitas",
    keywords: [
      "ac",
      "ahu",
      "ats",
      "boiler",
      "busbar",
      "chiller",
      "cooling tower",
      "ducting",
      "earth",
      "electric",
      "exhaust fan",
      "fan coil",
      "grounding",
      "heat pump",
      "hvac",
      "kabel",
      "listrik",
      "lighting",
      "meter",
      "panel",
      "pump",
      "trafo",
      "ups",
      "vfd",
      "voltage regulator",
      "water treatment",
    ],
  },
  {
    usagePurpose: "Kebersihan",
    keywords: [
      "bucket",
      "clean",
      "disinfect",
      "fogging",
      "hand sanitizer",
      "linen",
      "mop",
      "soap dispenser",
      "spill kit",
      "sweeper",
      "vacuum",
      "waste",
    ],
  },
  {
    usagePurpose: "Dapur",
    keywords: [
      "blender",
      "dishwasher",
      "food",
      "freezer",
      "grill",
      "kompor",
      "laundry",
      "microwave",
      "oven",
      "pemanas makanan",
      "rice cooker",
      "sink",
      "steam",
      "stainless",
      "tray",
    ],
  },
  {
    usagePurpose: "Transportasi",
    keywords: [
      "agv",
      "ambulans",
      "fleet",
      "hand pallet",
      "hand trolley",
      "motor",
      "pickup",
      "platform trolley",
      "troli",
    ],
  },
  {
    usagePurpose: "Logistik",
    keywords: [
      "box",
      "cabinet",
      "container",
      "lemari",
      "mobile file",
      "packing",
      "pallet",
      "rak",
      "storage",
      "warehouse",
    ],
  },
  {
    usagePurpose: "Fasilitas",
    keywords: [
      "air curtain",
      "bell",
      "clock",
      "curtain",
      "jam",
      "kursi",
      "meja",
      "partisi",
      "sofa",
      "table",
      "tirai",
      "whiteboard",
    ],
  },
]

const inferUsagePurpose = (inventoryName: string): (typeof USAGE_OPTIONS)[number] => {
  const normalized = normalizeText(inventoryName)

  const matchedRule = NON_MEDICAL_USAGE_RULES.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(normalizeText(keyword))),
  )

  return matchedRule?.usagePurpose ?? DEFAULT_USAGE_PURPOSE
}

const countTokenOverlap = (input: string, candidate: string) => {
  const inputTokens = input.split(" ").filter(Boolean)
  const candidateTokens = candidate.split(" ").filter(Boolean)
  if (!inputTokens.length || !candidateTokens.length) return 0

  return inputTokens.filter((token) => candidateTokens.includes(token)).length
}

const inferRecommendedType = (inventoryName: string) => {
  const normalizedInput = normalizeText(inventoryName)
  if (!normalizedInput) {
    return {
      label: DEFAULT_TYPE_LABEL,
      category: DEFAULT_TYPE_CATEGORY,
    }
  }

  let bestMatch:
    | {
        label: string
        category: string
        score: number
      }
    | undefined

  NON_MEDICAL_ASSET_TYPE_OPTIONS.forEach((option) => {
    const normalizedLabel = normalizeText(option.label)
    const compactLabel = compactText(option.label)
    const compactInput = compactText(inventoryName)

    let score = 0
    if (normalizedLabel === normalizedInput || compactLabel === compactInput) {
      score = 100
    } else if (normalizedLabel.includes(normalizedInput) || normalizedInput.includes(normalizedLabel)) {
      score = 80
    } else {
      const overlap = countTokenOverlap(normalizedInput, normalizedLabel)
      if (overlap > 0) {
        score = 50 + overlap
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        label: option.label,
        category: option.category,
        score,
      }
    }
  })

  if (!bestMatch || bestMatch.score < 60) {
    return {
      label: DEFAULT_TYPE_LABEL,
      category: DEFAULT_TYPE_CATEGORY,
    }
  }

  return {
    label: bestMatch.label,
    category: bestMatch.category,
  }
}

const buildClassifications = (assetNames: string[]): NonMedicalAssetClassification[] => {
  const groupedNames = new Map<string, Set<string>>()

  assetNames.forEach((name) => {
    const key = buildGroupingKey(name)
    if (!key) return

    if (!groupedNames.has(key)) {
      groupedNames.set(key, new Set())
    }
    groupedNames.get(key)?.add(name)
  })

  const classifications = Array.from(groupedNames.values())
    .map((aliasesSet) => {
      const aliases = Array.from(aliasesSet)
      const inventoryName = pickPreferredName(aliases)
      const typeInfo = inferRecommendedType(inventoryName)

      return {
        inventoryName,
        aliases: aliases
          .filter((alias) => alias !== inventoryName)
          .sort((a, b) => a.localeCompare(b)),
        usagePurpose: inferUsagePurpose(inventoryName),
        recommendedType: typeInfo.label,
        recommendedTypeCategory: typeInfo.category,
      }
    })
    .sort((a, b) => a.inventoryName.localeCompare(b.inventoryName))

  return classifications
}

export const NON_MEDICAL_ASSET_CLASSIFICATIONS = buildClassifications(RAW_NON_MEDICAL_ASSET_TYPES)

export const NON_MEDICAL_ASSET_CATEGORIES: Record<string, NonMedicalAssetCategory> = {
  "Non Medis": {
    description: "",
    assetTypes: NON_MEDICAL_ASSET_CLASSIFICATIONS.map((item) => item.inventoryName),
    classifications: NON_MEDICAL_ASSET_CLASSIFICATIONS,
  },
}
