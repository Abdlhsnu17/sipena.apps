import {
  MEDICAL_ASSET_TYPE_OPTIONS,
  getMedicalAssetTypeLabel,
} from "@/constants/medical-asset-types"
import {
  NON_MEDICAL_ASSET_TYPE_OPTIONS,
  getNonMedicalAssetTypeLabel,
} from "@/constants/non-medical-asset-types"
import type { MedicalAsset } from "@/types/medical-assets-types"
import type { NonMedicalAsset } from "@/types/non-medical-assets-types"

type UsageRule = {
  usagePurpose: string
  keywords: string[]
}

type AssetTypeOption = {
  value: string
  label: string
  category: string
}

const DEFAULT_USAGE_PURPOSE = "Operasional"

const normalizeText = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replaceAll("₂", "2")
    .replaceAll("₃", "3")
    .replaceAll("°", " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const buildLookupText = (...values: Array<string | undefined>) =>
  normalizeText(values.filter(Boolean).join(" "))

const compactNormalizedText = (value?: string | null) => normalizeText(value).replace(/\s+/g, "")

const buildOptionSearchTexts = (option: AssetTypeOption) => [option.label, option.category, option.value]

const isEquivalentText = (input?: string | null, candidate?: string | null) => {
  const normalizedInput = normalizeText(input)
  const normalizedCandidate = normalizeText(candidate)

  if (!normalizedInput || !normalizedCandidate) return false
  return normalizedInput === normalizedCandidate || compactNormalizedText(input) === compactNormalizedText(candidate)
}

const countTokenOverlap = (input: string, candidate: string) => {
  const inputTokens = input.split(" ").filter(Boolean)
  const candidateTokens = candidate.split(" ").filter(Boolean)
  if (inputTokens.length === 0 || candidateTokens.length === 0) return 0

  return inputTokens.filter((token) => candidateTokens.includes(token)).length
}

const getOptionMatchScore = (query: string, option: AssetTypeOption) => {
  const normalizedQuery = normalizeText(query)
  const compactQuery = compactNormalizedText(query)

  if (!normalizedQuery) return 0

  let highestScore = 0

  buildOptionSearchTexts(option).forEach((candidate) => {
    const normalizedCandidate = normalizeText(candidate)
    if (!normalizedCandidate) return

    if (normalizedCandidate === normalizedQuery || compactNormalizedText(candidate) === compactQuery) {
      highestScore = Math.max(highestScore, 100)
      return
    }

    if (
      normalizedQuery.length >= 5 &&
      (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate))
    ) {
      highestScore = Math.max(highestScore, 75)
      return
    }

    const overlapCount = countTokenOverlap(normalizedQuery, normalizedCandidate)
    const minimumRequiredOverlap = normalizedQuery.includes(" ") ? 2 : 1

    if (overlapCount >= minimumRequiredOverlap) {
      highestScore = Math.max(highestScore, 50 + overlapCount)
    }
  })

  return highestScore
}

const findBestMatchingOption = <T extends AssetTypeOption>(query: string | undefined, options: T[]) => {
  if (!query?.trim()) return undefined

  let bestMatch: T | undefined
  let bestScore = 0

  options.forEach((option) => {
    const score = getOptionMatchScore(query, option)
    if (score > bestScore) {
      bestMatch = option
      bestScore = score
    }
  })

  return bestScore >= 60 ? bestMatch : undefined
}

const findExactMatchingOption = <T extends AssetTypeOption>(query: string | undefined, options: T[]) => {
  if (!query?.trim()) return undefined

  return options.find((option) => buildOptionSearchTexts(option).some((candidate) => isEquivalentText(query, candidate)))
}

const matchesRule = (lookupText: string, keywords: string[]) =>
  keywords.some((keyword) => lookupText.includes(normalizeText(keyword)))

const inferUsageFromRules = (lookupText: string, rules: UsageRule[]) => {
  const matchedRule = rules.find((rule) => matchesRule(lookupText, rule.keywords))
  return matchedRule?.usagePurpose
}

