export type Language = "en" | "si" | "ta";

export interface TranslationsSchema {
  nav: {
    posCounter: string;
    delivery: string;
    kds: string;
    tables: string;
    dashboard: string;
    products: string;
    inventory: string;
    batches: string;
    labels: string;
    purchases: string;
    grn: string;
    transfers: string;
    salesHistory: string;
    invoices: string;
    quotations: string;
    returns: string;
    shifts: string;
    expenses: string;
    customers: string;
    promotions: string;
    sms: string;
    staff: string;
    reports: string;
    backups: string;
    settings: string;
    admin: string;
    signOut: string;
  };
  pos: {
    searchPlaceholder: string;
    allCategories: string;
    cart: string;
    emptyCart: string;
    emptyCartPrompt: string;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    checkout: string;
    holdCart: string;
    clearCart: string;
    paymentMethod: string;
    cash: string;
    card: string;
    credit: string;
    giftVoucher: string;
    cashTendered: string;
    changeDue: string;
    exactAmount: string;
    retailPrice: string;
    wholesalePrice: string;
    batch: string;
    expiry: string;
    pointsEarned: string;
    fefoBadge: string;
    stock: string;
  };
  receipt: {
    receiptTitle: string;
    taxInvoiceTitle: string;
    invoiceNumber: string;
    date: string;
    time: string;
    cashier: string;
    counter: string;
    customer: string;
    phone: string;
    item: string;
    qty: string;
    price: string;
    total: string;
    subtotal: string;
    discount: string;
    vat: string;
    sscl: string;
    grandTotal: string;
    cashPaid: string;
    change: string;
    creditNotice: string;
    giftVoucherNotice: string;
    signature: string;
    thankYou: string;
    returnPolicy: string;
    scanQr: string;
    verifiedStamp: string;
  };
  portal: {
    portalTitle: string;
    creditLedger: string;
    outstandingDebt: string;
    creditLimit: string;
    availableCredit: string;
    accountStatus: string;
    statusClear: string;
    statusActive: string;
    statusOverLimit: string;
    bankSettlement: string;
    sendSlipWhatsapp: string;
    loyaltyRewards: string;
    currentPoints: string;
    monetaryValue: string;
    vipCardPass: string;
    referralRewards: string;
    copyReferralCode: string;
    giftVouchers: string;
    checkVoucher: string;
    enterVoucherCode: string;
    voucherBalance: string;
    history: string;
  };
  common: {
    print: string;
    copyLink: string;
    copied: string;
    shareWhatsapp: string;
    viewReceipt: string;
    openPortal: string;
    language: string;
    english: string;
    sinhala: string;
    tamil: string;
    loading: string;
    save: string;
    cancel: string;
    close: string;
    confirm: string;
    success: string;
    error: string;
  };
}

