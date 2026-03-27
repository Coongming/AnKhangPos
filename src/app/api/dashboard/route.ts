import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDayVN, getEndOfDayVN } from '@/lib/utils';

export async function GET() {
  try {
    const today = getStartOfDayVN();
    const tomorrow = getEndOfDayVN();

    // Today's sales
    const todaySales = await prisma.sale.findMany({
      where: {
        saleDate: { gte: today, lt: tomorrow },
        status: 'completed',
      },
    });

    const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const todayOrders = todaySales.length;
    const todayCashRevenue = todaySales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
    const todayTransferRevenue = todaySales.filter(s => s.paymentMethod === 'transfer').reduce((sum, s) => sum + s.totalAmount, 0);

    // Debt totals
    const customerDebtAgg = await prisma.customer.aggregate({
      _sum: { debt: true },
      where: { debt: { gt: 0 } },
    });

    const supplierDebtAgg = await prisma.supplier.aggregate({
      _sum: { debt: true },
      where: { debt: { gt: 0 } },
    });

    // Counts
    const totalProducts = await prisma.product.count({ where: { isActive: true } });
    const totalCustomers = await prisma.customer.count({ where: { isActive: true } });
    const totalSuppliers = await prisma.supplier.count({ where: { isActive: true } });

    // Low stock products
    const lowStockProducts = await prisma.$queryRaw`
      SELECT id, name, stock, min_stock as "minStock", unit
      FROM products
      WHERE is_active = true AND stock <= min_stock AND min_stock > 0
      ORDER BY stock ASC
      LIMIT 10
    ` as Array<{ id: string; name: string; stock: number; minStock: number; unit: string }>;

    // Recent sales
    const recentSales = await prisma.sale.findMany({
      where: { status: 'completed' },
      orderBy: { saleDate: 'desc' },
      take: 5,
      include: { customer: { select: { name: true } } },
    });

    return NextResponse.json({
      todayRevenue,
      todayOrders,
      todayCashRevenue,
      todayTransferRevenue,
      totalCustomerDebt: customerDebtAgg._sum.debt || 0,
      totalSupplierDebt: supplierDebtAgg._sum.debt || 0,
      lowStockCount: lowStockProducts.length,
      totalProducts,
      totalCustomers,
      totalSuppliers,
      recentSales: recentSales.map((s) => ({
        id: s.id,
        code: s.code,
        totalAmount: s.totalAmount,
        saleDate: s.saleDate.toISOString(),
        customerName: s.customer?.name || null,
      })),
      lowStockProducts,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Lỗi tải dữ liệu' }, { status: 500 });
  }
}
