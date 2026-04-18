import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Stock movements + current stock
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId') || '';
    const type = searchParams.get('type') || ''; // purchase, sale, adjustment, etc.

    if (productId) {
      // Get movements for a specific product
      const where: Record<string, unknown> = { productId };
      if (type) where.type = type;

      const [movements, product] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          include: { product: { select: { name: true, code: true, unit: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        }),
      ]);

      // Tính lại stockAfter động từ tồn kho hiện tại
      // Đi từ mới→cũ: stockAfter[0] = currentStock, stockAfter[i] = stockAfter[i-1] - qty[i-1]
      if (product) {
        let runningStock = product.stock;
        for (const m of movements) {
          m.stockAfter = runningStock;
          runningStock -= m.quantity;
        }
      }

      return NextResponse.json(movements);
    }

    // Get all products with stock info
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true, code: true, name: true, unit: true,
        stock: true, minStock: true, costPrice: true, salePrice: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error('Stock GET error:', error);
    return NextResponse.json({ error: 'Lỗi tải tồn kho' }, { status: 500 });
  }
}

// POST - Stock adjustment (kiểm kê)
export async function POST(request: NextRequest) {
  try {
    const { productId, actualStock, notes } = await request.json();
    if (!productId || actualStock === undefined) {
      return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
    }

    const actual = parseFloat(actualStock);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: 'Sản phẩm không tồn tại' }, { status: 404 });

    const diff = actual - product.stock;
    if (diff === 0) return NextResponse.json({ message: 'Không có thay đổi' });

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stock: actual },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          type: 'adjustment',
          quantity: diff,
          stockAfter: actual,
          notes: notes || `Điều chỉnh kiểm kê: ${product.stock} → ${actual}`,
        },
      });
    });

    return NextResponse.json({ success: true, diff });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    return NextResponse.json({ error: 'Lỗi điều chỉnh tồn kho' }, { status: 500 });
  }
}