export const translations: Record<Language, TranslationsSchema> = {
  en: {
    nav: {
      posCounter: "POS Counter",
      delivery: "Delivery Hub",
      kds: "Kitchen Display (KDS)",
      tables: "Dining Tables",
      dashboard: "Dashboard",
      products: "Products",
      inventory: "Inventory",
      batches: "Batches & Expiry",
      labels: "Barcode & Labels",
      purchases: "Purchases & Vendors",
      grn: "Goods Received (GRN)",
      transfers: "Transfers & Branches",
      salesHistory: "Sales History",
      invoices: "Invoices & B2B",
      quotations: "Quotations & Estimates",
      returns: "Returns & Credit Notes",
      shifts: "Shifts & Drawers",
      expenses: "Expenses & Petty Cash",
      customers: "Customers (Naya Potha)",
      promotions: "Promotions & Loyalty",
      sms: "SMS & Notifications",
      staff: "Staff & Commissions",
      reports: "Reports & P&L",
      backups: "Cloud Backups",
      settings: "Store Settings",
      admin: "Super Admin",
      signOut: "Sign Out",
    },
    pos: {
      searchPlaceholder: "Scan barcode or search name / SKU (F2)...",
      allCategories: "All Categories",
      cart: "Current Cart",
      emptyCart: "Cart is empty",
      emptyCartPrompt: "Scan barcodes or select items from catalog",
      subtotal: "Subtotal",
      discount: "Discount",
      tax: "Tax",
      total: "Net Total",
      checkout: "Charge & Print",
      holdCart: "Hold Cart",
      clearCart: "Clear Cart",
      paymentMethod: "Payment Method",
      cash: "Cash",
      card: "Card",
      credit: "Credit (Naya Potha)",
      giftVoucher: "Gift Voucher",
      cashTendered: "Cash Tendered",
      changeDue: "Change to Return",
      exactAmount: "Exact Amount",
      retailPrice: "Retail",
      wholesalePrice: "Wholesale",
      batch: "Batch",
      expiry: "Exp",
      pointsEarned: "Points Earned",
      fefoBadge: "FEFO",
      stock: "In Stock",
    },
    receipt: {
      receiptTitle: "SALES RECEIPT",
      taxInvoiceTitle: "COMMERCIAL TAX INVOICE",
      invoiceNumber: "Invoice #",
      date: "Date",
      time: "Time",
      cashier: "Cashier",
      counter: "Counter",
      customer: "Customer",
      phone: "Tel",
      item: "Item Description",
      qty: "Qty",
      price: "Unit Price",
      total: "Total",
      subtotal: "Subtotal",
      discount: "Discount",
      vat: "VAT (18%)",
      sscl: "SSCL (2.5%)",
      grandTotal: "TOTAL",
      cashPaid: "Cash Tendered",
      change: "Change Returned",
      creditNotice: "* BILLED TO NAYA POTHA CREDIT ACCOUNT *",
      giftVoucherNotice: "* PAID VIA DIGITAL GIFT VOUCHER *",
      signature: "Customer Acknowledgement Signature",
      thankYou: "Thank you for shopping with us! Please come again.",
      returnPolicy: "Goods returnable within 3 days in original condition with receipt.",
      scanQr: "Scan for Digital E-Receipt & Tax Verification",
      verifiedStamp: "IRD Verified Official E-Receipt",
    },
    portal: {
      portalTitle: "Customer Self-Service Portal",
      creditLedger: "Naya Potha Credit Ledger",
      outstandingDebt: "Outstanding Debt",
      creditLimit: "Credit Limit",
      availableCredit: "Available Credit",
      accountStatus: "Account Status",
      statusClear: "CLEARED",
      statusActive: "ACTIVE",
      statusOverLimit: "LIMIT EXCEEDED",
      bankSettlement: "Direct Bank Transfer Settlement Details",
      sendSlipWhatsapp: "Send Slip on WhatsApp",
      loyaltyRewards: "Loyalty Rewards Club",
      currentPoints: "Points Balance",
      monetaryValue: "LKR Discount Value",
      vipCardPass: "Digital VIP Membership Pass",
      referralRewards: "Referral Rewards Club",
      copyReferralCode: "Copy Referral Code",
      giftVouchers: "Gift Voucher Checker",
      checkVoucher: "Check Balance",
      enterVoucherCode: "Enter voucher code (e.g. GV-...)",
      voucherBalance: "Remaining Balance",
      history: "Transaction History",
    },
    common: {
      print: "Print",
      copyLink: "Copy Link",
      copied: "Copied!",
      shareWhatsapp: "Share on WhatsApp",
      viewReceipt: "View E-Receipt",
      openPortal: "Open Statement",
      language: "Language",
      english: "English",
      sinhala: "සිංහල",
      tamil: "தமிழ்",
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      close: "Close",
      confirm: "Confirm",
      success: "Success",
      error: "Error",
    },
  },
  si: {
    nav: {
      posCounter: "විකුණුම් පර්යන්තය",
      delivery: "බෙදාහැරීම් මධ්‍යස්ථානය",
      kds: "මුළුතැන්ගෙයි පුවරුව (KDS)",
      tables: "මේස කළමනාකරණය",
      dashboard: "පාලක පුවරුව",
      products: "භාණ්ඩ",
      inventory: "තොග පාලනය",
      batches: "කාණ්ඩ හා කල්ඉකුත්වීම්",
      labels: "බාර්කෝඩ් ලේබල්",
      purchases: "මිලදී ගැනීම් හා සැපයුම්",
      grn: "භාණ්ඩ ලැබීමේ සටහන් (GRN)",
      transfers: "ශාඛා හා මාරු කිරීම්",
      salesHistory: "විකුණුම් ඉතිහාසය",
      invoices: "බදු ඉන්වොයිසි",
      quotations: "මිල ගණන් කැඳවීම්",
      returns: "ආපසු භාරගැනීම්",
      shifts: "මුර හා ලාච්චු",
      expenses: "වියදම් හා සුළු මුදල්",
      customers: "පාරිභෝගිකයින් (ණය පොත)",
      promotions: "ප්‍රවර්ධන හා ලකුණු",
      sms: "SMS පණිවිඩ",
      staff: "කාර්ය මණ්ඩලය",
      reports: "වාර්තා හා ලාභ/අලාභ",
      backups: "වලාකුළු උපස්ථ (Backups)",
      settings: "වෙළඳසැල් සැකසුම්",
      admin: "ප්‍රධාන පරිපාලක",
      signOut: "පිටවීම",
    },
    pos: {
      searchPlaceholder: "බාර්කෝඩ් ස්කෑන් කරන්න හෝ නම / SKU සොයන්න (F2)...",
      allCategories: "සියලු වර්ග",
      cart: "මිලදී ගැනුම් කරත්තය",
      emptyCart: "කරත්තය හිස්ය",
      emptyCartPrompt: "භාණ්ඩ එකතු කිරීමට ස්කෑන් කරන්න හෝ තෝරන්න",
      subtotal: "උප එකතුව",
      discount: "වට්ටම්",
      tax: "බදු",
      total: "මුළු එකතුව",
      checkout: "ගෙවීම් බිල්පත",
      holdCart: "රඳවා තබන්න",
      clearCart: "හිස් කරන්න",
      paymentMethod: "ගෙවීම් ක්‍රමය",
      cash: "මුදල් ගෙවීම්",
      card: "කාඩ්පත්",
      credit: "ණයට ලබාදීම (ණය පොත)",
      giftVoucher: "තෑගි වවුචරය",
      cashTendered: "ලැබුණු මුදල",
      changeDue: "ඉතිරි මුදල",
      exactAmount: "නියමිත මුදල",
      retailPrice: "සිල්ලර",
      wholesalePrice: "තොග",
      batch: "කාණ්ඩය",
      expiry: "කල්ඉකුත්",
      pointsEarned: "ලැබුණු ලකුණු",
      fefoBadge: "පළමුව කල්ඉකුත්",
      stock: "තොගය",
    },
    receipt: {
      receiptTitle: "විකුණුම් බිල්පත",
      taxInvoiceTitle: "වාණිජ බදු ඉන්වොයිසිය",
      invoiceNumber: "බිල්පත් අංකය",
      date: "දිනය",
      time: "වේලාව",
      cashier: "අයකැමි",
      counter: "පර්යන්තය",
      customer: "පාරිභෝගිකයා",
      phone: "දුරකථන",
      item: "භාණ්ඩ විස්තරය",
      qty: "ප්‍රමාණය",
      price: "ඒකක මිල",
      total: "මුදල",
      subtotal: "උප එකතුව",
      discount: "වට්ටම්",
      vat: "වැට් බද්ද (18%)",
      sscl: "සමාජ ආරක්ෂණ බද්ද (2.5%)",
      grandTotal: "මුළු එකතුව",
      cashPaid: "ලැබුණු මුදල",
      change: "ඉතිරි මුදල",
      creditNotice: "* ණය ගිණුමට හර කරන ලදී (ණය පොත) *",
      giftVoucherNotice: "* ඩිජිටල් තෑගි වවුචරයකින් ගෙවන ලදී *",
      signature: "පාරිභෝගික අත්සන",
      thankYou: "ස්තූතියි! නැවත පැමිණෙන්න.",
      returnPolicy: "දින 3ක් ඇතුළත බිල්පත සමඟ භාණ්ඩ මාරු කළ හැක.",
      scanQr: "ඩිජිටල් බිල්පත හා බදු සත්‍යාපනය සඳහා ස්කෑන් කරන්න",
      verifiedStamp: "දේශීය ආදායම් දෙපාර්තමේන්තුව අනුමත ඩිජිටල් බිල්පත",
    },
    portal: {
      portalTitle: "පාරිභෝගික ස්වයං සේවා පියස",
      creditLedger: "ණය පොත ගිණුම් සටහන",
      outstandingDebt: "ගෙවීමට ඇති ණය ශේෂය",
      creditLimit: "ණය සීමාව",
      availableCredit: "ඉතිරි ණය සීමාව",
      accountStatus: "ගිණුමේ තත්ත්වය",
      statusClear: "ණය පියවා ඇත",
      statusActive: "සක්‍රීයයි",
      statusOverLimit: "සීමාව ඉක්මවා ඇත",
      bankSettlement: "බැංකු තැන්පතු මඟින් ණය පියවීම් විස්තර",
      sendSlipWhatsapp: "රිසිට්පත WhatsApp කරන්න",
      loyaltyRewards: "පාරිභෝගික ප්‍රසාද ලකුණු",
      currentPoints: "ලකුණු ශේෂය",
      monetaryValue: "රුපියල් වට්ටම් වටිනාකම",
      vipCardPass: "ඩිජිටල් VIP සාමාජික කාඩ්පත",
      referralRewards: "යොමු කිරීමේ ප්‍රතිලාභ සමාජය",
      copyReferralCode: "යොමු කිරීමේ කේතය පිටපත් කරන්න",
      giftVouchers: "තෑගි වවුචර් ශේෂය",
      checkVoucher: "පරීක්ෂා කරන්න",
      enterVoucherCode: "වවුචර් කේතය ඇතුළත් කරන්න (උදා: GV-...)",
      voucherBalance: "ඉතිරි ශේෂය",
      history: "ගනුදෙනු ඉතිහාසය",
    },
    common: {
      print: "මුද්‍රණය කරන්න",
      copyLink: "ලින්ක් එක පිටපත් කරන්න",
      copied: "පිටපත් විය!",
      shareWhatsapp: "WhatsApp මඟින් යවන්න",
      viewReceipt: "බිල්පත බලන්න",
      openPortal: "ණය ගිණුම බලන්න",
      language: "භාෂාව",
      english: "English",
      sinhala: "සිංහල",
      tamil: "தமிழ்",
      loading: "පූරණය වෙමින්...",
      save: "සුරකින්න",
      cancel: "අවලංගු කරන්න",
      close: "වසන්න",
      confirm: "තහවුරු කරන්න",
      success: "සාර්ථකයි",
      error: "දෝෂයකි",
    },
  },
  ta: {
    nav: {
      posCounter: "விற்பனை கவுண்டர்",
      delivery: "டெலிவரி மையம்",
      kds: "சமையலறை திரை (KDS)",
      tables: "சாப்பாட்டு மேசைகள்",
      dashboard: "டாஷ்போர்டு",
      products: "தயாரிப்புகள்",
      inventory: "சரக்கு இருப்பு",
      batches: "தொகுதிகள் மற்றும் காலாவதி",
      labels: "பார்கோடு லேபிள்கள்",
      purchases: "கொள்முதல் மற்றும் விற்பனையாளர்கள்",
      grn: "பொருட்கள் பெறுதல் (GRN)",
      transfers: "கிளை இடமாற்றங்கள்",
      salesHistory: "விற்பனை வரலாறு",
      invoices: "வரி விலைப்பட்டியல்",
      quotations: "விலை மேற்கோள்கள்",
      returns: "வருமானங்கள் & வரவு குறிப்புகள்",
      shifts: "ஷிப்டுகள் & இழுப்பறைகள்",
      expenses: "செலவுகள் & சில்லறை ரொக்கம்",
      customers: "வாடிக்கையாளர்கள் (கடன் புத்தகம்)",
      promotions: "விளம்பரங்கள் & புள்ளிகள்",
      sms: "எஸ்எம்எஸ் அறிவிப்புகள்",
      staff: "ஊழியர்கள் & கமிஷன்",
      reports: "அறிக்கைகள் & லாப நட்டம்",
      backups: "கிளவுட் காப்புப்பிரதி",
      settings: "கடை அமைப்புகள்",
      admin: "நிர்வாகி",
      signOut: "வெளியேறு",
    },
    pos: {
      searchPlaceholder: "பார்கோடை ஸ்கேன் செய்க அல்லது தேடுக (F2)...",
      allCategories: "அனைத்து பிரிவுகள்",
      cart: "ஷாப்பிங் கார்ட்",
      emptyCart: "கார்ட் காலியாக உள்ளது",
      emptyCartPrompt: "பொருட்களை சேர்க்க ஸ்கேன் செய்யவும்",
      subtotal: "கூட்டுத்தொகை",
      discount: "தள்ளுபடி",
      tax: "வரி",
      total: "மொத்த தொகை",
      checkout: "பில் அச்சிடுக",
      holdCart: "ஆர்டரை நிறுத்து",
      clearCart: "கார்ட் அழிக்க",
      paymentMethod: "கட்டண முறை",
      cash: "ரொக்கம்",
      card: "அட்டை",
      credit: "கடன் (நய போத)",
      giftVoucher: "பரிசு வவுச்சர்",
      cashTendered: "பெறப்பட்ட ரொக்கம்",
      changeDue: "மீதி பணம்",
      exactAmount: "சரியான தொகை",
      retailPrice: "சில்லறை",
      wholesalePrice: "மொத்த",
      batch: "தொகுதி",
      expiry: "காலாவதி",
      pointsEarned: "பெற்ற புள்ளிகள்",
      fefoBadge: "முதலில் காலாவதி",
      stock: "இருப்பு",
    },
    receipt: {
      receiptTitle: "விற்பனை ரசீது",
      taxInvoiceTitle: "வணிக வரி விலைப்பட்டியல்",
      invoiceNumber: "விலைப்பட்டியல் எண்",
      date: "தேதி",
      time: "நேரம்",
      cashier: "காசாளர்",
      counter: "கவுண்டர்",
      customer: "வாடிக்கையாளர்",
      phone: "தொலைபேசி",
      item: "பொருள் விவரம்",
      qty: "அளவு",
      price: "அலகு விலை",
      total: "தொகை",
      subtotal: "கூட்டுத்தொகை",
      discount: "தள்ளுபடி",
      vat: "வாட் வரி (18%)",
      sscl: "சமூக பாதுகாப்பு வரி (2.5%)",
      grandTotal: "மொத்தம்",
      cashPaid: "பெறப்பட்ட பணம்",
      change: "மீதி தொகை",
      creditNotice: "* நய போத கடன் கணக்கில் பற்று வைக்கப்பட்டது *",
      giftVoucherNotice: "* டிஜிட்டல் பரிசு வவுச்சர் மூலம் செலுத்தப்பட்டது *",
      signature: "வாடிக்கையாளர் கையொப்பம்",
      thankYou: "நன்றி! மீண்டும் வருக.",
      returnPolicy: "ரசீதுடன் 3 நாட்களுக்குள் பொருட்களை மாற்றலாம்.",
      scanQr: "டிஜிட்டல் ரசீது & வரி சரிபார்ப்புக்கு QR ஸ்கேன் செய்யவும்",
      verifiedStamp: "உள்நாட்டு இறைவரி அங்கீகரிக்கப்பட்ட மின்-ரசீது",
    },
    portal: {
      portalTitle: "வாடிக்கையாளர் சேவை போர்டல்",
      creditLedger: "நய போத கடன் கணக்கு புத்தகம்",
      outstandingDebt: "நிலுவை கடன் தொகை",
      creditLimit: "கடன் வரம்பு",
      availableCredit: "கிடைக்கக்கூடிய கடன்",
      accountStatus: "கணக்கு நிலை",
      statusClear: "கடன் தீர்க்கப்பட்டது",
      statusActive: "செயலில் உள்ளது",
      statusOverLimit: "வரம்பு தாண்டியது",
      bankSettlement: "வங்கி பரிமாற்ற தீர்வு விவரங்கள்",
      sendSlipWhatsapp: "WhatsApp மூலம் ரசீதை அனுப்பவும்",
      loyaltyRewards: "விசுவாச புள்ளிகள் கிளப்",
      currentPoints: "புள்ளிகள் இருப்பு",
      monetaryValue: "ரூபாய் தள்ளுபடி மதிப்பு",
      vipCardPass: "டிஜிட்டல் விஐபி உறுப்பினர் அட்டை",
      referralRewards: "பரிந்துரை வெகுமதி கிளப்",
      copyReferralCode: "பரிந்துரைக் குறியீட்டை நகலெடு",
      giftVouchers: "பரிசு வவுச்சர் இருப்பு",
      checkVoucher: "இருப்பை சரிபார்க்கவும்",
      enterVoucherCode: "வவுச்சர் குறியீட்டை உள்ளிடவும் (எ.கா: GV-...)",
      voucherBalance: "மீதமுள்ள இருப்பு",
      history: "பரிவர்த்தனை வரலாறு",
    },
    common: {
      print: "அச்சிடுக",
      copyLink: "இணைப்பை நகலெடு",
      copied: "நகலெடுக்கப்பட்டது!",
      shareWhatsapp: "WhatsApp இல் பகிரவும்",
      viewReceipt: "ரசீதை காண்க",
      openPortal: "கடன் அறிக்கையை திற",
      language: "மொழி",
      english: "English",
      sinhala: "සිංහල",
      tamil: "தமிழ்",
      loading: "ஏற்றுகிறது...",
      save: "சேமிக்கவும்",
      cancel: "ரத்து செய்",
      close: "மூடு",
      confirm: "உறுதிப்படுத்தவும்",
      success: "வெற்றி",
      error: "பிழை",
    },
  },
};
