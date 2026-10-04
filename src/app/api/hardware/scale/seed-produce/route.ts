import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { requireRole } from "@/lib/tenant";

const SAMPLE_PRODUCE_ITEMS = [
  {
    name: "Red Onions (රතු ළූණු)",
    nameSinhala: "රතු ළූණු",
    nameTamil: "சின்ன வெங்காயம்",
    pluCode: "101",
    barcode: "2100101000000",
    sku: "PLU-101",
    sellingPrice: 420.0,
    costPrice: 320.0,
    unit: "kg",
    stockQuantity: 45.5,
    lowStockThreshold: 10,
    isWeighable: true,
    tareWeightGrams: 5,
    categoryName: "Vegetables",
  },
  {
    name: "Big Onions (ලොකු ළූණු)",
    nameSinhala: "ලොකු ළූණු",
    nameTamil: "பெரிய வெங்காயம்",
    pluCode: "102",
    barcode: "2100102000000",
    sku: "PLU-102",
    sellingPrice: 280.0,
    costPrice: 210.0,
    unit: "kg",
    stockQuantity: 60.0,
    lowStockThreshold: 15,
    isWeighable: true,
    tareWeightGrams: 5,
    categoryName: "Vegetables",
  },
  {
    name: "Nuwara Eliya Potatoes (අල)",
    nameSinhala: "අල",
    nameTamil: "உருளைக்கிழங்கு",
    pluCode: "103",
    barcode: "2100103000000",
    sku: "PLU-103",
    sellingPrice: 320.0,
    costPrice: 240.0,
    unit: "kg",
    stockQuantity: 50.0,
    lowStockThreshold: 12,
    isWeighable: true,
    tareWeightGrams: 5,
    categoryName: "Vegetables",
  },
  {
    name: "Fresh Carrots (කැරට්)",
    nameSinhala: "කැරට්",
    nameTamil: "கேரட்",
    pluCode: "104",
    barcode: "2100104000000",
    sku: "PLU-104",
    sellingPrice: 450.0,
    costPrice: 340.0,
    unit: "kg",
    stockQuantity: 28.5,
    lowStockThreshold: 8,
    isWeighable: true,
    tareWeightGrams: 5,
    categoryName: "Vegetables",
  },
  {
    name: "Green Chillies (අමු මිරිස්)",
    nameSinhala: "අමු මිරිස්",
    nameTamil: "பச்சை மிளகாய்",
    pluCode: "105",
    barcode: "2100105000000",
    sku: "PLU-105",
    sellingPrice: 850.0,
    costPrice: 650.0,
    unit: "kg",
    stockQuantity: 12.0,
    lowStockThreshold: 3,
    isWeighable: true,
    tareWeightGrams: 5,
    categoryName: "Vegetables",
  },
  {
    name: "Fresh Chicken Breast (කුකුල් මස්)",
    nameSinhala: "කුකුල් මස්",
    nameTamil: "கோழி இறைச்சி",
    pluCode: "106",
    barcode: "2100106000000",
    sku: "PLU-106",
    sellingPrice: 1450.0,
    costPrice: 1180.0,
    unit: "kg",
    stockQuantity: 22.4,
    lowStockThreshold: 5,
    isWeighable: true,
    tareWeightGrams: 15,
    categoryName: "Meat & Poultry",
  },
  {
    name: "Fresh Sailfish / Thalapath (තලපත්)",
    nameSinhala: "තලපත්",
    nameTamil: "தலபத்",
    pluCode: "107",
    barcode: "2100107000000",
    sku: "PLU-107",
    sellingPrice: 2600.0,
    costPrice: 2150.0,
    unit: "kg",
    stockQuantity: 15.0,
    lowStockThreshold: 4,
    isWeighable: true,
    tareWeightGrams: 20,
    categoryName: "Seafood",
  },
  {
    name: "Red Lady Papaya (පැපොල්)",
    nameSinhala: "පැපොල්",
    nameTamil: "பப்பாளி",
    pluCode: "108",
    barcode: "2100108000000",
    sku: "PLU-108",
    sellingPrice: 220.0,
    costPrice: 150.0,
    unit: "kg",
    stockQuantity: 35.0,
    lowStockThreshold: 10,
    isWeighable: true,
    tareWeightGrams: 5,
    categoryName: "Fruits",
  },
  {
    name: "Ambul Bananas (ඇඹුල් කෙසෙල්)",
    nameSinhala: "ඇඹුල් කෙසෙල්",
    nameTamil: "வாழைப்பழம்",
    pluCode: "109",
    barcode: "2100109000000",
    sku: "PLU-109",
    sellingPrice: 260.0,
    costPrice: 180.0,
    unit: "kg",
    stockQuantity: 40.0,
    lowStockThreshold: 10,
    isWeighable: true,
    tareWeightGrams: 10,
    categoryName: "Fruits",
  },
];

export async function POST(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of SAMPLE_PRODUCE_ITEMS) {
        // Find or create category
        let category = await Category.findOne({
          businessId: context.businessId,
          name: item.categoryName,
        });

        if (!category) {
          category = await Category.create({
            businessId: context.businessId,
            name: item.categoryName,
            color: item.categoryName === "Vegetables" ? "#10b981" : item.categoryName === "Fruits" ? "#f59e0b" : "#ef4444",
          });
        }

        // Check if product with this PLU or name already exists
        const existing = await Product.findOne({
          businessId: context.businessId,
          $or: [{ pluCode: item.pluCode }, { sku: item.sku }, { name: item.name }],
        });

        if (existing) {
          existing.pluCode = item.pluCode;
          existing.isWeighable = true;
          existing.tareWeightGrams = item.tareWeightGrams;
          existing.unit = item.unit;
          existing.sellingPrice = item.sellingPrice;
          existing.nameSinhala = item.nameSinhala;
          existing.nameTamil = item.nameTamil;
          existing.categoryId = category._id;
          await existing.save();
          updatedCount++;
        } else {
          await Product.create({
            businessId: context.businessId,
            categoryId: category._id,
            name: item.name,
            nameSinhala: item.nameSinhala,
            nameTamil: item.nameTamil,
            sku: item.sku,
            barcode: item.barcode,
            pluCode: item.pluCode,
            isWeighable: true,
            tareWeightGrams: item.tareWeightGrams,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            stockQuantity: item.stockQuantity,
            lowStockThreshold: item.lowStockThreshold,
            unit: item.unit,
            isActive: true,
          });
          createdCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully seeded produce PLU catalog (${createdCount} created, ${updatedCount} updated).`,
        count: SAMPLE_PRODUCE_ITEMS.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${SAMPLE_PRODUCE_ITEMS.length} produce items in demo mode.`,
      count: SAMPLE_PRODUCE_ITEMS.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
