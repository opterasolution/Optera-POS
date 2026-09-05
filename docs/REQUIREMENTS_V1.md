# 🇱🇰 Sri Lanka Small Business POS — Phase 0: Requirements & Specifications

## 1. Project Overview & Scope
- **Product Name**: Sri Lanka Corner Store & Small Business POS (V1)
- **Target Market**: Sri Lankan retail (Groceries, Mini-Supermarkets, Stationery, Retail, Hardware, Bakeries)
- **Primary Goal**: Ultra-simple, high-speed, reliable retail counter checkout and stock tracking designed for non-technical shop owners and cashiers.

---

## 2. Sri Lankan Market Standards & Localization

### 2.1 Currency & Pricing
- **Currency Code**: `LKR`
- **Currency Symbol**: `Rs.` (Standard Sri Lankan retail convention)
- **Display Format**: `Rs. 1,250.00` (Standard commas for thousands, 2 decimal places)
- **Data Storage**: Store all monetary values in floating point / integer cents in database, never as raw formatted strings.
- **Client/Server Integrity**: Browser prices are strictly UI previews. Server recalculates and confirms line totals and discounts against database product prices.

### 2.2 Sri Lankan Phone Numbers
- **Allowed Formats**:
  - Local format: `07XXXXXXXX` (10 digits starting with `070`, `071`, `072`, `074`, `075`, `076`, `077`, `078`)
  - International format: `+947XXXXXXXX` or `947XXXXXXXX`
  - Landline format: `011XXXXXXX`, `081XXXXXXX`, `033XXXXXXX`, etc.
- **Validation**: Regex matching `^(?:0|\+?94)[0-9]{9}$` or standard Sri Lankan telecom prefix patterns. Avoid US/international-only validators.

### 2.3 Timezone & Dates
- **Standard Timezone**: `Asia/Colombo` (UTC+05:30)
- **Timestamp Strategy**: UTC storage in MongoDB; conversion to `Asia/Colombo` during presentation for business transaction consistency.

### 2.4 Language & Translations (i18n Readiness)
- **V1 Launch Language**: English (US/UK standard)
- **Architecture**: Key-value translation dictionaries (`en.json`, with placeholder files `si.json` for Sinhala and `ta.json` for Tamil).
- **Rule**: Never hardcode user-facing strings directly inside components without referencing translation keys or structured label dictionaries.

---

## 3. Tax Engine Specification
- **Design**: Fully configurable by the shop owner; no hardcoded national tax assumptions.
- **Configurable Attributes**:
  - `taxEnabled` (Boolean: true/false)
  - `taxName` (String: e.g., "VAT", "SSCL", "Service Tax")
  - `taxRate` (Number: percentage, e.g., 2.5%, 8%, 18%)
  - `taxType` (Enum: `INCLUSIVE` [price already includes tax] or `EXCLUSIVE` [tax added at checkout])

---

## 4. Payment Methods & Cash Register UX
- **Supported Payment Methods**:
  - `CASH`: Triggers quick cash calculator (`Amount Received`, `Total`, `Change Due`) with fast denomination buttons (e.g., Rs. 500, Rs. 1,000, Rs. 5,000, Exact Amount).
  - `CARD`: Cashier selects "Card" and enters optional card reference / authorization code.
  - `QR_PAYMENT`: Cashier selects "LankaQR / QR" (records transaction without requiring API terminal setup).
  - `BANK_TRANSFER`: Records direct bank transfer confirmation.
  - `OTHER`: Flexible fallback.

---

## 5. High-Speed POS Screen Rules
- **Layout**:
  - **Left 60%**: Product quick-access grid, search bar with keyboard autofocus, category filter pills, barcode scanner instant input.
  - **Right 40%**: Active checkout cart, item quantity adjuster (`+` / `-` / custom input), delete button, item subtotal, order discount, tax breakdown, net total, cash tender box, and high-visibility "COMPLETE SALE" button.
- **Barcode Scanner Compatibility**:
  - USB scanners transmit keystrokes ending with `Enter` (KeyCode 13).
  - System intercepts barcode input immediately, matches product, adds to cart (or increments quantity if already in cart), and clears the input buffer for the next scan without requiring mouse clicks.

---

## 6. Inventory Rules & Stock Integrity
- Sales decrement product `stockQuantity` automatically via atomic database operations.
- Out-of-stock items flag a clear warning.
- Every adjustment creates an `InventoryLog` entry (Reason: `SALE`, `RESTOCK`, `DAMAGE`, `ADJUSTMENT`).
- Negative inventory can be globally toggled (`allowNegativeStock`: default `false`).

---

## 7. Multi-Tenant Security & Role Matrix

### 7.1 Multi-Tenant Isolation
- Every database model holds an indexed `businessId`.
- Session JWT provides authenticated `businessId` server-side.
- APIs automatically scope all operations: `{ businessId: session.user.businessId }`.

### 7.2 Role-Based Access Control (RBAC)
| Feature / Action | OWNER | MANAGER | CASHIER |
| :--- | :---: | :---: | :---: |
| POS Checkout & Sales | ✅ | ✅ | ✅ |
| Product Catalog View | ✅ | ✅ | ✅ |
| Product Create / Edit | ✅ | ✅ | ❌ |
| Stock Adjustment | ✅ | ✅ | ❌ |
| Daily Sales Summary | ✅ | ✅ | ❌ |
| Profit & Expense Reports | ✅ | ❌ | ❌ |
| Business Settings & Taxes | ✅ | ❌ | ❌ |
| User / Staff Management | ✅ | ❌ | ❌ |

---

## 8. Receipt Specification (Thermal 58mm & 80mm)
- Built with CSS `@media print` optimized for standard thermal paper rolls.
- Header: Business Name, Address, Phone, Date & Time, Invoice #, Cashier Name.
- Body: Tabular items (`Name`, `Qty`, `Price`, `Total`).
- Footer: Subtotal, Discount, Tax, Grand Total, Payment Type, Cash Tendered, Change Due, Greeting message.
