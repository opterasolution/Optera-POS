import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Customer, generatePortalToken, generateReferralCode } from "@/models/Customer";
import { Sale } from "@/models/Sale";
import { requireAuth } from "@/lib/tenant";
import { customerSchema } from "@/lib/validations/customer";
import { normalizeSLPhone } from "@/lib/formatters";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      const customer = await Customer.findOne({
        _id: params.id,
        businessId: context.businessId,
      });

      if (!customer) {
        return NextResponse.json({ success: false, error: "Customer not found." }, { status: 404 });
      }

      let shouldSave = false;
      if (!customer.portalToken) {
        customer.portalToken = generatePortalToken();
        shouldSave = true;
      }
      if (!customer.referralCode) {
        customer.referralCode = generateReferralCode();
        shouldSave = true;
      }
      if (!customer.vipCardIssuedAt) {
        customer.vipCardIssuedAt = new Date();
        shouldSave = true;
      }
      if (shouldSave) {
        await customer.save();
      }

      // Fetch customer purchase history
      const purchases = await Sale.find({
        businessId: context.businessId,
        $or: [{ customerId: customer._id }, { customerPhone: customer.phone }],
        status: "COMPLETED",
      }).sort({ createdAt: -1 });

      return NextResponse.json({ success: true, customer, purchases });
    }

    // Demo Data
    return NextResponse.json({
      success: true,
      customer: {
        _id: params.id,
        name: "Sunil Perera",
        phone: "0771234567",
        email: "sunil.perera@gmail.com",
        address: "Peradeniya Road, Kandy",
        totalSpent: 12450,
        visitCount: 6,
      },
      purchases: [
        {
          _id: "demo_p1",
          invoiceNumber: "INV-2026-0034",
          netTotal: 1850,
          paymentMethod: "CASH",
          createdAt: new Date().toISOString(),
          items: [{ name: "Keeri Samba Rice 5kg", quantity: 1, total: 1450 }],
        },
      ],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load customer profile";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();
    const body = await req.json();

    const parsed = customerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      phone,
      email,
      address,
      notes,
      creditAllowed,
      creditLimit,
      nicNumber,
      dateOfBirth,
      anniversaryDate,
      loyaltyTier,
      referralCode,
      referredByCode,
    } = parsed.data;
    const normalizedPhone = normalizeSLPhone(phone);

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();

      // Check phone uniqueness
      const duplicate = await Customer.findOne({
        businessId: context.businessId,
        phone: normalizedPhone,
        _id: { $ne: params.id },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Phone number "${normalizedPhone}" already belongs to another customer.` },
          { status: 409 }
        );
      }

      const updateFields: any = {
        name,
        phone: normalizedPhone,
        email,
        address,
        notes,
        creditAllowed: Boolean(creditAllowed),
        creditLimit: Number(creditLimit) || 0,
        nicNumber: nicNumber?.trim() || undefined,
      };

      if (dateOfBirth !== undefined) {
        updateFields.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      }
      if (anniversaryDate !== undefined) {
        updateFields.anniversaryDate = anniversaryDate ? new Date(anniversaryDate) : null;
      }
      if (loyaltyTier) {
        updateFields.loyaltyTier = loyaltyTier;
      }
      if (referralCode) {
        updateFields.referralCode = referralCode.trim().toUpperCase();
      }
      if (referredByCode) {
        const refCust = await Customer.findOne({
          businessId: context.businessId,
          _id: { $ne: params.id },
          $or: [
            { referralCode: referredByCode.trim().toUpperCase() },
            { phone: normalizeSLPhone(referredByCode.trim()) },
          ],
        });
        if (refCust) {
          updateFields.referredBy = refCust._id;
        }
      }

      const updated = await Customer.findOneAndUpdate(
        { _id: params.id, businessId: context.businessId },
        { $set: updateFields },
        { new: true }
      );

      return NextResponse.json({ success: true, customer: updated });
    }

    return NextResponse.json({
      success: true,
      customer: {
        _id: params.id,
        name,
        phone: normalizedPhone,
        email,
        address,
        notes,
        creditAllowed: Boolean(creditAllowed),
        creditLimit: Number(creditLimit) || 0,
        nicNumber,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update customer";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const context = await requireAuth();

    if (Boolean(process.env.MONGODB_URI)) {
      await connectToDatabase();
      await Customer.findOneAndDelete({
        _id: params.id,
        businessId: context.businessId,
      });
      return NextResponse.json({ success: true, message: "Customer removed." });
    }

    return NextResponse.json({ success: true, message: "Customer removed (Demo)." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete customer";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
