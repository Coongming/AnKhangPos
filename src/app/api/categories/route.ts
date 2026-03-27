import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Categories error:', error);
    return NextResponse.json({ error: 'Lỗi tải nhóm sản phẩm' }, { status: 500 });
  }
}
