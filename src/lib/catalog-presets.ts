import { Types } from "mongoose";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { connectToDatabase } from "@/lib/db";

export interface PresetCategory {
  name: string;
  color: string;
  description: string;
}

export interface PresetProduct {
  name: string;
  barcode: string;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  categoryIndex: number; // Index in categories array
}

export interface CatalogPreset {
  key: string;
  title: string;
  description: string;
  iconName: string;
  categories: PresetCategory[];
  products: PresetProduct[];
}

export const CATALOG_PRESETS: Record<string, CatalogPreset> = {
  GROCERY: {
    key: "GROCERY",
    title: "Grocery & Supermarket",
    description: "Biscuits, milk, Ceylon tea, samba rice, spices, soaps & essentials",
    iconName: "Store",
    categories: [
      { name: "Biscuits & Bakery", color: "#f59e0b", description: "Crackers, cookies, bread & rusks" },
      { name: "Dairy & Milk", color: "#06b6d4", description: "Fresh milk, powdered milk, yogurt, butter" },
      { name: "Beverages & Ceylon Tea", color: "#10b981", description: "Pure Ceylon tea, coffee, malt drinks" },
      { name: "Dry Rations & Rice", color: "#8b5cf6", description: "Samba rice, nadu, dhal, sugar, flour" },
      { name: "Snacks & Confectionery", color: "#ec4899", description: "Chocolates, savory snacks, murukku" },
      { name: "Household & Soaps", color: "#3b82f6", description: "Detergents, laundry soaps, dental care" },
    ],
    products: [
      {
        name: "Munchee Super Cream Cracker 490g",
        barcode: "4792038010015",
        sku: "BIS-001",
        costPrice: 260,
        sellingPrice: 320,
        stockQuantity: 40,
        lowStockThreshold: 10,
        unit: "packet",
        categoryIndex: 0,
      },
      {
        name: "Kotmale Fresh Milk 1L",
        barcode: "4791024003012",
        sku: "MILK-001",
        costPrice: 490,
        sellingPrice: 580,
        stockQuantity: 25,
        lowStockThreshold: 8,
        unit: "bottle",
        categoryIndex: 1,
      },
      {
        name: "Watawala Ceylon Tea 200g",
        barcode: "4791012004501",
        sku: "TEA-001",
        costPrice: 340,
        sellingPrice: 420,
        stockQuantity: 35,
        lowStockThreshold: 6,
        unit: "packet",
        categoryIndex: 2,
      },
      {
        name: "Keeri Samba Rice 5kg",
        barcode: "4793001002004",
        sku: "RICE-005",
        costPrice: 1250,
        sellingPrice: 1450,
        stockQuantity: 20,
        lowStockThreshold: 5,
        unit: "bag",
        categoryIndex: 3,
      },
      {
        name: "Sunlight Soap 110g",
        barcode: "4791001000101",
        sku: "SOAP-001",
        costPrice: 120,
        sellingPrice: 150,
        stockQuantity: 60,
        lowStockThreshold: 12,
        unit: "bar",
        categoryIndex: 5,
      },
      {
        name: "Maggi 2-Minute Noodles 73g",
        barcode: "4791005001201",
        sku: "NOOD-001",
        costPrice: 110,
        sellingPrice: 140,
        stockQuantity: 50,
        lowStockThreshold: 10,
        unit: "packet",
        categoryIndex: 4,
      },
      {
        name: "MD Tomato Sauce 400g",
        barcode: "4791045002011",
        sku: "SAU-001",
        costPrice: 380,
        sellingPrice: 460,
        stockQuantity: 18,
        lowStockThreshold: 4,
        unit: "bottle",
        categoryIndex: 3,
      },
      {
        name: "Prima Special Flour 1kg",
        barcode: "4791035001102",
        sku: "FLOUR-001",
        costPrice: 210,
        sellingPrice: 260,
        stockQuantity: 30,
        lowStockThreshold: 8,
        unit: "packet",
        categoryIndex: 3,
      },
    ],
  },
  BAKERY: {
    key: "BAKERY",
    title: "Bakery, Cafe & Pastry Shop",
    description: "Roast paan, fish buns, patties, eclairs, butter cake, Ceylon milk tea",
    iconName: "Coffee",
    categories: [
      { name: "Breads & Loaves", color: "#f59e0b", description: "Fresh roast paan, sliced sandwich bread, buns" },
      { name: "Short Eats & Savouries", color: "#ef4444", description: "Spicy fish buns, egg rolls, patties, samosas" },
      { name: "Pastries & Cakes", color: "#ec4899", description: "Chocolate eclairs, ribbon cake, doughnuts" },
      { name: "Hot Beverages", color: "#84cc16", description: "Ceylon milk tea, ginger tea, fresh coffee" },
      { name: "Cold Drinks", color: "#06b6d4", description: "Iced coffee, faluda, soft drinks, bottled water" },
    ],
    products: [
      {
        name: "Traditional Roast Paan (Loaf)",
        barcode: "4799010001",
        sku: "BAK-001",
        costPrice: 90,
        sellingPrice: 130,
        stockQuantity: 40,
        lowStockThreshold: 10,
        unit: "loaf",
        categoryIndex: 0,
      },
      {
        name: "Spicy Fish Bun (Malu Paan)",
        barcode: "4799010002",
        sku: "BAK-002",
        costPrice: 65,
        sellingPrice: 100,
        stockQuantity: 50,
        lowStockThreshold: 12,
        unit: "piece",
        categoryIndex: 1,
      },
      {
        name: "Crispy Chinese Egg Roll",
        barcode: "4799010003",
        sku: "BAK-003",
        costPrice: 70,
        sellingPrice: 110,
        stockQuantity: 35,
        lowStockThreshold: 8,
        unit: "piece",
        categoryIndex: 1,
      },
      {
        name: "Creamy Chocolate Eclair",
        barcode: "4799010004",
        sku: "BAK-004",
        costPrice: 85,
        sellingPrice: 140,
        stockQuantity: 30,
        lowStockThreshold: 6,
        unit: "piece",
        categoryIndex: 2,
      },
      {
        name: "Rich Butter Cake 500g",
        barcode: "4799010005",
        sku: "BAK-005",
        costPrice: 420,
        sellingPrice: 650,
        stockQuantity: 15,
        lowStockThreshold: 4,
        unit: "box",
        categoryIndex: 2,
      },
      {
        name: "Ceylon Milk Tea (Hot Cup)",
        barcode: "4799010006",
        sku: "BEV-001",
        costPrice: 40,
        sellingPrice: 80,
        stockQuantity: 100,
        lowStockThreshold: 20,
        unit: "cup",
        categoryIndex: 3,
      },
      {
        name: "Chilled Iced Coffee 300ml",
        barcode: "4799010007",
        sku: "BEV-002",
        costPrice: 110,
        sellingPrice: 180,
        stockQuantity: 35,
        lowStockThreshold: 8,
        unit: "bottle",
        categoryIndex: 4,
      },
    ],
  },
  PHARMACY: {
    key: "PHARMACY",
    title: "Pharmacy & Wellness",
    description: "Panadol, Samahan, Siddhalepa, first aid, baby hygiene, antiseptics",
    iconName: "ShieldPlus",
    categories: [
      { name: "Pain & Fever Relief", color: "#ef4444", description: "Paracetamol, NSAIDs, fever medicines" },
      { name: "Cough & Cold Relief", color: "#3b82f6", description: "Syrups, herbal balms, lozenges" },
      { name: "First Aid & Antiseptics", color: "#10b981", description: "Bandages, surgical tape, antiseptic liquid" },
      { name: "Baby & Mother Care", color: "#ec4899", description: "Baby soap, diapers, gripe water" },
      { name: "Personal Hygiene", color: "#8b5cf6", description: "Face masks, dental care, sanitizers" },
    ],
    products: [
      {
        name: "Panadol 500mg Tablets (Card of 10)",
        barcode: "4798010001",
        sku: "MED-001",
        costPrice: 35,
        sellingPrice: 50,
        stockQuantity: 120,
        lowStockThreshold: 25,
        unit: "card",
        categoryIndex: 0,
      },
      {
        name: "Samahan Herbal Tea (Pack of 10)",
        barcode: "4798010002",
        sku: "MED-002",
        costPrice: 280,
        sellingPrice: 350,
        stockQuantity: 50,
        lowStockThreshold: 10,
        unit: "pack",
        categoryIndex: 1,
      },
      {
        name: "Siddhalepa Herbal Balm 50g",
        barcode: "4798010003",
        sku: "MED-003",
        costPrice: 220,
        sellingPrice: 280,
        stockQuantity: 40,
        lowStockThreshold: 8,
        unit: "bottle",
        categoryIndex: 1,
      },
      {
        name: "Dettol Antiseptic Liquid 125ml",
        barcode: "4798010004",
        sku: "MED-004",
        costPrice: 310,
        sellingPrice: 390,
        stockQuantity: 30,
        lowStockThreshold: 6,
        unit: "bottle",
        categoryIndex: 2,
      },
      {
        name: "Surgical Face Masks 3-Ply (10s)",
        barcode: "4798010005",
        sku: "MED-005",
        costPrice: 120,
        sellingPrice: 180,
        stockQuantity: 70,
        lowStockThreshold: 15,
        unit: "pack",
        categoryIndex: 4,
      },
    ],
  },
  APPAREL: {
    key: "APPAREL",
    title: "Clothing & Fashion Boutique",
    description: "Men's shirts, handloom sarongs, ladies kurtis, belts, accessories",
    iconName: "Shirt",
    categories: [
      { name: "Men's Wear", color: "#3b82f6", description: "Casual shirts, linen shirts, trousers" },
      { name: "Traditional & Sarongs", color: "#10b981", description: "Handloom sarongs, batik sarongs" },
      { name: "Women's Wear", color: "#ec4899", description: "Kurtis, blouses, skirts, shawls" },
      { name: "Accessories & Belts", color: "#f59e0b", description: "Leather belts, socks, wallets" },
    ],
    products: [
      {
        name: "Men's Casual Linen Shirt (L)",
        barcode: "4797010001",
        sku: "CLO-001",
        costPrice: 1600,
        sellingPrice: 2450,
        stockQuantity: 18,
        lowStockThreshold: 3,
        unit: "piece",
        categoryIndex: 0,
      },
      {
        name: "Traditional Handloom Sarong",
        barcode: "4797010002",
        sku: "CLO-002",
        costPrice: 1100,
        sellingPrice: 1750,
        stockQuantity: 25,
        lowStockThreshold: 5,
        unit: "piece",
        categoryIndex: 1,
      },
      {
        name: "Ladies Cotton Printed Kurti (M)",
        barcode: "4797010003",
        sku: "CLO-003",
        costPrice: 1400,
        sellingPrice: 2200,
        stockQuantity: 20,
        lowStockThreshold: 4,
        unit: "piece",
        categoryIndex: 2,
      },
      {
        name: "Genuine Leather Men's Belt",
        barcode: "4797010004",
        sku: "CLO-004",
        costPrice: 750,
        sellingPrice: 1350,
        stockQuantity: 22,
        lowStockThreshold: 5,
        unit: "piece",
        categoryIndex: 3,
      },
      {
        name: "Cotton Crew Socks (Pack of 3)",
        barcode: "4797010005",
        sku: "CLO-005",
        costPrice: 320,
        sellingPrice: 550,
        stockQuantity: 35,
        lowStockThreshold: 8,
        unit: "pack",
        categoryIndex: 3,
      },
    ],
  },
  HARDWARE: {
    key: "HARDWARE",
    title: "Hardware, Paints & Electricals",
    description: "LED bulbs, PVC pipes, solvent cement, screwdrivers, measuring tapes",
    iconName: "Wrench",
    categories: [
      { name: "Electrical & Lighting", color: "#f59e0b", description: "LED bulbs, switches, cables, plug bases" },
      { name: "Plumbing & PVC", color: "#06b6d4", description: "PVC pipes, elbows, solvent gum, taps" },
      { name: "Hand Tools", color: "#ef4444", description: "Hammers, screwdrivers, pliers, measuring tapes" },
      { name: "Paints & Solvents", color: "#8b5cf6", description: "Brushes, rollers, thinners, masking tape" },
    ],
    products: [
      {
        name: "LED Bulb 9W Pin Type (Daylight)",
        barcode: "4796010001",
        sku: "ELE-001",
        costPrice: 260,
        sellingPrice: 380,
        stockQuantity: 50,
        lowStockThreshold: 10,
        unit: "piece",
        categoryIndex: 0,
      },
      {
        name: "PVC Pipe 1/2 Inch Type 400 (10ft)",
        barcode: "4796010002",
        sku: "PLU-001",
        costPrice: 380,
        sellingPrice: 520,
        stockQuantity: 30,
        lowStockThreshold: 6,
        unit: "length",
        categoryIndex: 1,
      },
      {
        name: "PVC Solvent Gum / Cement 100ml",
        barcode: "4796010003",
        sku: "PLU-002",
        costPrice: 190,
        sellingPrice: 270,
        stockQuantity: 40,
        lowStockThreshold: 8,
        unit: "can",
        categoryIndex: 1,
      },
      {
        name: "Screwdriver Multi-Bit Set 6-in-1",
        barcode: "4796010004",
        sku: "TOO-001",
        costPrice: 650,
        sellingPrice: 950,
        stockQuantity: 15,
        lowStockThreshold: 3,
        unit: "set",
        categoryIndex: 2,
      },
      {
        name: "Heavy Duty Measuring Tape 5M",
        barcode: "4796010005",
        sku: "TOO-002",
        costPrice: 420,
        sellingPrice: 650,
        stockQuantity: 25,
        lowStockThreshold: 5,
        unit: "piece",
        categoryIndex: 2,
      },
    ],
  },
  BLANK: {
    key: "BLANK",
    title: "Blank / Custom Inventory",
    description: "Start fresh with an empty shelf and scan your own custom barcodes",
    iconName: "FolderPlus",
    categories: [
      { name: "General Products", color: "#3b82f6", description: "General retail goods" },
      { name: "Counter Quick Items", color: "#10b981", description: "Fast-moving checkout products" },
    ],
    products: [],
  },
};