export const matchMedicalTypeFromInventoryName = (inventoryName?: string) =>
  findExactMatchingOption(inventoryName, MEDICAL_ASSET_TYPE_OPTIONS)

export const matchNonMedicalTypeFromInventoryName = (inventoryName?: string) =>
  findExactMatchingOption(inventoryName, NON_MEDICAL_ASSET_TYPE_OPTIONS)

const MEDICAL_CATEGORY_USAGE_MAP: Record<string, string> = {
  "Alat Bedah dan Operasi": "Bedah",
  "Alat Diagnostik dan Pencitraan": "Diagnostik",
  "Alat Gawat Darurat": "Terapi",
  "Alat ICU/HCU": "ICU",
  "Alat Kebidanan dan Kandungan": "Ibu dan Bayi",
  "Alat Kesehatan Dasar dan P3K": "Pemeriksaan",
  "Alat Laboratorium Medis": "Lab",
  "Alat Pemeriksaan dan Tindakan": "Pemeriksaan",
  "Alat Terapi dan Perawatan": "Terapi",
  "Blood Bank dan Biologics": "Lab",
  "Dental dan ENT": "Tindakan",
  "Farmasi dan Penyimpanan Sensitif": "Lab",
  Hemodialisis: "Hemodialisis",
  "Hemodinamika dan ICU": "ICU",
  "Keamanan dan Monitoring Pasien": "Pemeriksaan",
  Kemoterapi: "Terapi",
  "Laboratorium Diagnostik": "Lab",
  "Neurologi dan Neuro Monitoring": "Diagnostik",
  "Oftalmologi dan Optometri": "Tindakan",
  "Penunjang dan Khusus RS Tipe A": "Diagnostik",
  "Perinatologi / NICU": "Ibu dan Bayi",
  "Perlengkapan Ruang Perawatan": "Rawat Inap",
  "Rehabilitasi dan Mobilitas": "Rehabilitasi",
  "Set Instrumen": "Bedah",
  "Set Operasi Bedah": "Bedah",
  "Set Operasi Kebidanan": "Ibu dan Bayi",
  "Sterilisasi dan CSSD": "Bedah",
  "Telehealth dan Identifikasi Pasien": "Pemeriksaan",
}

