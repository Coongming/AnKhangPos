import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
const COOKIE_NAME = 'ankhang-session';

// Các route KHÔNG cần đăng nhập
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cho phép truy cập public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Cho phép static files (_next, favicon, etc.)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg')
  ) {
    return NextResponse.next();
  }

  // Kiểm tra session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API → trả 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }
    // Page → redirect về login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Xác thực token
  try {
    await jwtVerify(token, SECRET);
    
    // Nếu đã đăng nhập mà vào /login → redirect về trang chủ
    if (pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    return NextResponse.next();
  } catch {
    // Token hết hạn hoặc không hợp lệ
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Phiên đăng nhập hết hạn' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    
    // Xóa cookie hỏng
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    // Match tất cả trừ static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
