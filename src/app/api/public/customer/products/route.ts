import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { Product } from "@/models/Product";

/**
 * Public Customer B2B Wholesale Catalog API
 * Returns products with wholesale pricing and live stock levels for customer self-ordering.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token")?.trim();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Missing customer portal token" },
        { status: 400 }
      );
    }

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({ portalToken: token }).lean();
      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired portal token" },
          { status: 404 }
        );
      }

      // Fetch active products
      const products = await Product.find({
        businessId: customer.businessId,
        isActive: true,
      })
        .populate("categoryId", "name")
        .sort({ name: 1 })
        .lean();

      const mappedProducts = products.map((p: any) => ({
        _id: p._id,
        name: p.name,
        nameSinhala: p.nameSinhala,
        nameTamil: p.nameTamil,
        sku: p.sku,
        barcode: p.barcode,
        categoryName: p.categoryId?.name || "General Goods",
        sellingPrice: p.sellingPrice,
        wholesalePrice: p.wholesalePrice || p.sellingPrice,
        wholesaleMinQty: p.wholesaleMinQty || 1,
        stockQuantity: p.stockQuantity,
        unit: p.unit || "pcs",
        isWeighable: p.isWeighable || false,
        isAvailable: p.stockQuantity > 0,
      }));

      return NextResponse.json({
        success: true,
        products: mappedProducts,
        customerWholesaleTier: customer.wholesaleTier || "TIER_1",
      });
    }

    // Demo Mode Fallback Catalog
    return NextResponse.json({
      success: true,
      customerWholesaleTier: "TIER_1",
      products: [
        {
          _id: "demo_p1",
          name: "Keeri Samba Rice (50kg Bulk Bag)",
          nameSinhala: "කීරි සම්බා සහල් (50kg)",
          sku: "WHL-RICE-50K",
          categoryName: "Grains & Rice",
          sellingPrice: 13500,
          wholesalePrice: 11800,
          wholesaleMinQty: 2,
          stockQuantity: 45,
          unit: "bag",
          isAvailable: true,
        },
        {
          _id: "demo_p2",
          name: "Mysore Dhal Red (25kg Sack)",
          nameSinhala: "මයිසූර් පරිප්පු (25kg)",
          sku: "WHL-DHAL-25K",
          categoryName: "Pulses & Legumes",
          sellingPrice: 9200,
          wholesalePrice: 7950,
          wholesaleMinQty: 1,
          stockQuantity: 28,
          unit: "sack",
          isAvailable: true,
        },
        {
          _id: "demo_p3",
          name: "White Crystal Sugar (50kg Bag)",
          nameSinhala: "සුදු සීනි (50kg)",
          sku: "WHL-SUG-50K",
          categoryName: "Sugar & Sweeteners",
          sellingPrice: 14200,
          wholesalePrice: 12600,
          wholesaleMinQty: 1,
          stockQuantity: 34,
          unit: "bag",
          isAvailable: true,
        },
        {
          _id: "demo_p4",
          name: "Pure Coconut Oil (20L Commercial Can)",
          nameSinhala: "පිරිසිදු පොල්තෙල් (20L)",
          sku: "WHL-OIL-20L",
          categoryName: "Oils & Ghee",
          sellingPrice: 16800,
          wholesalePrice: 14900,
          wholesaleMinQty: 1,
          stockQuantity: 18,
          unit: "can",
          isAvailable: true,
        },
        {
          _id: "demo_p5",
          name: "Ceylon BOPF Tea Bulk Carton (10kg)",
          nameSinhala: "ලංකා තේ (10kg)",
          sku: "WHL-TEA-10K",
          categoryName: "Beverages",
          sellingPrice: 18500,
          wholesalePrice: 15600,
          wholesaleMinQty: 1,
          stockQuantity: 12,
          unit: "carton",
          isAvailable: true,
        },
        {
          _id: "demo_p6",
          name: "Red Onions Wholesale Sack (50kg)",
          nameSinhala: "රතු ළූණු තොග ගෝනි (50kg)",
          sku: "WHL-ONION-50K",
          categoryName: "Fresh Produce",
          sellingPrice: 20000,
          wholesalePrice: 17500,
          wholesaleMinQty: 1,
          stockQuantity: 25,
          unit: "sack",
          isAvailable: true,
        },
        {
          _id: "demo_p7",
          name: "Nuwara Eliya Potatoes (50kg Sack)",
          nameSinhala: "නුවරඑළිය අල (50kg)",
          sku: "WHL-POT-50K",
          categoryName: "Fresh Produce",
          sellingPrice: 17000,
          wholesalePrice: 14800,
          wholesaleMinQty: 1,
          stockQuantity: 30,
          unit: "sack",
          isAvailable: true,
        },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
