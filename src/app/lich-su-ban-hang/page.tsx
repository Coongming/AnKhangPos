'use client';

import { useEffect, useState, useCallback } from 'react';
import { Receipt, Eye, XCircle, Search } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

interface Sale {
  id: string; code: string; saleDate: string; subtotal: number; discount: number;
  totalAmount: number; paidAmount: number; debtAmount: number; status: string; notes: string | null;
  paymentMethod: string;
  customer: { name: string; code: string } | null;
  items: Array<{ quantity: number; unitPrice: number; discount: number; totalPrice: number; product: { name: string; unit: string } }>;
}

export default function SalesHistoryPage() {
  const { showToast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (statusFilter) params.set('status', statusFilter);
      if (paymentMethodFilter) params.set('paymentMethod', paymentMethodFilter);
      const res = await fetch(`/api/sales?${params}`);
      setSales(await res.json());
    } catch { showToast('error', 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, statusFilter, paymentMethodFilter, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancel = async (sale: Sale) => {
    if (!confirm(`Hủy hóa đơn ${sale.code}? Tồn kho và công nợ sẽ được hoàn nguyên.`)) return;
    try {
      const res = await fetch('/api/sales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sale.id, action: 'cancel' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã hủy hóa đơn');
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  const totalRevenue = sales.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.totalAmount, 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)' }}>Lịch sử bán hàng</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sales.length} hóa đơn • Tổng: {formatCurrency(totalRevenue)}</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <input className="form-input" type="date" style={{ width: 150 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-muted">đến</span>
          <input className="form-input" type="date" style={{ width: 150 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select className="form-select" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="completed">Hoàn thành</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <select className="form-select" style={{ width: 160 }} value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}>
            <option value="">Tất cả PT thanh toán</option>
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
          </select>
        </div>
      </div>

      {loading ? <div className="loading-page"><div className="loading-spinner" /></div> : sales.length === 0 ? (
        <div className="card"><div className="empty-state"><Receipt /><h3>Chưa có hóa đơn</h3></div></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Mã</th><th>Ngày</th><th>Khách hàng</th><th>Thanh toán</th><th className="text-right">Tổng tiền</th><th className="text-right">Đã trả</th><th className="text-right">Còn nợ</th><th>Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ opacity: s.status === 'cancelled' ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setViewSale(s)}>{s.code}</td>
                  <td>{formatDate(s.saleDate)}</td>
                  <td>{s.customer?.name || 'Khách lẻ'}</td>
                  <td><span className={`badge ${s.paymentMethod === 'cash' ? 'badge-info' : 'badge-accent'}`}>{s.paymentMethod === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}</span></td>
                  <td className="text-right font-bold">{formatCurrency(s.totalAmount)}</td>
                  <td className="text-right text-success">{formatCurrency(s.paidAmount)}</td>
                  <td className="text-right" style={{ color: s.debtAmount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: s.debtAmount > 0 ? 700 : 400 }}>{formatCurrency(s.debtAmount)}</td>
                  <td><span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{s.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}</span></td>
                  <td className="text-center">
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewSale(s)}><Eye size={14} /></button>
                      {s.status === 'completed' && <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleCancel(s)}><XCircle size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewSale && (
        <div className="modal-overlay" onClick={() => setViewSale(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Hóa đơn {viewSale.code}</h3><button className="modal-close" onClick={() => setViewSale(null)}>✕</button></div>
            <div className="modal-body">
              <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                <div><span className="text-muted">Khách:</span> <strong>{viewSale.customer?.name || 'Khách lẻ'}</strong></div>
                <div><span className="text-muted">Ngày:</span> <strong>{formatDateTime(viewSale.saleDate)}</strong></div>
                <div><span className="text-muted">Thanh toán:</span> <span className={`badge ${viewSale.paymentMethod === 'cash' ? 'badge-info' : 'badge-accent'}`}>{viewSale.paymentMethod === 'cash' ? '💵 Tiền mặt' : '🏦 Chuyển khoản'}</span></div>
                <div><span className="text-muted">Trạng thái:</span> <span className={`badge ${viewSale.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{viewSale.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}</span></div>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Sản phẩm</th><th className="text-right">SL</th><th className="text-right">Đơn giá</th><th className="text-right">Giảm giá</th><th className="text-right">Thành tiền</th></tr></thead>
                  <tbody>
                    {viewSale.items.map((item, i) => (
                      <tr key={i}><td>{item.product.name}</td><td className="text-right">{item.quantity} {item.product.unit}</td><td className="text-right">{formatCurrency(item.unitPrice)}</td><td className="text-right">{formatCurrency(item.discount)}</td><td className="text-right font-bold">{formatCurrency(item.totalPrice)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                {viewSale.discount > 0 && <div>Giảm giá đơn: <strong className="text-danger">-{formatCurrency(viewSale.discount)}</strong></div>}
                <div style={{ fontSize: 16 }}>Tổng cộng: <strong>{formatCurrency(viewSale.totalAmount)}</strong></div>
                <div className="text-success">Đã trả: <strong>{formatCurrency(viewSale.paidAmount)}</strong></div>
                {viewSale.debtAmount > 0 && <div className="text-warning">Còn nợ: <strong>{formatCurrency(viewSale.debtAmount)}</strong></div>}
              </div>
              {viewSale.notes && <div style={{ marginTop: 12 }} className="text-muted">Ghi chú: {viewSale.notes}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
