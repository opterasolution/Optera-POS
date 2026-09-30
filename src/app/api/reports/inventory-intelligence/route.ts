import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { Sale } from "@/models/Sale";
import { requireRole } from "@/lib/tenant";

export type AgingStatus = "FAST_MOVING" | "MODERATE" | "SLOW_MOVING" | "DEAD_STOCK";

export interface IInventoryIntelligenceItem {
  productId: string;
  name: string;
  sku?: string;
  barcode?: string;
  categoryName: string;
  unit: string;
  stockQuantity: number;
  costPrice: number;
  sellingPrice: number;
  tiedUpCapital: number;
  potentialRevenue: number;
  unitMargin: number;
  marginPercent: number;
  daysSinceLastSale: number;
  lastSoldDate?: string;
  unitsSold30d: number;
  agingStatus: AgingStatus;
  clearanceRecommendation: string;
}

export async function GET(req: Request) {
  try {
    const context = await requireRole(["OWNER", "MANAGER"]);
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all"; // all | dead_stock | slow_moving | fast_moving | loss_leaders

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      const businessId = context.businessId;

      // 1. Fetch All Active Products & Categories
      const [products, categories] = await Promise.all([
        Product.find({ businessId, isActive: true }).lean(),
        Category.find({ businessId }).lean(),
      ]);

      const categoryMap = new Map<string, string>();
      categories.forEach((c) => {
        categoryMap.set(c._id.toString(), c.name);
      });

      // 2. Fetch Completed Sales from the last 90 days to evaluate movement
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const sales = await Sale.find({
        businessId,
        status: "COMPLETED",
        createdAt: { $gte: ninetyDaysAgo },
      })
        .select("items createdAt")
        .lean();

      // Aggregate sales velocity per product
      const productSalesMeta = new Map<
        string,
        { lastSoldAt?: Date; unitsSold30d: number; unitsSold90d: number }
      >();

      sales.forEach((s) => {
        const saleDate = new Date(s.createdAt);
        const isLast30d = saleDate >= thirtyDaysAgo;

        s.items.forEach((item) => {
          const pId = item.productId.toString();
          const meta = productSalesMeta.get(pId) || { unitsSold30d: 0, unitsSold90d: 0 };

          if (!meta.lastSoldAt || saleDate > meta.lastSoldAt) {
            meta.lastSoldAt = saleDate;
          }

          meta.unitsSold90d += item.quantity || 1;
          if (isLast30d) {
            meta.unitsSold30d += item.quantity || 1;
          }

          productSalesMeta.set(pId, meta);
        });
      });

      const now = Date.now();
      let totalInventoryValuation = 0;
      let totalPotentialRevenue = 0;
      let deadStockCapital = 0;
      let deadStockCount = 0;
      let slowMovingCapital = 0;
      let slowMovingCount = 0;
      let fastMovingCount = 0;
      let moderateCount = 0;

      const categoryStatsMap = new Map<
        string,
        { name: string; count: number; capital: number; potentialRev: number; deadCapital: number }
      >();

      const items: IInventoryIntelligenceItem[] = [];

      products.forEach((p) => {
        const pId = p._id.toString();
        const costPrice = p.costPrice || 0;
        const sellingPrice = p.sellingPrice || 0;
        const stockQuantity = p.stockQuantity || 0;
        const tiedUpCapital = Math.round(stockQuantity * costPrice * 100) / 100;
        const potentialRevenue = Math.round(stockQuantity * sellingPrice * 100) / 100;
        const unitMargin = Math.round((sellingPrice - costPrice) * 100) / 100;
        const marginPercent =
          sellingPrice > 0 ? Math.round(((sellingPrice - costPrice) / sellingPrice) * 1000) / 10 : 0;

        totalInventoryValuation += tiedUpCapital;
        totalPotentialRevenue += potentialRevenue;

        // Sales velocity calculation
        const meta = productSalesMeta.get(pId);
        let daysSinceLastSale = 999;
        let lastSoldDate: string | undefined = undefined;

        if (meta?.lastSoldAt) {
          daysSinceLastSale = Math.floor((now - meta.lastSoldAt.getTime()) / (1000 * 60 * 60 * 24));
          lastSoldDate = meta.lastSoldAt.toISOString();
        } else if (p.createdAt) {
          daysSinceLastSale = Math.floor((now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        }

        const unitsSold30d = meta?.unitsSold30d || 0;

        // Aging classification
        let agingStatus: AgingStatus = "MODERATE";
        let clearanceRecommendation = "Optimal stock turnover";

        if (stockQuantity <= 0) {
          agingStatus = "MODERATE";
          clearanceRecommendation = "Out of stock - reorder if required";
        } else if (daysSinceLastSale <= 14 && unitsSold30d >= 5) {
          agingStatus = "FAST_MOVING";
          fastMovingCount++;
          clearanceRecommendation = "Fast mover: Maintain safety stock to prevent stockouts";
        } else if (daysSinceLastSale <= 30) {
          agingStatus = "MODERATE";
          moderateCount++;
          clearanceRecommendation = "Healthy turnover: Monitor normal reorder cycle";
        } else if (daysSinceLastSale <= 60) {
          agingStatus = "SLOW_MOVING";
          slowMovingCount++;
          slowMovingCapital += tiedUpCapital;
          clearanceRecommendation =
            marginPercent > 20
              ? "Promote at counter or display on shelf-edge price talker"
              : "Feature in mix-and-match bundle to accelerate sell-through";
        } else {
          // 60+ days without sale or dormant since creation
          agingStatus = "DEAD_STOCK";
          deadStockCount++;
          deadStockCapital += tiedUpCapital;
          if (marginPercent > 25) {
            clearanceRecommendation = "Mark down 15-20% in Quick Clearance Sale to recover working capital";
          } else {
            clearanceRecommendation = "Bundle with high-velocity staples or claim supplier credit/return";
          }
        }

        if (marginPercent < 5 && stockQuantity > 0) {
          clearanceRecommendation = "⚠️ Warning: Selling near or below cost! Adjust selling price or renegotiate supplier purchase cost.";
        }

        const catName = (p.categoryId && categoryMap.get(p.categoryId.toString())) || "Uncategorized";

        // Update category breakdown
        const cStat = categoryStatsMap.get(catName) || {
          name: catName,
          count: 0,
          capital: 0,
          potentialRev: 0,
          deadCapital: 0,
        };
        cStat.count++;
        cStat.capital += tiedUpCapital;
        cStat.potentialRev += potentialRevenue;
        if (agingStatus === "DEAD_STOCK") {
          cStat.deadCapital += tiedUpCapital;
        }
        categoryStatsMap.set(catName, cStat);

        items.push({
          productId: pId,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          categoryName: catName,
          unit: p.unit || "pcs",
          stockQuantity,
          costPrice,
          sellingPrice,
          tiedUpCapital,
          potentialRevenue,
          unitMargin,
          marginPercent,
          daysSinceLastSale,
          lastSoldDate,
          unitsSold30d,
          agingStatus,
          clearanceRecommendation,
        });
      });

      // Filter items according to requested query
      let filteredItems = items;
      if (filter === "dead_stock") {
        filteredItems = items.filter((i) => i.agingStatus === "DEAD_STOCK" && i.stockQuantity > 0);
      } else if (filter === "slow_moving") {
        filteredItems = items.filter((i) => i.agingStatus === "SLOW_MOVING" && i.stockQuantity > 0);
      } else if (filter === "fast_moving") {
        filteredItems = items.filter((i) => i.agingStatus === "FAST_MOVING");
      } else if (filter === "loss_leaders") {
        filteredItems = items.filter((i) => i.marginPercent < 5 && i.stockQuantity > 0);
      }

      // Sort filtered items by tiedUpCapital descending
      filteredItems.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

      // Top margin items
      const topMarginProducts = [...items]
        .filter((i) => i.stockQuantity > 0 && i.marginPercent > 0)
        .sort((a, b) => b.marginPercent - a.marginPercent)
        .slice(0, 6);

      // Category breakdown list
      const categoryBreakdown = Array.from(categoryStatsMap.values()).map((c) => {
        const catMargin =
          c.potentialRev > 0
            ? Math.round(((c.potentialRev - c.capital) / c.potentialRev) * 1000) / 10
            : 0;
        return {
          categoryName: c.name,
          productCount: c.count,
          tiedUpCapital: Math.round(c.capital),
          potentialRevenue: Math.round(c.potentialRev),
          deadStockCapital: Math.round(c.deadCapital),
          marginPercent: catMargin,
        };
      });

      // Inventory Health Score (0 - 100)
      const healthScore =
        totalInventoryValuation > 0
          ? Math.max(0, Math.round(100 - (deadStockCapital / totalInventoryValuation) * 100))
          : 100;

      return NextResponse.json({
        success: true,
        summary: {
          totalProducts: products.length,
          totalInventoryValuation: Math.round(totalInventoryValuation * 100) / 100,
          totalPotentialRevenue: Math.round(totalPotentialRevenue * 100) / 100,
          deadStockCapital: Math.round(deadStockCapital * 100) / 100,
          deadStockCount,
          slowMovingCapital: Math.round(slowMovingCapital * 100) / 100,
          slowMovingCount,
          fastMovingCount,
          moderateCount,
          healthScore,
        },
        categoryBreakdown,
        topMarginProducts,
        items: filteredItems,
      });
    }

    // Demo Fallback Data for Sri Lankan Retail
    const demoItems: IInventoryIntelligenceItem[] = [
      {
        productId: "demo-1",
        name: "Keeri Samba Rice 5kg (Araliya)",
        sku: "RIC-KS-5KG",
        barcode: "479201900101",
        categoryName: "Rice & Grains",
        unit: "bag",
        stockQuantity: 45,
        costPrice: 1250,
        sellingPrice: 1450,
        tiedUpCapital: 56250,
        potentialRevenue: 65250,
        unitMargin: 200,
        marginPercent: 13.8,
        daysSinceLastSale: 0,
        lastSoldDate: new Date().toISOString(),
        unitsSold30d: 82,
        agingStatus: "FAST_MOVING",
        clearanceRecommendation: "High-velocity essential staple: Maintain 50+ bag reserve",
      },
      {
        productId: "demo-2",
        name: "Munchee Super Cream Cracker 490g",
        sku: "BIS-SCC-490",
        barcode: "479100200102",
        categoryName: "Biscuits & Confectionery",
        unit: "pkt",
        stockQuantity: 60,
        costPrice: 260,
        sellingPrice: 320,
        tiedUpCapital: 15600,
        potentialRevenue: 19200,
        unitMargin: 60,
        marginPercent: 18.8,
        daysSinceLastSale: 1,
        lastSoldDate: new Date(Date.now() - 86400000).toISOString(),
        unitsSold30d: 110,
        agingStatus: "FAST_MOVING",
        clearanceRecommendation: "Everyday breakfast favorite: Optimal stock turnover",
      },
      {
        productId: "demo-3",
        name: "Kotmale Full Cream Milk 1L",
        sku: "DAI-KOT-1L",
        barcode: "479211300050",
        categoryName: "Dairy & Milk",
        unit: "tetra",
        stockQuantity: 28,
        costPrice: 490,
        sellingPrice: 580,
        tiedUpCapital: 13720,
        potentialRevenue: 16240,
        unitMargin: 90,
        marginPercent: 15.5,
        daysSinceLastSale: 0,
        lastSoldDate: new Date().toISOString(),
        unitsSold30d: 54,
        agingStatus: "FAST_MOVING",
        clearanceRecommendation: "Fast moving perishable: Monitor expiry dates regularly",
      },
      {
        productId: "demo-4",
        name: "Ceylonta Pure Black Tea 400g Foil",
        sku: "BEV-TEA-400",
        barcode: "479100500120",
        categoryName: "Beverages & Tea",
        unit: "box",
        stockQuantity: 35,
        costPrice: 540,
        sellingPrice: 720,
        tiedUpCapital: 18900,
        potentialRevenue: 25200,
        unitMargin: 180,
        marginPercent: 25.0,
        daysSinceLastSale: 4,
        lastSoldDate: new Date(Date.now() - 4 * 86400000).toISOString(),
        unitsSold30d: 22,
        agingStatus: "MODERATE",
        clearanceRecommendation: "Healthy turnover: Good margin contribution",
      },
      {
        productId: "demo-5",
        name: "Siddhalepa Herbal Balm 50g Large",
        sku: "AYU-SID-50G",
        barcode: "479200300185",
        categoryName: "Ayurveda & Health",
        unit: "bottle",
        stockQuantity: 22,
        costPrice: 380,
        sellingPrice: 550,
        tiedUpCapital: 8360,
        potentialRevenue: 12100,
        unitMargin: 170,
        marginPercent: 30.9,
        daysSinceLastSale: 38,
        lastSoldDate: new Date(Date.now() - 38 * 86400000).toISOString(),
        unitsSold30d: 1,
        agingStatus: "SLOW_MOVING",
        clearanceRecommendation: "High margin item: Feature on counter display or near cashier stand",
      },
      {
        productId: "demo-6",
        name: "Glitz Floor Cleaner Pine 1L",
        sku: "HOU-GLZ-1L",
        barcode: "479100700555",
        categoryName: "Household & Cleaning",
        unit: "bottle",
        stockQuantity: 18,
        costPrice: 580,
        sellingPrice: 750,
        tiedUpCapital: 10440,
        potentialRevenue: 13500,
        unitMargin: 170,
        marginPercent: 22.7,
        daysSinceLastSale: 45,
        lastSoldDate: new Date(Date.now() - 45 * 86400000).toISOString(),
        unitsSold30d: 0,
        agingStatus: "SLOW_MOVING",
        clearanceRecommendation: "Print shelf-edge price talker tag or bundle with dishwash liquid",
      },
      {
        productId: "demo-7",
        name: "Avurudu Brass Oil Lamp Wicks (Pack of 50)",
        sku: "FES-WCK-50",
        barcode: "479900100999",
        categoryName: "Seasonal & Festive",
        unit: "pkt",
        stockQuantity: 85,
        costPrice: 180,
        sellingPrice: 280,
        tiedUpCapital: 15300,
        potentialRevenue: 23800,
        unitMargin: 100,
        marginPercent: 35.7,
        daysSinceLastSale: 84,
        lastSoldDate: new Date(Date.now() - 84 * 86400000).toISOString(),
        unitsSold30d: 0,
        agingStatus: "DEAD_STOCK",
        clearanceRecommendation: "Dead seasonal inventory: Mark down 25% or bundle in poya day hamper",
      },
      {
        productId: "demo-8",
        name: "Canned Jackfruit in Brine 560g Export",
        sku: "CAN-JCK-560",
        barcode: "479100900222",
        categoryName: "Canned Foods",
        unit: "can",
        stockQuantity: 34,
        costPrice: 620,
        sellingPrice: 850,
        tiedUpCapital: 21080,
        potentialRevenue: 28900,
        unitMargin: 230,
        marginPercent: 27.1,
        daysSinceLastSale: 72,
        lastSoldDate: new Date(Date.now() - 72 * 86400000).toISOString(),
        unitsSold30d: 0,
        agingStatus: "DEAD_STOCK",
        clearanceRecommendation: "Dormant stock: 15% discount promo or return to distributor",
      },
      {
        productId: "demo-9",
        name: "White Sugar 1kg Loose Retail",
        sku: "GRA-SUG-1KG",
        barcode: "479000100001",
        categoryName: "Rice & Grains",
        unit: "kg",
        stockQuantity: 120,
        costPrice: 272,
        sellingPrice: 280,
        tiedUpCapital: 32640,
        potentialRevenue: 33600,
        unitMargin: 8,
        marginPercent: 2.9,
        daysSinceLastSale: 0,
        lastSoldDate: new Date().toISOString(),
        unitsSold30d: 210,
        agingStatus: "FAST_MOVING",
        clearanceRecommendation: "⚠️ Price-controlled thin margin staple: Monitor supplier price hikes closely",
      },
    ];

    let filtered = demoItems;
    if (filter === "dead_stock") {
      filtered = demoItems.filter((i) => i.agingStatus === "DEAD_STOCK");
    } else if (filter === "slow_moving") {
      filtered = demoItems.filter((i) => i.agingStatus === "SLOW_MOVING");
    } else if (filter === "fast_moving") {
      filtered = demoItems.filter((i) => i.agingStatus === "FAST_MOVING");
    } else if (filter === "loss_leaders") {
      filtered = demoItems.filter((i) => i.marginPercent < 5);
    }

    const totalVal = demoItems.reduce((sum, i) => sum + i.tiedUpCapital, 0);
    const deadCap = demoItems
      .filter((i) => i.agingStatus === "DEAD_STOCK")
      .reduce((sum, i) => sum + i.tiedUpCapital, 0);
    const slowCap = demoItems
      .filter((i) => i.agingStatus === "SLOW_MOVING")
      .reduce((sum, i) => sum + i.tiedUpCapital, 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: demoItems.length,
        totalInventoryValuation: totalVal,
        totalPotentialRevenue: demoItems.reduce((sum, i) => sum + i.potentialRevenue, 0),
        deadStockCapital: deadCap,
        deadStockCount: demoItems.filter((i) => i.agingStatus === "DEAD_STOCK").length,
        slowMovingCapital: slowCap,
        slowMovingCount: demoItems.filter((i) => i.agingStatus === "SLOW_MOVING").length,
        fastMovingCount: demoItems.filter((i) => i.agingStatus === "FAST_MOVING").length,
        moderateCount: demoItems.filter((i) => i.agingStatus === "MODERATE").length,
        healthScore: Math.round(100 - (deadCap / totalVal) * 100),
      },
      categoryBreakdown: [
        { categoryName: "Rice & Grains", productCount: 2, tiedUpCapital: 88890, potentialRevenue: 98850, deadStockCapital: 0, marginPercent: 10.1 },
        { categoryName: "Biscuits & Confectionery", productCount: 1, tiedUpCapital: 15600, potentialRevenue: 19200, deadStockCapital: 0, marginPercent: 18.8 },
        { categoryName: "Beverages & Tea", productCount: 1, tiedUpCapital: 18900, potentialRevenue: 25200, deadStockCapital: 0, marginPercent: 25.0 },
        { categoryName: "Ayurveda & Health", productCount: 1, tiedUpCapital: 8360, potentialRevenue: 12100, deadStockCapital: 0, marginPercent: 30.9 },
        { categoryName: "Seasonal & Festive", productCount: 1, tiedUpCapital: 15300, potentialRevenue: 23800, deadStockCapital: 15300, marginPercent: 35.7 },
        { categoryName: "Canned Foods", productCount: 1, tiedUpCapital: 21080, potentialRevenue: 28900, deadStockCapital: 21080, marginPercent: 27.1 },
      ],
      topMarginProducts: demoItems.filter((i) => i.marginPercent > 20).slice(0, 4),
      items: filtered,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inventory intelligence";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
