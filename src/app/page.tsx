'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Package,
  Users,
  Truck,
  ArrowUp,
  ArrowDown,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface DashboardData {
  todayRevenue: number;
  todayOrders: number;
  todayCashRevenue: number;
  todayTransferRevenue: number;
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  lowStockCount: number;
  totalProducts: number;
  totalCustomers: number;
  totalSuppliers: number;
  recentSales: Array<{
    id: string;
    code: string;
    totalAmount: number;
    saleDate: string;
    customerName: string | null;
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    stock: number;
    minStock: number;
    unit: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!data) {
    return <div>Không thể tải dữ liệu</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>
          Bảng điều khiển
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Tổng quan hoạt động kinh doanh hôm nay
        </p>
      </div>

      {/* Stat Cards */}
      <div className="card-grid card-grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon accent">
            <TrendingUp size={22} />
          </div>
          <div className="stat-content">
            <h3>Doanh thu hôm nay</h3>
            <div className="stat-value">{formatCurrency(data.todayRevenue)}</div>
            <div className="stat-sub">{data.todayOrders} đơn hàng</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon info">
            <Banknote size={22} />
          </div>
          <div className="stat-content">
            <h3>Tiền mặt hôm nay</h3>
            <div className="stat-value">{formatCurrency(data.todayCashRevenue)}</div>
            <div className="stat-sub">💵 Cash</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon accent">
            <CreditCard size={22} />
          </div>
          <div className="stat-content">
            <h3>Chuyển khoản hôm nay</h3>
            <div className="stat-value">{formatCurrency(data.todayTransferRevenue)}</div>
            <div className="stat-sub">🏦 Transfer</div>
          </div>
        </div>
      </div>

      <div className="card-grid card-grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon warning">
            <Wallet size={22} />
          </div>
          <div className="stat-content">
            <h3>Khách nợ</h3>
            <div className="stat-value text-warning">{formatCurrency(data.totalCustomerDebt)}</div>
            <div className="stat-sub">
              <ArrowDown size={12} style={{ display: 'inline' }} /> Phải thu
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon danger">
            <Wallet size={22} />
          </div>
          <div className="stat-content">
            <h3>Nợ nhà cung cấp</h3>
            <div className="stat-value text-danger">{formatCurrency(data.totalSupplierDebt)}</div>
            <div className="stat-sub">
              <ArrowUp size={12} style={{ display: 'inline' }} /> Phải trả
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: data.lowStockCount > 0 ? 'var(--danger-bg)' : 'var(--success-bg)', color: data.lowStockCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="stat-content">
            <h3>Sắp hết hàng</h3>
            <div className="stat-value" style={{ color: data.lowStockCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {data.lowStockCount} sản phẩm
            </div>
            <div className="stat-sub">Cần nhập thêm</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="card-grid card-grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon info">
            <Package size={22} />
          </div>
          <div className="stat-content">
            <h3>Tổng sản phẩm</h3>
            <div className="stat-value">{formatNumber(data.totalProducts)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">
            <Users size={22} />
          </div>
          <div className="stat-content">
            <h3>Khách hàng</h3>
            <div className="stat-value">{formatNumber(data.totalCustomers)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon accent">
            <Truck size={22} />
          </div>
          <div className="stat-content">
            <h3>Nhà cung cấp</h3>
            <div className="stat-value">{formatNumber(data.totalSuppliers)}</div>
          </div>
        </div>
      </div>

      {/* Two columns: Recent Sales + Low Stock */}
      <div className="card-grid card-grid-2">
        {/* Recent Sales */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <ShoppingCart size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: -2 }} />
              Đơn hàng gần đây
            </h3>
          </div>
          {data.recentSales.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart />
              <h3>Chưa có đơn hàng</h3>
              <p>Bắt đầu bán hàng ngay!</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Khách</th>
                    <th className="text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontWeight: 600 }}>{sale.code}</td>
                      <td>{sale.customerName || 'Khách lẻ'}</td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        {formatCurrency(sale.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Warning */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: -2, color: 'var(--warning)' }} />
              Cảnh báo tồn kho
            </h3>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <div className="empty-state">
              <Package />
              <h3>Tồn kho ổn</h3>
              <p>Không có sản phẩm nào sắp hết</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="text-right">Tồn kho</th>
                    <th className="text-right">Tối thiểu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStockProducts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="text-right text-danger" style={{ fontWeight: 600 }}>
                        {formatNumber(p.stock)} {p.unit}
                      </td>
                      <td className="text-right text-muted">
                        {formatNumber(p.minStock)} {p.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
