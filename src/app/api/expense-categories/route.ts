import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error('Expense categories error:', error);
    return NextResponse.json({ error: 'Lỗi' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Vui lòng nhập tên danh mục' }, { status: 400 });
    const category = await prisma.expenseCategory.create({ data: { name } });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Expense categories POST error:', error);
    return NextResponse.json({ error: 'Lỗi tạo danh mục' }, { status: 500 });
  }
}
