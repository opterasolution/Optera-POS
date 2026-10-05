import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import {
  Product,
  Category,
  Supplier,
  Customer,
  Batch,
  Register,
  InventoryMovement,
  AuditLog,
  PurchaseOrder,
} from "@/models";

export type SeedStorePreset = "SUPERMARKET" | "PHARMACY" | "HARDWARE";

export interface SeedPresetInfo {
  id: SeedStorePreset;
  title: string;
  description: string;
  categoryCount: number;
  productCount: number;
  supplierCount: number;
  customerCount: number;
  tags: string[];
}

export const SEED_PRESETS: SeedPresetInfo[] = [
  {
    id: "SUPERMARKET",
    title: "Sri Lankan FMCG Supermarket (සිල්ලර සුපිරි වෙළඳසැල)",
    description: "Curated FMCG retail inventory with top Sri Lankan brands (Munchee, Maliban, Anchor, Elephant House, Sunlight), GS1 479 barcodes, produce, and early discount supplier terms.",
    categoryCount: 6,
    productCount: 16,
    supplierCount: 5,
    customerCount: 4,
    tags: ["FMCG", "Groceries", "Dairy", "Beverages", "Produce", "Wholesale Tiers"],
  },
  {
    id: "PHARMACY",
    title: "Healthcare & Community Pharmacy (ඖෂධහල)",
    description: "Community pharmacy catalog with scheduled pharmaceuticals, OTC remedies, baby care, surgical items, and batch tracking with FEFO expiry dates.",
    categoryCount: 5,
    productCount: 14,
    supplierCount: 4,
    customerCount: 3,
    tags: ["Pharmaceuticals", "FEFO Batches", "Expiry Tracking", "Baby Care", "Surgicals"],
  },
  {
    id: "HARDWARE",
    title: "Hardware, Electrical & Paint Store (යකඩ හා තීන්ත වෙළඳසැල)",
    description: "Building materials, power tools, sanitaryware, cables, and paints with wholesale tiering for local contractors and builders.",
    categoryCount: 5,
    productCount: 12,
    supplierCount: 4,
    customerCount: 4,
    tags: ["Building Materials", "Electrical", "Paints", "Contractor Credit", "Tools"],
  },
];

interface RawSeedData {
  categories: Array<{ name: string; nameSinhala: string; nameTamil: string; description: string }>;
  suppliers: Array<{
    name: string;
    contactPerson: string;
    phone: string;
    address: string;
    creditLimit: number;
    earlyPaymentDiscountPercentage: number;
    earlyPaymentDiscountDays: number;
  }>;
  products: Array<{
    name: string;
    nameSinhala: string;
    nameTamil: string;
    barcode: string;
    sku: string;
    categoryIdx: number;
    supplierIdx: number;
    costPrice: number;
    sellingPrice: number;
    wholesalePrice: number;
    stockQuantity: number;
    unit: string;
    isBatchTracked?: boolean;
    isWeighable?: boolean;
    pluCode?: string;
  }>;
  customers: Array<{
    name: string;
    phone: string;
    address: string;
    creditLimit: number;
    loyaltyPoints: number;
  }>;
}