const MEDICAL_USAGE_RULES: UsageRule[] = [
  {
    usagePurpose: "Ibu dan Bayi",
    keywords: [
      "baby",
      "bilirubin",
      "ctg",
      "delivery",
      "doppler fetal",
      "fetal",
      "incubator",
      "infant",
      "maternal",
      "neonatal",
      "nicu",
      "perineum",
      "persalinan",
      "phototherapy",
      "vacuum extractor",
    ],
  },
  {
    usagePurpose: "Hemodialisis",
    keywords: [
      "blood warmer",
      "dialysate",
      "hemodial",
      "hd chair",
      "hd monitor",
      "patient scale",
      "pre post hd",
      "water treatment system ro",
    ],
  },
  {
    usagePurpose: "Lab",
    keywords: [
      "analyzer",
      "apheresis",
      "biosafety cabinet",
      "blood bank",
      "blood bag",
      "blood culture",
      "centrifuge",
      "chemistry",
      "coagulation",
      "cryostat",
      "cytometer",
      "drug",
      "elisa",
      "flow cytometer",
      "freezer",
      "genexpert",
      "hematology",
      "hba1c",
      "immunoassay",
      "incubator",
      "lab",
      "lactate",
      "microbiology",
      "microtome",
      "pathology",
      "pcr",
      "pharmacy",
      "plasma",
      "reader",
      "refrigerator",
      "sample",
      "scanner",
      "slide stainer",
      "tissue processor",
      "urine analyzer",
      "vaccine",
      "washer",
      "xpert",
    ],
  },
  {
    usagePurpose: "Bedah",
    keywords: [
      "aer",
      "anesthesia",
      "arthroscope",
      "autoclave",
      "bedah",
      "bowie dick",
      "c arm",
      "coblator",
      "cssd",
      "diathermy",
      "disinfector",
      "endoscope",
      "endoscopic",
      "insufflator",
      "instrument set",
      "laparos",
      "microsurgery",
      "operating",
      "orthopedic",
      "pass through",
      "phacoemulsification",
      "portable anesthesia",
      "shadowless",
      "sterile",
      "surgical",
      "tourniquet",
      "ultrasonic cleaner",
      "washer disinfector",
    ],
  },
  {
    usagePurpose: "ICU",
    keywords: [
      "brain oxygen",
      "capnography",
      "cardiac output",
      "central monitoring",
      "ecmo",
      "gas analyzer",
      "hemodynamic",
      "hfov",
      "iabp",
      "icp",
      "icu",
      "nirs",
      "nitric oxide",
      "picco",
      "vigileo",
    ],
  },
  {
    usagePurpose: "",
    keywords: [
      "ambu bag",
      "bag valve mask",
      "bipap",
      "blender",
      "bvm",
      "blood warmer",
      "concentrator",
      "cpap",
      "crash cart",
      "defibrillator",
      "feeding pump",
      "flowmeter",
      "fluid warmer",
      "hfnc",
      "humidifier",
      "infusion pump",
      "infusion",
      "medication cart",
      "nebulizer",
      "oxygen",
      "pacemaker",
      "pca pump",
      "resuscitation",
      "suction",
      "syringe pump",
      "transport incubator",
      "ventilator",
      "warmer",
    ],
  },
  {
    usagePurpose: "Rehabilitasi",
    keywords: [
      "balance trainer",
      "fall detection",
      "gait",
      "hoist",
      "parallel bar",
      "patient transfer",
      "pelvic binder",
      "standing frame",
      "trainer",
      "transfer board",
      "wheelchair",
    ],
  },
  {
    usagePurpose: "Tindakan",
    keywords: [
      "apex locator",
      "audiometer",
      "auto lensmeter",
      "auto refractometer",
      "cbct",
      "dental",
      "emg",
      "ent",
      "fundus",
      "hearing screening",
      "holter",
      "intraoral",
      "keratometer",
      "oct",
      "ophthalmoscope",
      "otoscope",
      "slit lamp",
      "tympanometer",
      "visual field",
      "yag laser",
    ],
  },
  {
    usagePurpose: "Diagnostik",
    keywords: [
      "blood gas",
      "bronchoscope",
      "co oximeter",
      "ct",
      "digital pathology",
      "ecg",
      "eeg",
      "ekg",
      "electrolyte",
      "emr terminal",
      "fluoroscopy",
      "glucometer",
      "mri",
      "nerve conduction",
      "ophthalm",
      "oscillos",
      "otoscope",
      "pacs",
      "pet ct",
      "portable x ray",
      "radiology",
      "reflex hammer",
      "ris",
      "tcd",
      "telemedicine",
      "thermometer",
      "transcutaneous bilirubin",
      "treadmill",
      "tuning fork",
      "ultrasound",
      "usg",
      "x ray",
      "x ray",
    ],
  },
  {
    usagePurpose: "",
    keywords: [
      "bed exit",
      "bed scale",
      "bedside",
      "bladder scanner",
      "digital consent",
      "fall monitoring",
      "lampu periksa",
      "medical examination",
      "monitor",
      "nurse call",
      "patient id",
      "patient monitor",
      "periksa",
      "pressure monitor",
      "pulse oximeter",
      "scale",
      "smart iv pole",
      "stethoscope",
      "tensi",
      "vital sign",
    ],
  },
]

