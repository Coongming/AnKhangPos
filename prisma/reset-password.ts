import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'ankhangbmt';

async function main() {
  console.log('🔑 Reset mật khẩu admin...');

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: hashedPassword, isActive: true },
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
    },
  });

  console.log(`✅ Đã reset mật khẩu cho tài khoản: ${user.username}`);
  console.log(`   Mật khẩu mới: ${DEFAULT_PASSWORD}`);
  console.log('');
  console.log('⚠️  Hãy đổi mật khẩu ngay sau khi đăng nhập!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
