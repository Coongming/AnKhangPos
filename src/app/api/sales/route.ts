import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/utils';

// GET - List sales
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || '';
    const status = searchParams.get('status') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const where: Record<string, unknown> = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) (where.saleDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        (where.saleDate as Record<string, unknown>).lt = to;
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: { select: { name: true, code: true } },
        items: { include: { product: { select: { name: true, code: true, unit: true } } } },
      },
      orderBy: { saleDate: 'desc' },
    });
    return NextResponse.json(sales);
  } catch (error) {
    console.error('Sales GET error:', error);
    return NextResponse.json({ error: 'Lỗi tải hóa đơn' }, { status: 500 });
  }
}

// POST - Create sale (TRANSACTION: create sale + deduct stock + record debt)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, items, paidAmount, discount, notes, paymentMethod } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Vui lòng thêm sản phẩm vào đơn hàng' }, { status: 400 });
    }

    // Generate sale code
    const lastSale = await prisma.sale.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const code = generateCode('HD', lastSale?.code || null);

    // Check system setting for negative stock
    const allowNegStock = await prisma.systemSetting.findUnique({
      where: { key: 'allow_negative_stock' },
    });
    const allowNegative = allowNegStock?.value === 'true';

    const sale = await prisma.$transaction(async (tx) => {
      // Pre-check stock
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Sản phẩm không tồn tại`);
        if (!product.isActive) throw new Error(`Sản phẩm "${product.name}" đã ngừng bán`);
        if (!allowNegative && product.stock < parseFloat(item.quantity)) {
          throw new Error(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock} ${product.unit})`);
        }
      }

      // Calculate totals
      let subtotal = 0;
      let totalCost = 0;
      const processedItems = [];

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const price = parseFloat(item.unitPrice);
        const itemDiscount = parseFloat(item.discount) || 0;
        const lineTotal = qty * price - itemDiscount;
        const product = await tx.product.findUnique({ where: { id: item.productId } });

        subtotal += lineTotal;
        totalCost += qty * (product?.costPrice || 0);
        processedItems.push({
          productId: item.productId,
          quantity: qty,
          unitPrice: price,
          costPrice: product?.costPrice || 0,
          discount: itemDiscount,
          totalPrice: lineTotal,
        });
      }

      const orderDiscount = parseFloat(discount) || 0;
      const totalAmount = subtotal - orderDiscount;
      const paid = parseFloat(paidAmount) || 0;
      const debtAmount = Math.max(0, totalAmount - paid);

      // Debt requires customer
      if (debtAmount > 0 && !customerId) {
        throw new Error('Bán nợ phải chọn khách hàng có hồ sơ');
      }

      // 1. Create sale
      const newSale = await tx.sale.create({
        data: {
          code,
          customerId: customerId || null,
          subtotal,
          discount: orderDiscount,
          totalAmount,
          totalCost,
          paidAmount: paid,
          debtAmount,
          notes: notes || null,
          paymentMethod: paymentMethod || 'cash',
        },
      });

      // 2. Create sale items + deduct stock
      for (const item of processedItems) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            ...item,
          },
        });

        // Deduct stock
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        // Stock movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'sale',
            quantity: -item.quantity,
            stockAfter: product.stock - item.quantity,
            referenceId: newSale.id,
            notes: `Bán hàng - ${code}`,
          },
        });
      }

      // 3. Customer debt
      if (debtAmount > 0 && customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new Error('Khách hàng không tồn tại');

        await tx.customer.update({
          where: { id: customerId },
          data: { debt: { increment: debtAmount } },
        });

        await tx.debtTransaction.create({
          data: {
            type: 'customer_debt',
            customerId,
            saleId: newSale.id,
            amount: debtAmount,
            balanceAfter: customer.debt + debtAmount,
            notes: `Công nợ hóa đơn ${code}`,
          },
        });
      }

      return newSale;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Sales POST error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi tạo hóa đơn';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - Cancel sale (reverse everything)
export async function PUT(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) return NextResponse.json({ error: 'Không tìm thấy hóa đơn' }, { status: 404 });
    if (sale.status === 'cancelled') return NextResponse.json({ error: 'Hóa đơn đã bị hủy' }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // 1. Mark as cancelled
      await tx.sale.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      // 2. Restore stock
      for (const item of sale.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'sale_cancel',
            quantity: item.quantity,
            stockAfter: product.stock + item.quantity,
            referenceId: id,
            notes: `Hủy hóa đơn - ${sale.code}`,
          },
        });
      }

      // 3. Reverse customer debt
      if (sale.debtAmount > 0 && sale.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
        if (customer) {
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { debt: { decrement: sale.debtAmount } },
          });

          await tx.debtTransaction.create({
            data: {
              type: 'customer_payment',
              customerId: sale.customerId,
              saleId: id,
              amount: -sale.debtAmount,
              balanceAfter: customer.debt - sale.debtAmount,
              notes: `Hủy hóa đơn ${sale.code} - hoàn nợ`,
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel sale error:', error);
    return NextResponse.json({ error: 'Lỗi hủy hóa đơn' }, { status: 500 });
  }
}