const NON_MEDICAL_CATEGORY_USAGE_MAP: Record<string, string> = {
  "Otomasi dan Monitoring Gedung": "Utilitas",
  "Keselamatan Darurat": "Keamanan",
  "Pendukung Fasilitas dan Logistik": "Logistik",
  "Dapur dan Pantry": "Dapur",
  "Furnitur dan Perlengkapan Pasien": "Fasilitas",
  "Furniture Kantor": "Fasilitas",
  "HVAC dan Tata Udara": "Utilitas",
  "IT dan Komunikasi": "Admin",
  "Identifikasi Aset": "Logistik",
  "Keamanan dan Akses": "Keamanan",
  "Kelistrikan dan Utilitas": "Utilitas",
  "Kendaraan Operasional": "Transportasi",
  "Logistik": "Logistik",
  "Perlengkapan Umum": "Fasilitas",
  "Proteksi Kebakaran dan Evakuasi": "Keamanan",
  "Proteksi Kebakaran": "Keamanan",
  "Sanitasi dan Kebersihan": "Kebersihan",
  "Utilitas dan Sistem Mekanik": "Utilitas",
}

const NON_MEDICAL_USAGE_RULES: UsageRule[] = [
  {
    usagePurpose: "Keamanan",
    keywords: [
      "access control",
      "alarm",
      "apar",
      "barrier",
      "baggage scanner",
      "biometric",
      "boom gate",
      "cctv",
      "detector",
      "emergency",
      "evakuasi",
      "exit sign",
      "fire",
      "first aid",
      "flashlight",
      "gas leak",
      "heat detector",
      "hydrant",
      "instruction board",
      "lockout tagout",
      "manual call point",
      "megaphone",
      "mcp",
      "metal detector",
      "panic",
      "rfid",
      "rompi safety",
      "safety",
      "sensor pintu",
      "smoke",
      "visitor management",
    ],
  },
  {
    usagePurpose: "Kebersihan",
    keywords: [
      "bucket cleaning",
      "cleaning",
      "disinfect",
      "fogging",
      "hand sanitizer",
      "hpv",
      "linen",
      "limbah",
      "mop",
      "sampah",
      "sanitizer",
      "scrubber",
      "soap dispenser",
      "sprayer",
      "steam cleaner",
      "sweeper",
      "uv disinfection",
      "vacuum cleaner",
      "waste",
      "wheel bin",
    ],
  },
  {
    usagePurpose: "Dapur",
    keywords: [
      "blender",
      "cold room",
      "container food grade",
      "deep fryer",
      "dishwasher",
      "dispenser air",
      "exhaust hood dapur",
      "food processor",
      "food trolley",
      "freezer",
      "grill",
      "kitchen",
      "kompor",
      "microwave",
      "mixer adonan",
      "pantry",
      "rice cooker",
      "sink stainless",
      "steam press",
      "steamer",
      "tray",
    ],
  },
  {
    usagePurpose: "Logistik",
    keywords: [
      "asset tracking",
      "automated linen",
      "barcode",
      "bed tracking",
      "box",
      "cabinet",
      "container",
      "file",
      "hand pallet",
      "hand trolley",
      "inventaris",
      "label",
      "lemari",
      "linen chute",
      "locker",
      "mobile file",
      "packing",
      "rak",
      "storage",
      "trolley",
      "troli",
      "warehouse",
    ],
  },
  {
    usagePurpose: "Transportasi",
    keywords: [
      "agv",
      "ambulans",
      "ambulance",
      "fleet",
      "genset trailer",
      "kendaraan",
      "mobil operasional",
      "motor operasional",
      "pickup",
      "vehicle",
    ],
  },
  {
    usagePurpose: "Utilitas",
    keywords: [
      "ac ",
      "access point room cooling",
      "ahu",
      "air conditioner",
      "air curtain",
      "air handling",
      "boiler",
      "busbar",
      "capacitor bank",
      "central clock",
      "central pumping",
      "chiller",
      "clock system",
      "compress",
      "cooling tower",
      "digital control",
      "diffuser",
      "ducting",
      "earth",
      "electric",
      "ems",
      "energy management",
      "exhaust",
      "fan coil",
      "fan ",
      "fcu",
      "fresh air",
      "generator",
      "genset",
      "grounding",
      "heat pump",
      "hepa filter",
      "hot water",
      "hvac",
      "hydrophore",
      "ips ruang ok icu",
      "isolated power",
      "kabel power",
      "kwh meter",
      "lightning arrester",
      "mcb",
      "mccb",
      "mechanical",
      "meteran listrik",
      "panel",
      "penangkal petir",
      "power",
      "pump",
      "regulator",
      "spd",
      "steam plant",
      "surge protection",
      "thermostat",
      "trafo",
      "ups",
      "utility",
      "vfd",
      "voltage",
      "water heater",
      "water treatment",
      "wtp",
    ],
  },
  {
    usagePurpose: "Admin",
    keywords: [
      "all in one pc",
      "cash drawer",
      "cash register",
      "clock led",
      "computer",
      "cpu",
      "customer display",
      "display",
      "dokumen",
      "ht",
      "intercom",
      "internet",
      "ip phone",
      "jam digital",
      "keyboard",
      "komputer",
      "laptop",
      "mini pc",
      "modem",
      "monitor",
      "mouse",
      "network",
      "notebook",
      "ont",
      "pc",
      "phone",
      "printer",
      "router",
      "scanner",
      "server",
      "signage",
      "speakerphone",
      "switch",
      "tablet",
      "telepon",
      "thin client",
      "walkie",
      "wayfinding",
      "wifi",
    ],
  },
  {
    usagePurpose: "Fasilitas",
    keywords: [
      "chair",
      "clock",
      "curtain",
      "fan wall mounted",
      "jam dinding",
      "jam meja",
      "kursi",
      "meja",
      "overbed table",
      "resepsionis",
      "sofa",
      "table",
      "tirai",
      "whiteboard",
    ],
  },
]

