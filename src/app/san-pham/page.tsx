'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Package, Edit2, Lock, Unlock, Filter, Settings, Trash2, Check, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface Product {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
  unit: string;
  specification: string | null;
  salePrice: number;
  costPrice: number;
  lastPurchasePrice: number | null;
  stock: number;
  minStock: number;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  _count?: { products: number };
}

export default function ProductsPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    unit: 'kg',
    specification: '',
    salePrice: '',
    minStock: '',
  });

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCategory) params.set('categoryId', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setProducts(data);
      }
    } catch {
      showToast('error', 'Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterStatus, showToast]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCategories(data);
      } else {
        console.error('Categories API error:', data);
      }
    } catch {
      console.error('Failed to load categories');
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const openCreate = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      categoryId: categories[0]?.id || '',
      unit: 'kg',
      specification: '',
      salePrice: '',
      minStock: '',
    });
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      categoryId: product.categoryId,
      unit: product.unit,
      specification: product.specification || '',
      salePrice: String(product.salePrice),
      minStock: String(product.minStock),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.categoryId || !form.unit) {
      showToast('error', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { id: editingProduct.id, ...form }
        : form;

      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      showToast('success', editingProduct ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm mới');
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Lỗi lưu sản phẩm');
    }
  };

  const toggleActive = async (product: Product) => {
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, isActive: !product.isActive }),
      });
      if (!res.ok) throw new Error();
      showToast('success', product.isActive ? 'Đã ngừng bán sản phẩm' : 'Đã mở bán lại sản phẩm');
      fetchProducts();
    } catch {
      showToast('error', 'Lỗi cập nhật trạng thái');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) { showToast('error', 'Vui lòng nhập tên nhóm'); return; }
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã thêm nhóm sản phẩm');
      setNewCategoryName(''); fetchCategories();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  const handleEditCategory = async () => {
    if (!editCategoryId || !editCategoryName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editCategoryId, name: editCategoryName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã cập nhật nhóm');
      setEditCategoryId(null); fetchCategories(); fetchProducts();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!confirm(`Xóa nhóm "${cat.name}"?`)) return;
    try {
      const res = await fetch(`/api/categories?id=${cat.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã xóa nhóm');
      fetchCategories();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)', marginBottom: 4 }}>
          Quản lý sản phẩm
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {products.length} sản phẩm
        </p>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box" style={{ maxWidth: 320 }}>
            <Search />
            <input
              placeholder="Tìm theo tên hoặc mã sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select"
            style={{ width: 160 }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Tất cả nhóm</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 140 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="active">Đang bán</option>
            <option value="inactive">Ngừng bán</option>
          </select>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-ghost" onClick={() => setShowCategoryModal(true)}>
            <Settings size={16} /> Quản lý nhóm
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Thêm sản phẩm
          </button>
        </div>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="loading-page"><div className="loading-spinner" /></div>
      ) : products.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Package />
            <h3>Chưa có sản phẩm nào</h3>
            <p>Bấm nút &quot;Thêm sản phẩm&quot; để bắt đầu</p>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên sản phẩm</th>
                <th>Nhóm</th>
                <th>ĐVT</th>
                <th>Quy cách</th>
                <th className="text-right">Giá bán</th>
                <th className="text-right">Giá nhập GN</th>
                <th className="text-right">Giá vốn BQ</th>
                <th className="text-right">Tồn kho</th>
                <th>Trạng thái</th>
                <th className="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} style={{ opacity: p.isActive ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{p.code}</td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>
                    <span className="badge badge-neutral">{p.category.name}</span>
                  </td>
                  <td>{p.unit}</td>
                  <td className="text-muted">{p.specification || '—'}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>
                    {formatCurrency(p.salePrice)}
                  </td>
                  <td className="text-right" style={{ fontWeight: 600, color: 'var(--warning)' }}>
                    {p.lastPurchasePrice ? formatCurrency(p.lastPurchasePrice) : '—'}
                  </td>
                  <td className="text-right text-muted">
                    {formatCurrency(p.costPrice)}
                  </td>
                  <td className="text-right">
                    <span style={{
                      fontWeight: 700,
                      color: p.stock <= p.minStock && p.minStock > 0 ? 'var(--danger)' : 'var(--text-primary)',
                    }}>
                      {formatNumber(p.stock)}
                    </span>
                    <span className="text-muted"> {p.unit}</span>
                  </td>
                  <td>
                    <span className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {p.isActive ? 'Đang bán' : 'Ngừng bán'}
                    </span>
                  </td>
                  <td className="text-center">
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} title="Sửa">
                        <Edit2 size={14} />
                      </button>
                      <button
                        className={`btn btn-sm ${p.isActive ? 'btn-ghost' : 'btn-ghost'}`}
                        onClick={() => toggleActive(p)}
                        title={p.isActive ? 'Ngừng bán' : 'Mở bán'}
                      >
                        {p.isActive ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Tên sản phẩm *</label>
                  <input
                    className="form-input"
                    placeholder="VD: Gạo ST25 5kg"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Nhóm sản phẩm *</label>
                    <select
                      className="form-select"
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    >
                      <option value="">Chọn nhóm</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Đơn vị tính *</label>
                    <select
                      className="form-select"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    >
                      <option value="kg">kg</option>
                      <option value="bao">bao</option>
                      <option value="túi">túi</option>
                      <option value="chai">chai</option>
                      <option value="thùng">thùng</option>
                      <option value="lốc">lốc</option>
                      <option value="bình">bình</option>
                      <option value="cái">cái</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Quy cách</label>
                  <input
                    className="form-input"
                    placeholder="VD: Bao 25kg, Thùng 24 chai"
                    value={form.specification}
                    onChange={(e) => setForm({ ...form, specification: e.target.value })}
                  />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Giá bán mặc định (VNĐ)</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="0"
                      value={form.salePrice}
                      onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tồn kho tối thiểu</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="0"
                      value={form.minStock}
                      onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                    />
                    <span className="form-hint">Cảnh báo khi thấp hơn mức này</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Cập nhật' : 'Thêm sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Quản lý nhóm sản phẩm</h3><button className="modal-close" onClick={() => setShowCategoryModal(false)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input className="form-input" placeholder="Tên nhóm mới..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
                <button className="btn btn-primary" onClick={handleAddCategory}><Plus size={16} /> Thêm</button>
              </div>
              <div className="table-wrapper">
                <table className="table"><thead><tr><th>#</th><th>Tên nhóm</th><th className="text-center">Số SP</th><th className="text-center">Thao tác</th></tr></thead>
                  <tbody>{categories.map((c, i) => (
                    <tr key={c.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td>
                        {editCategoryId === c.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input className="form-input" value={editCategoryName} onChange={(e) => setEditCategoryName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEditCategory()} autoFocus />
                            <button className="btn btn-ghost btn-sm text-success" onClick={handleEditCategory}><Check size={14} /></button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditCategoryId(null)}><X size={14} /></button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                        )}
                      </td>
                      <td className="text-center text-muted">{c._count?.products ?? 0}</td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditCategoryId(c.id); setEditCategoryName(c.name); }} title="Sửa"><Edit2 size={14} /></button>
                          <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteCategory(c)} title="Xóa"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