const SUPERMARKET_DATA: RawSeedData = {
  categories: [
    { name: "Rice & Grains", nameSinhala: "සහල් සහ ධාන්‍ය", nameTamil: "அரிசி மற்றும் தானியங்கள்", description: "Basmati, Samba, Nadu, White Rice" },
    { name: "Dairy & Milk Powder", nameSinhala: "කිරි නිෂ්පාදන", nameTamil: "பால் பொருட்கள்", description: "Milk powders, butter, cheese, yoghurt" },
    { name: "Biscuits & Confectionery", nameSinhala: "බිස්කට් සහ පැණිරස කෑම", nameTamil: "பிஸ்கட்கள்", description: "Cream crackers, marie, chocolate biscuits" },
    { name: "Tea & Beverages", nameSinhala: "තේ සහ බීම", nameTamil: "தேநீர் மற்றும் பானங்கள்", description: "Ceylon black tea, soft drinks, fruit cordials" },
    { name: "Personal Care & Soap", nameSinhala: "සනීපාරක්ෂක හා සබන්", nameTamil: "தனிப்பட்ட பராமரிப்பு", description: "Laundry soap, toothpaste, shampoo" },
    { name: "Cooking & Spices", nameSinhala: "කුළුබඩු සහ තෙල්", nameTamil: "மசாலாப் பொருட்கள்", description: "Curry powder, chili, coconut oil, salt" },
  ],
  suppliers: [
    {
      name: "Unilever Sri Lanka Ltd",
      contactPerson: "Dinesh Ranatunga",
      phone: "0112189400",
      address: "258 M. Vincent Perera Mawatha, Colombo 14",
      creditLimit: 500000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 10,
    },
    {
      name: "Ceylon Biscuits Limited (Munchee)",
      contactPerson: "Prasanna Wickramasinghe",
      phone: "0115000000",
      address: "Pannipitiya, High Level Road, Colombo",
      creditLimit: 350000,
      earlyPaymentDiscountPercentage: 3,
      earlyPaymentDiscountDays: 7,
    },
    {
      name: "Maliban Biscuit Manufactories (Pvt) Ltd",
      contactPerson: "Ananda Jayasuriya",
      phone: "0115555555",
      address: "389 Galle Road, Ratmalana",
      creditLimit: 250000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 14,
    },
    {
      name: "Fonterra Brands Lanka (Anchor)",
      contactPerson: "Rohitha Fernando",
      phone: "0112488888",
      address: "Biyagama Export Processing Zone",
      creditLimit: 450000,
      earlyPaymentDiscountPercentage: 1.5,
      earlyPaymentDiscountDays: 10,
    },
    {
      name: "Ceylon Cold Stores PLC (Elephant House)",
      contactPerson: "Sunil Bandara",
      phone: "0112441441",
      address: "Ranala, Kaduwela",
      creditLimit: 300000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 7,
    },
  ],
  products: [
    {
      name: "Keeri Samba Rice 5kg (Araliya)",
      nameSinhala: "කීරි සම්බා 5kg",
      nameTamil: "கீரி சம்பா அரிசி 5kg",
      barcode: "4791001000018",
      sku: "RICE-KS-5KG",
      categoryIdx: 0,
      supplierIdx: 1,
      costPrice: 1420,
      sellingPrice: 1650,
      wholesalePrice: 1540,
      stockQuantity: 45,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Anchor Full Cream Milk Powder 400g",
      nameSinhala: "ඇන්කර් කිරිපිටි 400g",
      nameTamil: "ஆங்கர் பால் மாவு 400g",
      barcode: "4791001000025",
      sku: "MILK-ANC-400",
      categoryIdx: 1,
      supplierIdx: 3,
      costPrice: 1020,
      sellingPrice: 1180,
      wholesalePrice: 1110,
      stockQuantity: 60,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Munchee Super Cream Cracker 490g",
      nameSinhala: "ක්‍රීම් ක්‍රැකර් 490g",
      nameTamil: "சூப்பர் கிரீம் கிராக்கர் 490g",
      barcode: "4791001000032",
      sku: "BIS-SCC-490",
      categoryIdx: 2,
      supplierIdx: 1,
      costPrice: 410,
      sellingPrice: 480,
      wholesalePrice: 445,
      stockQuantity: 75,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Maliban Gold Marie 300g",
      nameSinhala: "ගෝල්ඩ් මාරි 300g",
      nameTamil: "மாலிபன் கோல்ட் மேரி 300g",
      barcode: "4791001000049",
      sku: "BIS-MAR-300",
      categoryIdx: 2,
      supplierIdx: 2,
      costPrice: 215,
      sellingPrice: 260,
      wholesalePrice: 235,
      stockQuantity: 80,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Watawala BOPF Ceylon Tea 400g",
      nameSinhala: "වටවල තේ 400g",
      nameTamil: "வட்டவளை தேநீர் 400g",
      barcode: "4791001000056",
      sku: "TEA-WAT-400",
      categoryIdx: 3,
      supplierIdx: 0,
      costPrice: 620,
      sellingPrice: 750,
      wholesalePrice: 690,
      stockQuantity: 50,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Elephant House Cream Soda 1.5L",
      nameSinhala: "ක්‍රීම් සෝඩා 1.5L",
      nameTamil: "கிரீம் சோடா 1.5L",
      barcode: "4791001000063",
      sku: "BEV-EHCS-15L",
      categoryIdx: 3,
      supplierIdx: 4,
      costPrice: 310,
      sellingPrice: 380,
      wholesalePrice: 350,
      stockQuantity: 40,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Sunlight Soap 110g x 4 Pack",
      nameSinhala: "සන්ලයිට් සබන් 4 පැක්",
      nameTamil: "சன்லைட் சோப்பு 4 பாக்கெட்",
      barcode: "4791001000070",
      sku: "SOAP-SUN-4P",
      categoryIdx: 4,
      supplierIdx: 0,
      costPrice: 370,
      sellingPrice: 440,
      wholesalePrice: 405,
      stockQuantity: 65,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Astra Fat Spread 250g",
      nameSinhala: "ඇස්ට්‍රා 250g",
      nameTamil: "அஸ்ட்ரா வெண்ணெய் 250g",
      barcode: "4791001000087",
      sku: "DY-AST-250",
      categoryIdx: 1,
      supplierIdx: 0,
      costPrice: 415,
      sellingPrice: 490,
      wholesalePrice: 450,
      stockQuantity: 35,
      unit: "pcs",
      isBatchTracked: true,
    },
    {
      name: "Clogard Fresh Mint Toothpaste 120g",
      nameSinhala: "ක්ලෝගාඩ් දන්තාලේප 120g",
      nameTamil: "க்ளோகார்ட் பற்பசை 120g",
      barcode: "4791001000094",
      sku: "ORL-CLO-120",
      categoryIdx: 4,
      supplierIdx: 0,
      costPrice: 230,
      sellingPrice: 280,
      wholesalePrice: 255,
      stockQuantity: 55,
      unit: "pcs",
    },
    {
      name: "MD Mixed Fruit Jam 500g",
      nameSinhala: "මික්ස්ඩ් ෆෲට් ජෑම් 500g",
      nameTamil: "பழ ஜாம் 500g",
      barcode: "4791001000100",
      sku: "JAM-MD-500",
      categoryIdx: 5,
      supplierIdx: 4,
      costPrice: 480,
      sellingPrice: 580,
      wholesalePrice: 530,
      stockQuantity: 30,
      unit: "pcs",
    },
    {
      name: "Fresh Red Onions (රතු ළූණු)",
      nameSinhala: "රතු ළූණු",
      nameTamil: "சின்ன வெங்காயம்",
      barcode: "2100101000000",
      sku: "VEG-R-ONION",
      categoryIdx: 5,
      supplierIdx: 1,
      costPrice: 380,
      sellingPrice: 490,
      wholesalePrice: 440,
      stockQuantity: 50,
      unit: "kg",
      isWeighable: true,
      pluCode: "101",
    },
    {
      name: "Local Potatoes (දේශීය අල)",
      nameSinhala: "දේශීය අල",
      nameTamil: "உள்ளூர் உருளைக்கிழங்கு",
      barcode: "2100102000000",
      sku: "VEG-L-POTATO",
      categoryIdx: 5,
      supplierIdx: 1,
      costPrice: 290,
      sellingPrice: 390,
      wholesalePrice: 340,
      stockQuantity: 80,
      unit: "kg",
      isWeighable: true,
      pluCode: "102",
    },
  ],
  customers: [
    {
      name: "Nimal Perera (Retail Loyalty)",
      phone: "0771234567",
      address: "14/2 Temple Road, Maharagama",
      creditLimit: 0,
      loyaltyPoints: 145,
    },
    {
      name: "Colombo City Caterers (B2B Wholesale)",
      phone: "0718899000",
      address: "88 Cotta Road, Borella",
      creditLimit: 150000,
      loyaltyPoints: 480,
    },
    {
      name: "Kamal Gunaratne (Corner Tea Shop)",
      phone: "0765544332",
      address: "Shop 4, Market Complex, Nugegoda",
      creditLimit: 50000,
      loyaltyPoints: 95,
    },
    {
      name: "Dilini Senanayake",
      phone: "0702233445",
      address: "45 Dharmapala Mawatha, Colombo 07",
      creditLimit: 10000,
      loyaltyPoints: 210,
    },
  ],
};

