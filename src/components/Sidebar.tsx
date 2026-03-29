'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  ClipboardList,
  ShoppingCart,
  Receipt,
  Wallet,
  DollarSign,
  Warehouse,
  BarChart3,
  TrendingUp,
  FileText,
  PackageSearch,
  Settings,
  Database,
  History,
  Beaker,
} from 'lucide-react';

const navGroups = [
  {
    title: 'Tổng quan',
    items: [
      { label: 'Bảng điều khiển', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Danh mục',
    items: [
      { label: 'Sản phẩm', href: '/san-pham', icon: Package },
      { label: 'Nhà cung cấp', href: '/nha-cung-cap', icon: Truck },
      { label: 'Khách hàng', href: '/khach-hang', icon: Users },
      { label: 'Nhân viên', href: '/nhan-vien', icon: Users },
      { label: 'Danh mục chi phí', href: '/danh-muc-chi-phi', icon: ClipboardList },
    ],
  },
  {
    title: 'Nghiệp vụ',
    items: [
      { label: 'Bán hàng', href: '/ban-hang', icon: ShoppingCart },
      { label: 'Lịch sử bán hàng', href: '/lich-su-ban-hang', icon: Receipt },
      { label: 'Nhập hàng', href: '/nhap-hang', icon: ClipboardList },
      { label: 'Công nợ', href: '/cong-no', icon: Wallet },
      { label: 'Chi phí', href: '/chi-phi', icon: DollarSign },
      { label: 'Trộn gạo', href: '/tron-gao', icon: Beaker },
      { label: 'Tồn kho', href: '/ton-kho', icon: Warehouse },
    ],
  },
  {
    title: 'Báo cáo',
    items: [
      { label: 'Doanh thu', href: '/bao-cao/doanh-thu', icon: BarChart3 },
      { label: 'Lợi nhuận', href: '/bao-cao/loi-nhuan', icon: TrendingUp },
      { label: 'Công nợ', href: '/bao-cao/cong-no', icon: FileText },
      { label: 'Tồn kho', href: '/bao-cao/ton-kho', icon: PackageSearch },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { label: 'Cài đặt', href: '/he-thong/cai-dat', icon: Settings },
      { label: 'Sao lưu', href: '/he-thong/backup', icon: Database },
      { label: 'Nhật ký', href: '/he-thong/nhat-ky', icon: History },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">AK</div>
        <div>
          <h1>An Khang</h1>
          <p>Quản lý bán hàng</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <div className="nav-group-title">{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
