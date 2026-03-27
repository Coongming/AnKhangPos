import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'An Khang - Quản lý bán hàng',
  description: 'Ứng dụng quản lý bán hàng cho cửa hàng gạo & nước An Khang',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <ToastProvider>
          <div className="app-layout">
            <Sidebar />
            <main className="main-content">
              <div className="main-body">
                {children}
              </div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
