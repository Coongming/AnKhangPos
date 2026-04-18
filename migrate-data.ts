import { PrismaClient } from '@prisma/client';

// Neon (source)
const neon = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://neondb_owner:npg_uWGX7zLV2ErR@ep-billowing-block-a1hlzec3-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' },
  },
});

// Supabase (target) - uses DATABASE_URL from .env via directUrl
const supabase = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres.mknoguoyuszjyjyvhqls:p0QKnGrxHpx66lla@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' },
  },
});

async function migrate() {
  console.log('🔄 Bắt đầu chuyển data từ Neon → Supabase...\n');

  // Thứ tự quan trọng: bảng cha trước, bảng con sau
  const tables = [
    { name: 'ProductCategory', model: 'productCategory' },
    { name: 'Product', model: 'product' },
    { name: 'Supplier', model: 'supplier' },
    { name: 'Customer', model: 'customer' },
    { name: 'Employee', model: 'employee' },
    { name: 'ExpenseCategory', model: 'expenseCategory' },
    { name: 'Purchase', model: 'purchase' },
    { name: 'PurchaseItem', model: 'purchaseItem' },
    { name: 'Sale', model: 'sale' },
    { name: 'SaleItem', model: 'saleItem' },
    { name: 'DebtTransaction', model: 'debtTransaction' },
    { name: 'StockMovement', model: 'stockMovement' },
    { name: 'Expense', model: 'expense' },
    { name: 'BackupLog', model: 'backupLog' },
    { name: 'BlendHistory', model: 'blendHistory' },
    { name: 'BlendHistoryItem', model: 'blendHistoryItem' },
    { name: 'BlendTemplate', model: 'blendTemplate' },
    { name: 'BlendTemplateItem', model: 'blendTemplateItem' },
    { name: 'EmployeeShift', model: 'employeeShift' },
    { name: 'SalaryPayment', model: 'salaryPayment' },
    { name: 'SystemSetting', model: 'systemSetting' },
  ];

  for (const table of tables) {
    try {
      // @ts-ignore - dynamic model access
      const data = await neon[table.model].findMany();
      if (data.length === 0) {
        console.log(`  ⏭️  ${table.name}: trống`);
        continue;
      }

      // Insert từng batch 50 records
      let inserted = 0;
      for (let i = 0; i < data.length; i += 50) {
        const batch = data.slice(i, i + 50);
        for (const record of batch) {
          try {
            // @ts-ignore
            await supabase[table.model].create({ data: record });
            inserted++;
          } catch (e: any) {
            if (e.code === 'P2002') {
              // Duplicate - skip
            } else {
              console.error(`    ❌ Lỗi ${table.name} record ${record.id}: ${e.message}`);
            }
          }
        }
      }
      console.log(`  ✅ ${table.name}: ${inserted}/${data.length} records`);
    } catch (e: any) {
      console.error(`  ❌ ${table.name}: ${e.message}`);
    }
  }

  console.log('\n✅ Hoàn tất chuyển data!');
}

migrate()
  .catch(console.error)
  .finally(async () => {
    await neon.$disconnect();
    await supabase.$disconnect();
  });