const PHARMACY_DATA: RawSeedData = {
  categories: [
    { name: "Pain Relief & Antipyretics", nameSinhala: "වේදනා නාශක ඖෂධ", nameTamil: "வலி நிவாரணிகள்", description: "Paracetamol, Ibuprofen, Panadol" },
    { name: "Antibiotics & Anti-Infectives", nameSinhala: "ප්‍රතිජීවක ඖෂධ", nameTamil: "நுண்ணுயிர் எதிர்ப்பிகள்", description: "Amoxicillin, Azithromycin, Cipro" },
    { name: "Cardiovascular & Diabetes", nameSinhala: "හෘද හා දියවැඩියා ඖෂධ", nameTamil: "நீரிழிவு மருந்துகள்", description: "Metformin, Atorvastatin, Losartan" },
    { name: "Vitamins & Supplements", nameSinhala: "විටමින් වර්ග", nameTamil: "வைட்டமின்கள்", description: "Vitamin C, Zinc, Multivitamins" },
    { name: "Baby Care & Pediatrics", nameSinhala: "ළදරු සත්කාර", nameTamil: "குழந்தை பராமரிப்பு", description: "Infant milk, baby cream, gripe water" },
  ],
  suppliers: [
    {
      name: "State Pharmaceuticals Corporation (SPC)",
      contactPerson: "Dr. K. Jayawardena",
      phone: "0112320356",
      address: "75 Sir Baron Jayatilaka Mawatha, Colombo 01",
      creditLimit: 600000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 14,
    },
    {
      name: "Hemas Pharmaceuticals (Pvt) Ltd",
      contactPerson: "Nalaka Mendis",
      phone: "0114731731",
      address: "Hemas House, Braybrooke Place, Colombo 02",
      creditLimit: 400000,
      earlyPaymentDiscountPercentage: 2.5,
      earlyPaymentDiscountDays: 10,
    },
    {
      name: "Baurs Healthcare (A. Baur & Co.)",
      contactPerson: "Gamini Rajapaksa",
      phone: "0114728700",
      address: "62 Jethawana Road, Colombo 14",
      creditLimit: 350000,
      earlyPaymentDiscountPercentage: 1.5,
      earlyPaymentDiscountDays: 7,
    },
    {
      name: "GlaxoSmithKline Lanka (GSK)",
      contactPerson: "Chaminda Alwis",
      phone: "0112695180",
      address: "121 Galle Road, Dehiwala",
      creditLimit: 300000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 10,
    },
  ],
  products: [
    {
      name: "Panadol Regular 500g (Pack of 12)",
      nameSinhala: "පැනඩෝල් 500mg (12 පෙති)",
      nameTamil: "பனடோல் 500mg",
      barcode: "4792001000015",
      sku: "MED-PAN-500",
      categoryIdx: 0,
      supplierIdx: 3,
      costPrice: 55,
      sellingPrice: 70,
      wholesalePrice: 62,
      stockQuantity: 200,
      unit: "strip",
      isBatchTracked: true,
    },
    {
      name: "Amoxicillin Capsules 500mg (10s)",
      nameSinhala: "ඇමොක්සිසිලින් 500mg",
      nameTamil: "அமாக்சிசிலின் 500mg",
      barcode: "4792001000022",
      sku: "MED-AMX-500",
      categoryIdx: 1,
      supplierIdx: 0,
      costPrice: 120,
      sellingPrice: 165,
      wholesalePrice: 145,
      stockQuantity: 120,
      unit: "strip",
      isBatchTracked: true,
    },
    {
      name: "Metformin Hydrochloride 500mg (10s)",
      nameSinhala: "මෙට්ෆෝමින් 500mg",
      nameTamil: "மெட்பார்மின் 500mg",
      barcode: "4792001000039",
      sku: "MED-MET-500",
      categoryIdx: 2,
      supplierIdx: 1,
      costPrice: 65,
      sellingPrice: 95,
      wholesalePrice: 80,
      stockQuantity: 150,
      unit: "strip",
      isBatchTracked: true,
    },
    {
      name: "Cebion Vitamin C 500mg Chewable (20s)",
      nameSinhala: "විටමින් සී 500mg",
      nameTamil: "வைட்டமின் சி 500mg",
      barcode: "4792001000046",
      sku: "VIT-CEB-500",
      categoryIdx: 3,
      supplierIdx: 2,
      costPrice: 280,
      sellingPrice: 380,
      wholesalePrice: 330,
      stockQuantity: 80,
      unit: "bottle",
      isBatchTracked: true,
    },
    {
      name: "Baby Cheramy Cream 100g",
      nameSinhala: "බේබි ෂෙරමි ක්‍රීම් 100g",
      nameTamil: "பேபி செரமி கிரீம்",
      barcode: "4792001000053",
      sku: "BBY-BC-100",
      categoryIdx: 4,
      supplierIdx: 1,
      costPrice: 290,
      sellingPrice: 360,
      wholesalePrice: 325,
      stockQuantity: 45,
      unit: "pcs",
    },
  ],
  customers: [
    {
      name: "Dr. Asela Wijesinghe Clinic",
      phone: "0778899112",
      address: "24 Kandy Road, Kiribathgoda",
      creditLimit: 200000,
      loyaltyPoints: 340,
    },
    {
      name: "Samanthi Wickramasinghe",
      phone: "0714455667",
      address: "12 Asoka Gardens, Colombo 04",
      creditLimit: 15000,
      loyaltyPoints: 85,
    },
    {
      name: "Gampaha Nursing Home",
      phone: "0332224455",
      address: "Main Street, Gampaha",
      creditLimit: 300000,
      loyaltyPoints: 620,
    },
  ],
};

