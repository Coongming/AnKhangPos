'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Trash2, ShoppingCart, User, Plus, Minus, Banknote, CreditCard, Truck, Copy } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatOrderForCopy } from '@/lib/utils';

interface Product { id: string; code: string; name: string; unit: string; salePrice: number; costPrice: number; stock: number; category: { name: string }; }
interface Customer { id: string; code: string; name: string; phone: string | null; debt: number; }
interface EmployeeItem { id: string; code: string; name: string; isActive: boolean; }
interface CartItem { productId: string; name: string; unit: string; stock: number; quantity: number; unitPrice: number; discount: number; }

export default function SalesPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderDiscount, setOrderDiscount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employeesList, setEmployeesList] = useState<EmployeeItem[]>([]);
  const [deliveryEmployeeId, setDeliveryEmployeeId] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, custRes, empRes] = await Promise.all([
        fetch('/api/products?status=active'),
        fetch('/api/customers'),
        fetch('/api/employees'),
      ]);
      setProducts(await prodRes.json());
      setCustomers(await custRes.json());
      const emps = await empRes.json();
      setEmployeesList(Array.isArray(emps) ? emps.filter((e: EmployeeItem) => e.isActive) : []);
    } catch { showToast('error', 'Lỗi tải dữ liệu'); }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = products.filter((p) =>
    searchProduct && (p.name.toLowerCase().includes(searchProduct.toLowerCase()) || p.code.toLowerCase().includes(searchProduct.toLowerCase()))
  );

  const filteredCustomers = customers.filter((c) =>
    searchCustomer && (c.name.toLowerCase().includes(searchCustomer.toLowerCase()) || (c.phone && c.phone.includes(searchCustomer)))
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((c) => c.productId === product.id);
    if (existing) {
      setCart(cart.map((c) => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, unit: product.unit, stock: product.stock, quantity: 1, unitPrice: product.salePrice, discount: 0 }]);
    }
    setSearchProduct('');
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((c) => c.productId === productId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c).filter((c) => c.quantity > 0));
  };

  const updateCartField = (productId: string, field: string, value: number) => {
    setCart(cart.map((c) => c.productId === productId ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (productId: string) => setCart(cart.filter((c) => c.productId !== productId));

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0);
  const discount = parseFloat(orderDiscount) || 0;
  const totalAmount = subtotal - discount;
  const paid = parseFloat(paidAmount) || 0;
  const debtAmount = Math.max(0, totalAmount - paid);

  const handleSubmit = async () => {
    if (cart.length === 0) { showToast('error', 'Vui lòng thêm sản phẩm'); return; }
    if (debtAmount > 0 && !selectedCustomer) { showToast('error', 'Bán nợ phải chọn khách hàng'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          items: cart.map((c) => ({ productId: c.productId, quantity: String(c.quantity), unitPrice: String(c.unitPrice), discount: String(c.discount) })),
          paidAmount: String(paid),
          discount: String(discount),
          notes,
          paymentMethod,
          deliveryEmployeeId: deliveryEmployeeId || null,
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error);
      const sale = await res.json();
      showToast('success', `Đã tạo hóa đơn ${sale.code}`);

      // Auto copy order for shipper
      if (deliveryEmployeeId) {
        const orderText = formatOrderForCopy({
          customer: selectedCustomer ? { name: selectedCustomer.name } : null,
          phone: selectedCustomer?.phone || null,
          items: cart.map(c => ({
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            totalPrice: c.quantity * c.unitPrice - c.discount,
            product: { name: c.name, unit: c.unit },
          })),
          totalAmount,
          notes: notes || null,
        });
        try {
          await navigator.clipboard.writeText(orderText);
          showToast('success', '📋 Đã copy đơn giao hàng!');
        } catch { /* clipboard may fail on some browsers */ }
      }

      // Reset
      setCart([]); setSelectedCustomer(null); setOrderDiscount('0'); setPaidAmount(''); setNotes(''); setPaymentMethod('cash'); setDeliveryEmployeeId('');
      fetchData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi tạo hóa đơn');
    } finally { setSubmitting(false); }
  };

  const payFull = () => setPaidAmount(String(totalAmount));

  return (
    <div className="sales-layout">
      {/* LEFT: Product Search + Cart */}
      <div className="sales-products-panel">
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 8 }}>
            <ShoppingCart size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: -3 }} />
            Bán hàng
          </h2>
          {/* Product Search */}
          <div style={{ position: 'relative' }}>
            <div className="search-box">
              <Search />
              <input placeholder="Tìm sản phẩm (tên hoặc mã)..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} autoFocus />
            </div>
            {filteredProducts.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 250, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                {filteredProducts.map((p) => (
                  <div key={p.id} onClick={() => addToCart(p)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }} className="nav-item">
                    <div>
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{p.code}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatCurrency(p.salePrice)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tồn: {p.stock} {p.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.length === 0 ? (
            <div className="card" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                <ShoppingCart />
                <h3>Chưa có sản phẩm</h3>
                <p>Tìm và thêm sản phẩm vào đơn hàng</p>
              </div>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Sản phẩm</th>
                    <th style={{ width: 130 }}>Đơn giá</th>
                    <th style={{ width: 130 }}>Số lượng</th>
                    <th style={{ width: 100 }}>Giảm</th>
                    <th className="text-right" style={{ width: 120 }}>Thành tiền</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, i) => {
                    const lineTotal = item.quantity * item.unitPrice - item.discount;
                    return (
                      <tr key={item.productId}>
                        <td className="text-muted">{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tồn: {item.stock} {item.unit}</div>
                        </td>
                        <td>
                          <input className="form-input" type="number" min="0" value={item.unitPrice} onChange={(e) => updateCartField(item.productId, 'unitPrice', parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => updateQty(item.productId, -1)} style={{ padding: 4 }}><Minus size={14} /></button>
                            <input className="form-input" type="number" min="1" value={item.quantity} onChange={(e) => updateCartField(item.productId, 'quantity', parseInt(e.target.value) || 1)} style={{ textAlign: 'center', width: 55 }} />
                            <button className="btn btn-ghost btn-sm" onClick={() => updateQty(item.productId, 1)} style={{ padding: 4 }}><Plus size={14} /></button>
                          </div>
                        </td>
                        <td>
                          <input className="form-input" type="number" min="0" value={item.discount} onChange={(e) => updateCartField(item.productId, 'discount', parseFloat(e.target.value) || 0)} style={{ textAlign: 'right' }} />
                        </td>
                        <td className="text-right" style={{ fontWeight: 700 }}>{formatCurrency(lineTotal)}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => removeFromCart(item.productId)}><Trash2 size={14} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Summary Panel */}
      <div className="sales-summary-panel">
        {/* Customer */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              <User size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
              Khách hàng
            </span>
            {selectedCustomer && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)} style={{ fontSize: 11 }}>Bỏ chọn</button>
            )}
          </div>
          {selectedCustomer ? (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 10 }}>
              <div style={{ fontWeight: 600 }}>{selectedCustomer.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCustomer.phone || 'Không có SĐT'}</div>
              {selectedCustomer.debt > 0 && (
                <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>Nợ cũ: {formatCurrency(selectedCustomer.debt)}</div>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input className="form-input" placeholder="Tìm khách (tên/SĐT)..." value={searchCustomer}
                onChange={(e) => { setSearchCustomer(e.target.value); setShowCustomerSearch(true); }}
                onFocus={() => setShowCustomerSearch(true)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Bỏ trống = khách lẻ</div>
              {showCustomerSearch && filteredCustomers.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 150, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                  {filteredCustomers.map((c) => (
                    <div key={c.id} onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); setShowCustomerSearch(false); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                      className="nav-item">
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 11 }}>{c.phone || ''} {c.debt > 0 ? `• Nợ: ${formatCurrency(c.debt)}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delivery Employee */}
        <div className="card" style={{ padding: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            <Truck size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
            Nhân viên giao
          </span>
          <select className="form-select" style={{ marginTop: 8 }} value={deliveryEmployeeId} onChange={(e) => setDeliveryEmployeeId(e.target.value)}>
            <option value="">Không giao hàng</option>
            {employeesList.map((e) => <option key={e.id} value={e.id}>{e.code} - {e.name}</option>)}
          </select>
        </div>

        {/* Payment Summary */}
        <div className="card" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span className="text-muted">Tạm tính ({cart.length} SP):</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Giảm giá toàn đơn</label>
              <input className="form-input" type="number" min="0" value={orderDiscount} onChange={(e) => setOrderDiscount(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>TỔNG CỘNG:</span>
              <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--accent)' }}>{formatCurrency(totalAmount)}</span>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Phương thức thanh toán</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPaymentMethod('cash')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  type="button"
                >
                  <Banknote size={16} /> Tiền mặt
                </button>
                <button
                  className={`btn ${paymentMethod === 'transfer' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPaymentMethod('transfer')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  type="button"
                >
                  <CreditCard size={16} /> Chuyển khoản
                </button>
              </div>
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Tiền khách trả</label>
                <button className="btn btn-ghost btn-sm" onClick={payFull} style={{ fontSize: 11 }}>Trả đủ</button>
              </div>
              <input className="form-input" type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }} />
            </div>
            {debtAmount > 0 && (
              <div style={{ background: 'var(--warning-bg)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Còn nợ:</span>
                <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{formatCurrency(debtAmount)}</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
            </div>
          </div>

          <button className="btn btn-success btn-lg w-full" onClick={handleSubmit} disabled={cart.length === 0 || submitting} style={{ marginTop: 8 }}>
            <ShoppingCart size={18} /> {submitting ? 'Đang xử lý...' : 'Thanh toán'}
          </button>
        </div>
      </div>
    </div>
  );
}
