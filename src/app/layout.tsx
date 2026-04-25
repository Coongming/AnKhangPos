import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/Toast';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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
          <AppShell>
            {children}
          </AppShell>
        </ToastProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('wheel', function(e) {
                if (document.activeElement && document.activeElement.type === 'number') {
                  document.activeElement.blur();
                }
              }, { passive: true });
            `,
          }}
        />
      </body>
    </html>
  );
}
