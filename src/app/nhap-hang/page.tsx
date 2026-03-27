'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, Save, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Product { id: string; code: string; name: string; unit: string; salePrice: number; stock: number; }
interface Supplier { id: string; code: string; name: string; }
interface CartItem { productId: string; name: string; unit: string; quantity: string; unitPrice: string; }
interface Purchase {
  id: string; code: string; purchaseDate: string; totalAmount: number;
  paidAmount: number; debtAmount: number; status: string; notes: string | null;
  supplier: { name: string; code: string };
  items: Array<{ quantity: number; unitPrice: number; totalPrice: number; product: { name: string; unit: string } }>;
}

export default function PurchasesPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchProduct, setSearchProduct] = useState('');
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, supRes, purRes] = await Promise.all([
        fetch('/api/products?status=active'),
        fetch('/api/suppliers'),
        fetch('/api/purchases'),
      ]);
      setProducts(await prodRes.json());
      setSuppliers(await supRes.json());
      setPurchases(await purRes.json());
    } catch { showToast('error', 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addToCart = (product: Product) => {
    if (cart.find((c) => c.productId === product.id)) {
      showToast('warning', 'Sản phẩm đã có trong danh sách');
      return;
    }
    setCart([...cart, { productId: product.id, name: product.name, unit: product.unit, quantity: '1', unitPrice: '' }]);
    setSearchProduct('');
  };

  const updateCart = (index: number, field: keyof CartItem, value: string) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    setCart(newCart);
  };

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  const totalAmount = cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0);
  const debtAmount = totalAmount - (parseFloat(paidAmount) || 0);

  const handleSubmit = async () => {
    if (!selectedSupplier) { showToast('error', 'Vui lòng chọn nhà cung cấp'); return; }
    if (cart.length === 0) { showToast('error', 'Vui lòng thêm sản phẩm'); return; }
    for (const item of cart) {
      if (!item.quantity || !item.unitPrice || parseFloat(item.quantity) <= 0 || parseFloat(item.unitPrice) <= 0) {
        showToast('error', `Vui lòng nhập số lượng và giá cho "${item.name}"`);
        return;
      }
    }

    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity, unitPrice: c.unitPrice })),
          paidAmount,
          notes,
          purchaseDate,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã tạo phiếu nhập thành công');
      setShowForm(false);
      setCart([]); setSelectedSupplier(''); setPaidAmount(''); setNotes('');
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi tạo phiếu nhập'); }
  };

  const handleCancel = async (purchase: Purchase) => {
    if (!confirm(`Bạn có chắc muốn hủy phiếu nhập ${purchase.code}? Tồn kho và công nợ sẽ được hoàn lại.`)) return;
    try {
      const res = await fetch('/api/purchases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: purchase.id, action: 'cancel' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã hủy phiếu nhập');
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi hủy phiếu'); }
  };

  const filteredProducts = products.filter((p) =>
    searchProduct && (p.name.toLowerCase().includes(searchProduct.toLowerCase()) || p.code.toLowerCase().includes(searchProduct.toLowerCase()))
  );

  if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)' }}>Nhập hàng</h2>
      </div>

      {!showForm ? (
        <>
          <div className="toolbar">
            <div className="toolbar-left" />
            <div className="toolbar-right">
              <button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Tạo phiếu nhập</button>
            </div>
          </div>

          {purchases.length === 0 ? (
            <div className="card"><div className="empty-state"><ClipboardList /><h3>Chưa có phiếu nhập</h3></div></div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Mã</th><th>Ngày</th><th>NCC</th><th className="text-right">Tổng tiền</th><th className="text-right">Đã trả</th><th className="text-right">Còn nợ</th><th>Trạng thái</th><th className="text-center">Thao tác</th></tr></thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setViewPurchase(p)}>{p.code}</td>
                      <td>{formatDate(p.purchaseDate)}</td>
                      <td>{p.supplier.name}</td>
                      <td className="text-right font-bold">{formatCurrency(p.totalAmount)}</td>
                      <td className="text-right text-success">{formatCurrency(p.paidAmount)}</td>
                      <td className="text-right" style={{ color: p.debtAmount > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: p.debtAmount > 0 ? 700 : 400 }}>{formatCurrency(p.debtAmount)}</td>
                      <td><span className={`badge ${p.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{p.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}</span></td>
                      <td className="text-center">
                        {p.status === 'completed' && <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleCancel(p)}>Hủy</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Purchase Form */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Tạo phiếu nhập mới</h3>
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setCart([]); }}>Hủy</button>
          </div>
          <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Nhà cung cấp *</label>
              <select className="form-select" value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                <option value="">Chọn NCC</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ngày nhập</label>
              <input className="form-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ghi chú..." />
            </div>
          </div>

          {/* Search product */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <div className="search-box">
              <Search />
              <input placeholder="Tìm sản phẩm để thêm..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
            </div>
            {filteredProducts.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                {filteredProducts.map((p) => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }} className="nav-item">
                    <span>{p.code} - {p.name}</span>
                    <span className="text-muted">Tồn: {p.stock} {p.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="table-wrapper" style={{ marginBottom: 16 }}>
              <table className="table">
                <thead><tr><th>Sản phẩm</th><th>ĐVT</th><th style={{ width: 120 }}>Số lượng</th><th style={{ width: 150 }}>Giá nhập</th><th className="text-right">Thành tiền</th><th style={{ width: 50 }}></th></tr></thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.unit}</td>
                      <td><input className="form-input" type="number" min="0" step="any" value={item.quantity} onChange={(e) => updateCart(i, 'quantity', e.target.value)} /></td>
                      <td><input className="form-input" type="number" min="0" value={item.unitPrice} onChange={(e) => updateCart(i, 'unitPrice', e.target.value)} /></td>
                      <td className="text-right font-bold">{formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0))}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(i)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 350, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className="text-muted">Tổng tiền hàng:</span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="form-group">
                <label className="form-label">Số tiền trả</label>
                <input className="form-input" type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
                <span>Còn nợ NCC:</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: debtAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(Math.max(0, debtAmount))}</span>
              </div>
              <button className="btn btn-success btn-lg w-full" onClick={handleSubmit} disabled={cart.length === 0}>
                <Save size={18} /> Lưu phiếu nhập
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Detail Modal */}
      {viewPurchase && (
        <div className="modal-overlay" onClick={() => setViewPurchase(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết phiếu nhập {viewPurchase.code}</h3>
              <button className="modal-close" onClick={() => setViewPurchase(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
                <div><span className="text-muted">NCC:</span> <strong>{viewPurchase.supplier.name}</strong></div>
                <div><span className="text-muted">Ngày:</span> <strong>{formatDate(viewPurchase.purchaseDate)}</strong></div>
                <div><span className="text-muted">Trạng thái:</span> <span className={`badge ${viewPurchase.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{viewPurchase.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}</span></div>
              </div>
              <div className="table-wrapper">
                <table className="table">
                  <thead><tr><th>Sản phẩm</th><th>ĐVT</th><th className="text-right">Số lượng</th><th className="text-right">Đơn giá</th><th className="text-right">Thành tiền</th></tr></thead>
                  <tbody>
                    {viewPurchase.items.map((item, i) => (
                      <tr key={i}><td>{item.product.name}</td><td>{item.product.unit}</td><td className="text-right">{item.quantity}</td><td className="text-right">{formatCurrency(item.unitPrice)}</td><td className="text-right font-bold">{formatCurrency(item.totalPrice)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <div>Tổng: <strong>{formatCurrency(viewPurchase.totalAmount)}</strong></div>
                <div className="text-success">Đã trả: <strong>{formatCurrency(viewPurchase.paidAmount)}</strong></div>
                <div className="text-danger">Còn nợ: <strong>{formatCurrency(viewPurchase.debtAmount)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