const HARDWARE_DATA: RawSeedData = {
  categories: [
    { name: "Paints & Solvents", nameSinhala: "තීන්ත සහ ද්‍රාවක", nameTamil: "வண்ணப்பூச்சுகள்", description: "Emulsion, weather coat, thinner, enamel" },
    { name: "Plumbing & PVC Pipes", nameSinhala: "ජලනල සහ PVC", nameTamil: "குழாய் உபகரணங்கள்", description: "S-lon pipes, fittings, taps, valves" },
    { name: "Electrical & Lighting", nameSinhala: "විදුලි උපකරණ", nameTamil: "மின்சார பொருட்கள்", description: "LED bulbs, switches, cables, breakers" },
    { name: "Fasteners & Fixings", nameSinhala: "ඇණ සහ මුරිච්චි", nameTamil: "திருகுகள்", description: "Wood screws, concrete anchors, bolts" },
    { name: "Hand & Power Tools", nameSinhala: "අත් සහ විදුලි ආයුධ", nameTamil: "கைக்கருவிகள்", description: "Hammers, drills, angle grinders, tapes" },
  ],
  suppliers: [
    {
      name: "Causeway Paints Lanka (Pvt) Ltd",
      contactPerson: "Gamini Samarasinghe",
      phone: "0112447477",
      address: "Biyagama Road, Kelaniya",
      creditLimit: 400000,
      earlyPaymentDiscountPercentage: 3,
      earlyPaymentDiscountDays: 7,
    },
    {
      name: "S-lon Lanka (Pvt) Ltd",
      contactPerson: "Upul Senanayake",
      phone: "0117700600",
      address: "109 Hyde Park Corner, Colombo 02",
      creditLimit: 500000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 14,
    },
    {
      name: "Kelani Cables PLC",
      contactPerson: "Mahinda Jayawardena",
      phone: "0112522777",
      address: "P.O. Box 14, Wewelduwa, Kelaniya",
      creditLimit: 350000,
      earlyPaymentDiscountPercentage: 2,
      earlyPaymentDiscountDays: 10,
    },
    {
      name: "Tokyo Cement Group",
      contactPerson: "Lalith Karunaratne",
      phone: "0112558100",
      address: "469 Kandy Road, Peliyagoda",
      creditLimit: 600000,
      earlyPaymentDiscountPercentage: 1.5,
      earlyPaymentDiscountDays: 10,
    },
  ],
  products: [
    {
      name: "Causeway Weather Shield White 4L",
      nameSinhala: "කෝස්වේ තීන්ත 4L",
      nameTamil: "வெதர் ஷீல்ட் பெயிண்ட் 4L",
      barcode: "4793001000012",
      sku: "PNT-CWS-4L",
      categoryIdx: 0,
      supplierIdx: 0,
      costPrice: 5800,
      sellingPrice: 6950,
      wholesalePrice: 6350,
      stockQuantity: 25,
      unit: "can",
    },
    {
      name: "S-lon PVC Pipe 1/2 inch 4m Class 1000",
      nameSinhala: "එස්-ලෝන් බට 1/2 අඟල්",
      nameTamil: "எஸ்-லான் பிவிசி குழாய் 1/2",
      barcode: "4793001000029",
      sku: "PLB-SLN-05",
      categoryIdx: 1,
      supplierIdx: 1,
      costPrice: 620,
      sellingPrice: 780,
      wholesalePrice: 700,
      stockQuantity: 150,
      unit: "pcs",
    },
    {
      name: "Kelani 1/1.13 Single Core Copper Wire (100m)",
      nameSinhala: "කැලණි වයර් 1/1.13",
      nameTamil: "கெலானி கம்பி 100m",
      barcode: "4793001000036",
      sku: "ELE-KC-113",
      categoryIdx: 2,
      supplierIdx: 2,
      costPrice: 9400,
      sellingPrice: 11200,
      wholesalePrice: 10300,
      stockQuantity: 20,
      unit: "roll",
    },
    {
      name: "Tokyo Super Blended Cement 50kg Bag",
      nameSinhala: "ටෝකියෝ සිමෙන්ති 50kg",
      nameTamil: "டோக்கியோ சிமெண்ட் 50kg",
      barcode: "4793001000043",
      sku: "BLD-TKC-50",
      categoryIdx: 4,
      supplierIdx: 3,
      costPrice: 1950,
      sellingPrice: 2250,
      wholesalePrice: 2120,
      stockQuantity: 80,
      unit: "bag",
    },
  ],
  customers: [
    {
      name: "Perera & Sons Builders (Pvt) Ltd",
      phone: "0773344556",
      address: "Site 12, Galle Road, Moratuwa",
      creditLimit: 500000,
      loyaltyPoints: 720,
    },
    {
      name: "Nuwan Electrical Contractors",
      phone: "0712233889",
      address: "Cross Street, Panadura",
      creditLimit: 150000,
      loyaltyPoints: 210,
    },
  ],
};

