import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/utils';

// GET - List products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json({ error: 'Lỗi tải danh sách sản phẩm' }, { status: 500 });
  }
}

// POST - Create product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, categoryId, unit, specification, salePrice, minStock, barcode } = body;

    if (!name || !categoryId || !unit) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ thông tin' }, { status: 400 });
    }

    // Generate code
    const lastProduct = await prisma.product.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const code = generateCode('SP', lastProduct?.code || null);

    const product = await prisma.product.create({
      data: {
        code,
        name,
        categoryId,
        unit,
        specification: specification || null,
        salePrice: parseFloat(salePrice) || 0,
        minStock: parseFloat(minStock) || 0,
        barcode: barcode || null,
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Products POST error:', error);
    return NextResponse.json({ error: 'Lỗi tạo sản phẩm' }, { status: 500 });
  }
}

// PUT - Update product
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, categoryId, unit, specification, salePrice, minStock, barcode, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'Thiếu ID sản phẩm' }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(categoryId !== undefined && { categoryId }),
        ...(unit !== undefined && { unit }),
        ...(specification !== undefined && { specification }),
        ...(salePrice !== undefined && { salePrice: parseFloat(salePrice) }),
        ...(minStock !== undefined && { minStock: parseFloat(minStock) }),
        ...(barcode !== undefined && { barcode }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Products PUT error:', error);
    return NextResponse.json({ error: 'Lỗi cập nhật sản phẩm' }, { status: 500 });
  }
}
