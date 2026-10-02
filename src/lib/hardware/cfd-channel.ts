// ============================================================================
// Sri Lanka POS - Customer Facing Display (CFD) BroadcastChannel Protocol
// ============================================================================

export const CFD_CHANNEL_NAME = "slpos_cfd_channel";

export interface ICFDCartItem {
  id: string;
  name: string;
  nameSi?: string;
  nameTa?: string;
  price: number;
  quantity: number;
  unit?: string;
  isWeighable?: boolean;
  tareWeightGrams?: number;
  lineTotal: number;
  discountAmount?: number;
}

export interface ICFDState {
  status: "IDLE" | "SCANNING" | "CHECKOUT" | "COMPLETED";
  businessName: string;
  businessLogo?: string;
  welcomeMessage?: string;
  promotionalMessage?: string;
  registerName?: string;
  cashierName?: string;
  items: ICFDCartItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  // Payment info (when checking out or completed)
  paymentMethod?: string;
  amountTendered?: number;
  changeDue?: number;
  receiptNumber?: string;
  receiptUrl?: string;
  lastUpdated: number;
}

export type CFDMessage =
  | { type: "SYNC_REQUEST" }
  | { type: "SYNC_STATE"; state: ICFDState }
  | { type: "CART_UPDATE"; state: Partial<ICFDState> }
  | { type: "SALE_COMPLETED"; payment: { method: string; tendered: number; change: number; receiptNumber: string; receiptUrl?: string } }
  | { type: "RESET_IDLE" };

export function createCFDBroadcastChannel(): BroadcastChannel | null {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    return new BroadcastChannel(CFD_CHANNEL_NAME);
  }
  return null;
}