export interface SeedResult {
  success: boolean;
  preset: SeedStorePreset;
  businessId: string;
  clearedOldData: boolean;
  categoriesCreated: number;
  suppliersCreated: number;
  productsCreated: number;
  batchesCreated: number;
  customersCreated: number;
  registersCreated: number;
  message: string;
}

/**
 * Seeds comprehensive Sri Lankan demo/bootstrap store data into the database.
 */
export async function seedStoreData(options: {
  businessId: string;
  preset: SeedStorePreset;
  clearExisting?: boolean;
  userId?: string;
  username?: string;
}): Promise<SeedResult> {
  const { businessId, preset, clearExisting = false, userId, username = "Store Admin" } = options;

  let rawData: RawSeedData = SUPERMARKET_DATA;
  if (preset === "PHARMACY") rawData = PHARMACY_DATA;
  if (preset === "HARDWARE") rawData = HARDWARE_DATA;

  if (!Boolean(process.env.MONGODB_URI)) {
    // Simulated seed for offline/demo environments
    return {
      success: true,
      preset,
      businessId,
      clearedOldData: clearExisting,
      categoriesCreated: rawData.categories.length,
      suppliersCreated: rawData.suppliers.length,
      productsCreated: rawData.products.length,
      batchesCreated: 8,
      customersCreated: rawData.customers.length,
      registersCreated: 2,
      message: `Demo mode: Seeded ${rawData.products.length} products, ${rawData.suppliers.length} suppliers, and ${rawData.categories.length} categories for ${preset}.`,
    };
  }

  await connectToDatabase();
  const bId = new mongoose.Types.ObjectId(businessId);

  // Clear existing catalog if requested
  if (clearExisting) {
    await Promise.all([
      Product.deleteMany({ businessId: bId }),
      Category.deleteMany({ businessId: bId }),
      Supplier.deleteMany({ businessId: bId }),
      Customer.deleteMany({ businessId: bId }),
      Batch.deleteMany({ businessId: bId }),
    ]);
  }

  // 1. Create Categories
  const categoryDocs = await Category.insertMany(
    rawData.categories.map((c) => ({
      businessId: bId,
      name: c.name,
      description: c.description,
      isActive: true,
    }))
  );

  // 2. Create Suppliers
  const supplierDocs = await Supplier.insertMany(
    rawData.suppliers.map((s) => ({
      businessId: bId,
      name: s.name,
      contactPerson: s.contactPerson,
      phone: s.phone,
      address: s.address,
      creditLimit: s.creditLimit,
      currentBalance: 0,
      earlyPaymentDiscountPercentage: s.earlyPaymentDiscountPercentage,
      earlyPaymentDiscountDays: s.earlyPaymentDiscountDays,
      isActive: true,
    }))
  );

  // 3. Create Products & Batches
  let productsCreated = 0;
  let batchesCreated = 0;

  for (const p of rawData.products) {
    const cat = categoryDocs[p.categoryIdx] || categoryDocs[0];
    const sup = supplierDocs[p.supplierIdx] || supplierDocs[0];

    const prod = await Product.create({
      businessId: bId,
      categoryId: cat?._id,
      name: p.name,
      nameSinhala: p.nameSinhala,
      nameTamil: p.nameTamil,
      barcode: p.barcode,
      sku: p.sku,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      wholesalePrice: p.wholesalePrice,
      stockQuantity: p.stockQuantity,
      unit: p.unit,
      isBatchTracked: Boolean(p.isBatchTracked),
      isWeighable: Boolean(p.isWeighable),
      pluCode: p.pluCode,
      supplierId: sup?._id,
      supplierName: sup?.name,
      isActive: true,
    });
    productsCreated++;

    // Create a batch if batch-tracked
    if (p.isBatchTracked) {
      const now = new Date();
      const expiry = new Date(now.getFullYear() + 1, now.getMonth() + 3, now.getDate());
      await Batch.create({
        businessId: bId,
        productId: prod._id,
        batchNumber: `BAT-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        manufacturingDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        expiryDate: expiry,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        initialQuantity: p.stockQuantity,
        currentQuantity: p.stockQuantity,
        status: "ACTIVE",
      });
      batchesCreated++;
    }

    // Initial stock inventory movement
    await InventoryMovement.create({
      businessId: bId,
      productId: prod._id,
      type: "STOCK_IN",
      quantity: p.stockQuantity,
      previousStock: 0,
      newStock: p.stockQuantity,
      reference: "INIT-SEED",
      notes: `Milestone 50 Seed Engine: Initial stock for ${p.name}`,
      performedBy: username,
    });
  }

  // 4. Create Customers
  await Customer.insertMany(
    rawData.customers.map((c) => ({
      businessId: bId,
      name: c.name,
      phone: c.phone,
      address: c.address,
      creditLimit: c.creditLimit,
      currentBalance: 0,
      loyaltyPoints: c.loyaltyPoints,
      loyaltyTier: c.loyaltyPoints > 300 ? "GOLD" : c.loyaltyPoints > 100 ? "SILVER" : "BRONZE",
      isActive: true,
    }))
  );

  // 5. Ensure at least 2 default registers exist
  const existingRegs = await Register.countDocuments({ businessId: bId });
  let registersCreated = 0;
  if (existingRegs === 0) {
    await Register.insertMany([
      {
        businessId: bId,
        registerNumber: "REG-01",
        name: "Counter 01 (Main POS)",
        location: "Front Entrance",
        printerWidth: "80mm",
        isDefault: true,
        isActive: true,
      },
      {
        businessId: bId,
        registerNumber: "REG-02",
        name: "Counter 02 (Express Checkout)",
        location: "Express Lane",
        printerWidth: "58mm",
        isDefault: false,
        isActive: true,
      },
    ]);
    registersCreated = 2;
  }

  // Log Audit Entry
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    await AuditLog.create({
      businessId: bId,
      action: "DEMO_DATA_SEEDED",
      entity: "SYSTEM",
      entityId: businessId,
      userId: new mongoose.Types.ObjectId(userId),
      details: {
        preset,
        clearedOldData: clearExisting,
        productsCount: productsCreated,
        categoriesCount: categoryDocs.length,
        suppliersCount: supplierDocs.length,
      },
    });
  }

  return {
    success: true,
    preset,
    businessId,
    clearedOldData: clearExisting,
    categoriesCreated: categoryDocs.length,
    suppliersCreated: supplierDocs.length,
    productsCreated,
    batchesCreated,
    customersCreated: rawData.customers.length,
    registersCreated,
    message: `Successfully provisioned ${preset} store with ${productsCreated} products, ${supplierDocs.length} suppliers, and ${batchesCreated} batches.`,
  };
}