/**
 * Seeds a business's database collection with category and product presets.
 */
export async function seedBusinessCatalog(
  businessId: string | Types.ObjectId,
  presetKey: string
): Promise<{ categoriesCount: number; productsCount: number }> {
  const preset = CATALOG_PRESETS[presetKey] || CATALOG_PRESETS.GROCERY;

  if (Boolean(process.env.MONGODB_URI)) {
    await connectToDatabase();

    const targetBizId = typeof businessId === "string" ? new Types.ObjectId(businessId) : businessId;

    // 1. Insert Categories
    const createdCategories = await Promise.all(
      preset.categories.map((c) =>
        Category.create({
          businessId: targetBizId,
          name: c.name,
          color: c.color,
          description: c.description,
          isActive: true,
        })
      )
    );

    // 2. Insert Products linking to created Category IDs
    if (preset.products.length > 0) {
      const productDocs = preset.products.map((p) => {
        const assignedCat = createdCategories[p.categoryIndex] || createdCategories[0];
        return {
          businessId: targetBizId,
          categoryId: assignedCat ? assignedCat._id : undefined,
          name: p.name,
          barcode: p.barcode,
          sku: p.sku,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          stockQuantity: p.stockQuantity,
          lowStockThreshold: p.lowStockThreshold,
          unit: p.unit,
          isActive: true,
        };
      });

      await Product.insertMany(productDocs);
    }

    return {
      categoriesCount: createdCategories.length,
      productsCount: preset.products.length,
    };
  }

  // Fallback for Demo Mode without MongoDB
  return {
    categoriesCount: preset.categories.length,
    productsCount: preset.products.length,
  };
}
