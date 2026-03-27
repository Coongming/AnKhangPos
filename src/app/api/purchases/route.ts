import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCode, calculateWeightedAvgCost } from '@/lib/utils';

// GET - List purchases
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId') || '';
    const where: Record<string, unknown> = {};
    if (supplierId) where.supplierId = supplierId;

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: { select: { name: true, code: true } },
        items: { include: { product: { select: { name: true, code: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(purchases);
  } catch (error) {
    console.error('Purchases GET error:', error);
    return NextResponse.json({ error: 'Lỗi tải phiếu nhập' }, { status: 500 });
  }
}

// POST - Create purchase (TRANSACTION: create purchase + update stock + update cost + create debt)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, items, paidAmount, notes, purchaseDate } = body;

    if (!supplierId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Vui lòng chọn nhà cung cấp và thêm sản phẩm' }, { status: 400 });
    }

    // Generate purchase code
    const lastPurchase = await prisma.purchase.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const code = generateCode('PN', lastPurchase?.code || null);

    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );
    const paid = parseFloat(paidAmount) || 0;
    const debtAmount = totalAmount - paid;

    // Execute everything in a single transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // 1. Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          code,
          supplierId,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          totalAmount,
          paidAmount: paid,
          debtAmount: Math.max(0, debtAmount),
          notes: notes || null,
        },
      });

      // 2. Create purchase items + update product stock & cost
      for (const item of items) {
        const { productId, quantity, unitPrice } = item;
        const qty = parseFloat(quantity);
        const price = parseFloat(unitPrice);

        // Create purchase item
        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            productId,
            quantity: qty,
            unitPrice: price,
            totalPrice: qty * price,
          },
        });

        // Get current product
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error(`Sản phẩm không tồn tại: ${productId}`);

        // Calculate weighted average cost
        const newCostPrice = calculateWeightedAvgCost(
          product.stock,
          product.costPrice,
          qty,
          price
        );

        // Update product stock, cost, last purchase price
        await tx.product.update({
          where: { id: productId },
          data: {
            stock: { increment: qty },
            costPrice: newCostPrice,
            lastPurchasePrice: price,
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId,
            type: 'purchase',
            quantity: qty,
            stockAfter: product.stock + qty,
            referenceId: newPurchase.id,
            notes: `Nhập hàng - ${code}`,
          },
        });
      }

      // 3. Update supplier debt if there's remaining debt
      if (debtAmount > 0) {
        const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) throw new Error('Nhà cung cấp không tồn tại');

        await tx.supplier.update({
          where: { id: supplierId },
          data: { debt: { increment: debtAmount } },
        });

        // Record debt transaction
        await tx.debtTransaction.create({
          data: {
            type: 'supplier_debt',
            supplierId,
            purchaseId: newPurchase.id,
            amount: debtAmount,
            balanceAfter: supplier.debt + debtAmount,
            notes: `Công nợ phiếu nhập ${code}`,
          },
        });
      }

      return newPurchase;
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error('Purchases POST error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi tạo phiếu nhập';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Cancel purchase
export async function PUT(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!purchase) return NextResponse.json({ error: 'Không tìm thấy phiếu nhập' }, { status: 404 });
    if (purchase.status === 'cancelled') return NextResponse.json({ error: 'Phiếu đã bị hủy' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // 1. Mark as cancelled
      await tx.purchase.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // 2. Reverse stock for each item
      for (const item of purchase.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'purchase_cancel',
            quantity: -item.quantity,
            stockAfter: product.stock - item.quantity,
            referenceId: id,
            notes: `Hủy phiếu nhập - ${purchase.code}`,
          },
        });
      }

      // 3. Reverse supplier debt
      if (purchase.debtAmount > 0) {
        const supplier = await tx.supplier.findUnique({ where: { id: purchase.supplierId } });
        if (supplier) {
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: { debt: { decrement: purchase.debtAmount } },
          });

          await tx.debtTransaction.create({
            data: {
              type: 'supplier_payment',
              supplierId: purchase.supplierId,
              purchaseId: id,
              amount: -purchase.debtAmount,
              balanceAfter: supplier.debt - purchase.debtAmount,
              notes: `Hủy phiếu nhập ${purchase.code} - hoàn nợ`,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel purchase error:', error);
    return NextResponse.json({ error: 'Lỗi hủy phiếu nhập' }, { status: 500 });
  }
}
