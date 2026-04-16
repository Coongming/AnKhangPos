import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/utils';

// GET - List blend history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { outputProduct: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const blends = await prisma.blendHistory.findMany({
      where,
      include: {
        outputProduct: { select: { name: true, code: true, unit: true } },
        items: {
          include: {
            product: { select: { name: true, code: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(blends);
  } catch (error) {
    console.error('Blend GET error:', error);
    return NextResponse.json({ error: 'Lỗi tải lịch sử trộn' }, { status: 500 });
  }
}

// POST - Create blend (TRANSACTION: deduct inputs + add output + record stock movements)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, outputProductId, newProduct, notes } = body;

    // Validate: 2-5 items
    if (!items || items.length < 2 || items.length > 5) {
      return NextResponse.json({ error: 'Cần 2-5 loại nguyên liệu để trộn' }, { status: 400 });
    }

    // Generate blend code
    const lastBlend = await prisma.blendHistory.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const code = generateCode('TR', lastBlend?.code || null);

    const blend = await prisma.$transaction(async (tx) => {
      // 1. Validate stock & calculate cost
      let totalCost = 0;
      let totalQuantity = 0;
      const processedItems = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error('Sản phẩm nguyên liệu không tồn tại');
        if (product.stock < parseFloat(item.quantity)) {
          throw new Error(`"${product.name}" không đủ tồn kho (còn ${product.stock} ${product.unit})`);
        }
        const qty = parseFloat(item.quantity);
        totalCost += qty * product.costPrice;
        totalQuantity += qty;
        processedItems.push({
          productId: item.productId,
          quantity: qty,
          costPrice: product.costPrice,
          productName: product.name,
          currentStock: product.stock,
        });
      }

      const outputCostPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      // 2. Create or get output product
      let actualOutputProductId = outputProductId;

      if (newProduct) {
        // Create new product
        const lastProduct = await tx.product.findFirst({
          orderBy: { code: 'desc' },
          select: { code: true },
        });
        const productCode = generateCode('SP', lastProduct?.code || null);

        const created = await tx.product.create({
          data: {
            code: productCode,
            name: newProduct.name,
            categoryId: newProduct.categoryId,
            unit: newProduct.unit || 'kg',
            salePrice: parseFloat(newProduct.salePrice) || 0,
            costPrice: outputCostPrice,
            stock: 0,
          },
        });
        actualOutputProductId = created.id;
      }

      if (!actualOutputProductId) throw new Error('Chưa chọn sản phẩm đầu ra');

      // 3. Create blend history
      const newBlend = await tx.blendHistory.create({
        data: {
          code,
          outputProductId: actualOutputProductId,
          outputQuantity: totalQuantity,
          outputCostPrice,
          notes: notes || null,
        },
      });

      // 4. Create blend items + deduct stock
      for (const item of processedItems) {
        await tx.blendHistoryItem.create({
          data: {
            blendId: newBlend.id,
            productId: item.productId,
            quantity: item.quantity,
            costPrice: item.costPrice,
          },
        });

        // Deduct input stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'blend_out',
            quantity: -item.quantity,
            stockAfter: item.currentStock - item.quantity,
            referenceId: newBlend.id,
            notes: `Trộn gạo - ${code} (nguyên liệu)`,
          },
        });
      }

      // 5. Add output stock + update cost price (simple average)
      const outputProduct = await tx.product.findUnique({ where: { id: actualOutputProductId } });
      if (!outputProduct) throw new Error('Sản phẩm đầu ra không tồn tại');

      // Giá vốn = bình quân đơn giản từ tất cả phiếu nhập + giá trộn hiện tại
      const allPurchaseItems = await tx.purchaseItem.findMany({
        where: { productId: actualOutputProductId, purchase: { status: 'completed' } },
      });
      const purchaseQty = allPurchaseItems.reduce((s, i) => s + i.quantity, 0);
      const purchaseValue = allPurchaseItems.reduce((s, i) => s + i.totalPrice, 0);
      const combinedQty = purchaseQty + totalQuantity;
      const combinedValue = purchaseValue + totalCost;
      const newCost = combinedQty > 0 ? combinedValue / combinedQty : outputCostPrice;

      await tx.product.update({
        where: { id: actualOutputProductId },
        data: {
          stock: { increment: totalQuantity },
          costPrice: newCost,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: actualOutputProductId,
          type: 'blend_in',
          quantity: totalQuantity,
          stockAfter: outputProduct.stock + totalQuantity,
          referenceId: newBlend.id,
          notes: `Trộn gạo - ${code} (sản phẩm ra)`,
        },
      });

      return newBlend;
    });

    return NextResponse.json(blend, { status: 201 });
  } catch (error) {
    console.error('Blend POST error:', error);
    const message = error instanceof Error ? error.message : 'Lỗi trộn gạo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete blend record (reverse stock)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Thiếu ID' }, { status: 400 });

    const blend = await prisma.blendHistory.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!blend) return NextResponse.json({ error: 'Không tìm thấy phiếu trộn' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Reverse: add back inputs, deduct output
      for (const item of blend.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.product.update({
        where: { id: blend.outputProductId },
        data: { stock: { decrement: blend.outputQuantity } },
      });

      // Clean up
      await tx.stockMovement.deleteMany({ where: { referenceId: id } });
      await tx.blendHistoryItem.deleteMany({ where: { blendId: id } });
      await tx.blendHistory.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Blend DELETE error:', error);
    return NextResponse.json({ error: 'Lỗi xóa phiếu trộn' }, { status: 500 });
  }
}
