/**
 * Sri Lankan Licensed Commercial & Specialized Banks Master Directory
 * Contains Central Bank of Sri Lanka (CBSL) 4-digit bank routing codes,
 * standard bank names, abbreviations, and common dishonor/return codes.
 */

export interface SriLankanBank {
  code: string;
  name: string;
  shortName: string;
  swiftCode?: string;
  isPopular: boolean;
}

export const SRI_LANKAN_BANKS: SriLankanBank[] = [
  { code: "7056", name: "Commercial Bank of Ceylon PLC", shortName: "Commercial Bank", swiftCode: "CCEYLKIX", isPopular: true },
  { code: "7278", name: "Sampath Bank PLC", shortName: "Sampath Bank", swiftCode: "BSAMLKLX", isPopular: true },
  { code: "7010", name: "Bank of Ceylon", shortName: "BOC", swiftCode: "BCEYLKLX", isPopular: true },
  { code: "7083", name: "Hatton National Bank PLC", shortName: "HNB", swiftCode: "HBLILKLX", isPopular: true },
  { code: "7135", name: "People's Bank", shortName: "People's Bank", swiftCode: "PSBLLKLX", isPopular: true },
  { code: "7287", name: "Seylan Bank PLC", shortName: "Seylan Bank", swiftCode: "SEYBLKLX", isPopular: true },
  { code: "7162", name: "Nations Trust Bank PLC", shortName: "NTB", swiftCode: "NTBLLKLX", isPopular: true },
  { code: "7214", name: "National Development Bank PLC", shortName: "NDB", swiftCode: "NDBLLKLX", isPopular: true },
  { code: "7454", name: "DFCC Bank PLC", shortName: "DFCC Bank", swiftCode: "DFCCLKIX", isPopular: true },
  { code: "7311", name: "Pan Asia Banking Corporation PLC", shortName: "Pan Asia Bank", swiftCode: "PABLLKLX", isPopular: true },
  { code: "7302", name: "Union Bank of Colombo PLC", shortName: "Union Bank", swiftCode: "UBOCLKIX", isPopular: false },
  { code: "7463", name: "Cargills Bank Limited", shortName: "Cargills Bank", swiftCode: "CBILLKLX", isPopular: false },
  { code: "7472", name: "Amana Bank PLC", shortName: "Amana Bank", swiftCode: "AMNALKLX", isPopular: false },
  { code: "7047", name: "Standard Chartered Bank", shortName: "Standard Chartered", swiftCode: "SCBLLKLX", isPopular: false },
  { code: "7092", name: "The Hongkong and Shanghai Banking Corporation (HSBC)", shortName: "HSBC", swiftCode: "HSBCLKLX", isPopular: false },
  { code: "7074", name: "Habib Bank Limited", shortName: "Habib Bank", swiftCode: "HBBLLKLX", isPopular: false },
  { code: "7108", name: "Indian Bank", shortName: "Indian Bank", swiftCode: "IDIBLKLX", isPopular: false },
  { code: "7117", name: "Indian Overseas Bank", shortName: "Indian Overseas Bank", swiftCode: "IOBALKLX", isPopular: false },
  { code: "7205", name: "State Bank of India", shortName: "State Bank of India", swiftCode: "SBINLKLX", isPopular: false },
  { code: "7144", name: "Public Bank Berhad", shortName: "Public Bank", swiftCode: "PBLBLKLX", isPopular: false },
  { code: "7728", name: "Regional Development Bank", shortName: "RDB", isPopular: false },
  { code: "7737", name: "State Mortgage & Investment Bank", shortName: "SMIB", isPopular: false },
  { code: "7746", name: "HDFC Bank of Sri Lanka", shortName: "HDFC Bank", isPopular: false },
  { code: "7719", name: "Sanasa Development Bank PLC", shortName: "SDB Bank", isPopular: false },
];

export const POPULAR_SRI_LANKA_BRANCHES = [
  "Colombo Fort",
  "Pettah",
  "Kollupitiya",
  "Bambalapitiya",
  "Wellawatte",
  "Borella",
  "Maradana",
  "Nugegoda",
  "Maharagama",
  "Dehiwala",
  "Mount Lavinia",
  "Moratuwa",
  "Kottawa",
  "Malabe",
  "Battaramulla",
  "Rajagiriya",
  "Kaduwela",
  "Negombo",
  "Gampaha",
  "Wattala",
  "Ja-Ela",
  "Kiribathgoda",
  "Kelaniya",
  "Kandy City",
  "Peradeniya",
  "Katugastota",
  "Kurunegala",
  "Galle Fort",
  "Galle City",
  "Matara",
  "Kalutara",
  "Panadura",
  "Ratnapura",
  "Badulla",
  "Anuradhapura",
  "Polonnaruwa",
  "Trincomalee",
  "Batticaloa",
  "Jaffna",
  "Vavuniya",
  "Dambulla",
  "Matale",
  "Chilaw",
  "Puttalam",
];

export interface ChequeDishonorReason {
  code: string;
  reason: string;
  description: string;
  defaultPenalty: number; // typical fee in LKR
}

export const CHEQUE_DISHONOR_REASONS: ChequeDishonorReason[] = [
  {
    code: "01",
    reason: "INSUFFICIENT_FUNDS",
    description: "Insufficient Funds in Account (Exceeds Arrangement / Cheque Bounced)",
    defaultPenalty: 1000,
  },
  {
    code: "02",
    reason: "REFER_TO_DRAWER",
    description: "Refer to Drawer (Contact Issuer for Funds Confirmation)",
    defaultPenalty: 1000,
  },
  {
    code: "03",
    reason: "PAYMENT_STOPPED",
    description: "Payment Stopped by Drawer",
    defaultPenalty: 1000,
  },
  {
    code: "04",
    reason: "SIGNATURE_DIFFERS",
    description: "Drawer's Signature Differs / Incomplete",
    defaultPenalty: 500,
  },
  {
    code: "05",
    reason: "POST_DATED",
    description: "Post-Dated Cheque Presented Prematurely",
    defaultPenalty: 0,
  },
  {
    code: "06",
    reason: "STALE_CHEQUE",
    description: "Stale Cheque (Expired / Older than 6 Months from Date)",
    defaultPenalty: 500,
  },
  {
    code: "07",
    reason: "WORDS_FIGURES_DIFFER",
    description: "Amount in Words and Figures Differ",
    defaultPenalty: 500,
  },
  {
    code: "08",
    reason: "ACCOUNT_CLOSED",
    description: "Account Closed / Blocked / Frozen",
    defaultPenalty: 1500,
  },
  {
    code: "09",
    reason: "ALTERATION_NOT_SIGNED",
    description: "Alteration on Cheque Requires Drawer's Full Signature",
    defaultPenalty: 500,
  },
  {
    code: "99",
    reason: "OTHER",
    description: "Other Technical or Administrative Return Reason",
    defaultPenalty: 500,
  },
];