export const inferMedicalUsagePurpose = (
  inventoryName?: string,
  type?: MedicalAsset["type"] | string,
) => {
  const typeOption = MEDICAL_ASSET_TYPE_OPTIONS.find((option) => option.value === type)
  const matchedInventoryTypeOption =
    matchMedicalTypeFromInventoryName(inventoryName) ?? findBestMatchingOption(inventoryName, MEDICAL_ASSET_TYPE_OPTIONS)
  const inventoryLookupText = buildLookupText(inventoryName)
  const lookupText = buildLookupText(
    inventoryName,
    getMedicalAssetTypeLabel(type),
    typeOption?.category,
    matchedInventoryTypeOption?.label,
    matchedInventoryTypeOption?.category,
  )

  return (
    inferUsageFromRules(inventoryLookupText, MEDICAL_USAGE_RULES) ??
    (matchedInventoryTypeOption ? MEDICAL_CATEGORY_USAGE_MAP[matchedInventoryTypeOption.category] : undefined) ??
    inferUsageFromRules(lookupText, MEDICAL_USAGE_RULES) ??
    (typeOption ? MEDICAL_CATEGORY_USAGE_MAP[typeOption.category] : undefined) ??
    DEFAULT_USAGE_PURPOSE
  )
}

export const inferNonMedicalUsagePurpose = (
  inventoryName?: string,
  type?: NonMedicalAsset["type"] | string,
) => {
  const typeOption = NON_MEDICAL_ASSET_TYPE_OPTIONS.find((option) => option.value === type)
  const matchedInventoryTypeOption =
    matchNonMedicalTypeFromInventoryName(inventoryName) ?? findBestMatchingOption(inventoryName, NON_MEDICAL_ASSET_TYPE_OPTIONS)
  const inventoryLookupText = buildLookupText(inventoryName)
  const lookupText = buildLookupText(
    inventoryName,
    getNonMedicalAssetTypeLabel(type),
    typeOption?.category,
    matchedInventoryTypeOption?.label,
    matchedInventoryTypeOption?.category,
  )

  return (
    inferUsageFromRules(inventoryLookupText, NON_MEDICAL_USAGE_RULES) ??
    (matchedInventoryTypeOption ? NON_MEDICAL_CATEGORY_USAGE_MAP[matchedInventoryTypeOption.category] : undefined) ??
    inferUsageFromRules(lookupText, NON_MEDICAL_USAGE_RULES) ??
    (typeOption ? NON_MEDICAL_CATEGORY_USAGE_MAP[typeOption.category] : undefined) ??
    DEFAULT_USAGE_PURPOSE
  )
}
