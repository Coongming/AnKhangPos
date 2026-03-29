'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, Save, Beaker, BookOpen, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

interface Product { id: string; code: string; name: string; unit: string; stock: number; costPrice: number; salePrice: number; categoryId: string; }
interface Category { id: string; name: string; }
interface IngredientItem { productId: string; name: string; unit: string; quantity: string; stock: number; costPrice: number; }
interface BlendHistory {
  id: string; code: string; outputQuantity: number; outputCostPrice: number; notes: string | null; createdAt: string;
  outputProduct: { name: string; code: string; unit: string };
  items: Array<{ quantity: number; costPrice: number; product: { name: string; code: string; unit: string } }>;
}
interface BlendTemplate {
  id: string; name: string; notes: string | null;
  outputProduct: { id: string; name: string; code: string; unit: string } | null;
  items: Array<{ productId: string; quantity: number; product: { id: string; name: string; code: string; unit: string; stock: number } }>;
}

export default function BlendPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<BlendHistory[]>([]);
  const [templates, setTemplates] = useState<BlendTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Blend form
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [searchProduct, setSearchProduct] = useState('');
  const [outputMode, setOutputMode] = useState<'existing' | 'new'>('existing');
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('kg');
  const [newProductSalePrice, setNewProductSalePrice] = useState('');
  const [blendNotes, setBlendNotes] = useState('');

  // Template save
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Tab
  const [activeTab, setActiveTab] = useState<'blend' | 'history' | 'templates'>('blend');
  const [searchHistory, setSearchHistory] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [prodRes, catRes, histRes, tempRes] = await Promise.all([
        fetch('/api/products?status=active'),
        fetch('/api/categories'),
        fetch('/api/blend'),
        fetch('/api/blend-templates'),
      ]);
      setProducts(await prodRes.json());
      setCategories(await catRes.json());
      setHistory(await histRes.json());
      setTemplates(await tempRes.json());
    } catch { showToast('error', 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Ingredient management ---
  const addIngredient = (product: Product) => {
    if (ingredients.find(i => i.productId === product.id)) {
      showToast('warning', 'Nguyên liệu đã có trong danh sách');
      return;
    }
    if (ingredients.length >= 5) {
      showToast('warning', 'Tối đa 5 loại nguyên liệu');
      return;
    }
    setIngredients([...ingredients, {
      productId: product.id, name: product.name, unit: product.unit,
      quantity: '', stock: product.stock, costPrice: product.costPrice,
    }]);
    setSearchProduct('');
  };

  const updateIngredient = (index: number, quantity: string) => {
    const newItems = [...ingredients];
    newItems[index] = { ...newItems[index], quantity };
    setIngredients(newItems);
  };

  const removeIngredient = (index: number) => setIngredients(ingredients.filter((_, i) => i !== index));

  // --- Calculations ---
  const totalInputQty = ingredients.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
  const totalInputCost = ingredients.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * i.costPrice, 0);
  const outputCostPrice = totalInputQty > 0 ? totalInputCost / totalInputQty : 0;

  // --- Submit blend ---
  const handleBlend = async () => {
    if (ingredients.length < 2) { showToast('error', 'Cần ít nhất 2 nguyên liệu'); return; }
    for (const item of ingredients) {
      const qty = parseFloat(item.quantity);
      if (!qty || qty <= 0) { showToast('error', `Vui lòng nhập số lượng cho "${item.name}"`); return; }
      if (qty > item.stock) { showToast('error', `"${item.name}" không đủ tồn kho (còn ${item.stock} ${item.unit})`); return; }
    }

    if (outputMode === 'existing' && !selectedOutputId) { showToast('error', 'Vui lòng chọn sản phẩm đầu ra'); return; }
    if (outputMode === 'new' && !newProductName.trim()) { showToast('error', 'Vui lòng nhập tên sản phẩm mới'); return; }
    if (outputMode === 'new' && !newProductCategory) { showToast('error', 'Vui lòng chọn nhóm sản phẩm'); return; }

    // Check if output product is same as any ingredient
    if (outputMode === 'existing' && ingredients.some(i => i.productId === selectedOutputId)) {
      showToast('error', 'Sản phẩm đầu ra không được trùng với nguyên liệu'); return;
    }

    if (!confirm(`Xác nhận trộn ${formatNumber(totalInputQty)} kg từ ${ingredients.length} loại nguyên liệu?`)) return;

    try {
      const payload: Record<string, unknown> = {
        items: ingredients.map(i => ({ productId: i.productId, quantity: i.quantity })),
        notes: blendNotes,
      };

      if (outputMode === 'existing') {
        payload.outputProductId = selectedOutputId;
      } else {
        payload.newProduct = {
          name: newProductName.trim(),
          categoryId: newProductCategory,
          unit: newProductUnit,
          salePrice: newProductSalePrice,
        };
      }

      const res = await fetch('/api/blend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã trộn gạo thành công! 🎉');
      resetForm();
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi trộn gạo'); }
  };

  const resetForm = () => {
    setIngredients([]); setSelectedOutputId(''); setOutputMode('existing');
    setNewProductName(''); setNewProductCategory(''); setNewProductUnit('kg');
    setNewProductSalePrice(''); setBlendNotes('');
  };

  // --- Templates ---
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { showToast('error', 'Nhập tên mẫu trộn'); return; }
    if (ingredients.length < 2) { showToast('error', 'Cần ít nhất 2 nguyên liệu để lưu mẫu'); return; }

    try {
      const res = await fetch('/api/blend-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          outputProductId: outputMode === 'existing' ? selectedOutputId : null,
          items: ingredients.map(i => ({ productId: i.productId, quantity: parseFloat(i.quantity) || 0 })),
          notes: blendNotes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã lưu mẫu trộn');
      setShowSaveTemplate(false); setTemplateName('');
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  const loadTemplate = (template: BlendTemplate) => {
    const newIngredients: IngredientItem[] = [];
    for (const item of template.items) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        newIngredients.push({
          productId: item.productId, name: item.product.name, unit: item.product.unit,
          quantity: String(item.quantity), stock: product.stock, costPrice: product.costPrice,
        });
      }
    }
    setIngredients(newIngredients);
    if (template.outputProduct) {
      setOutputMode('existing');
      setSelectedOutputId(template.outputProduct.id);
    }
    if (template.notes) setBlendNotes(template.notes);
    setActiveTab('blend');
    showToast('success', `Đã tải mẫu "${template.name}"`);
  };

  const handleDeleteTemplate = async (template: BlendTemplate) => {
    if (!confirm(`Xóa mẫu "${template.name}"?`)) return;
    try {
      const res = await fetch(`/api/blend-templates?id=${template.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã xóa mẫu trộn');
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  const handleDeleteBlend = async (blend: BlendHistory) => {
    if (!confirm(`Xóa phiếu trộn ${blend.code}? Tồn kho sẽ được hoàn lại.`)) return;
    try {
      const res = await fetch(`/api/blend?id=${blend.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã xóa phiếu trộn');
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  // --- Search ---
  const filteredProducts = products.filter(p =>
    searchProduct && (p.name.toLowerCase().includes(searchProduct.toLowerCase()) || p.code.toLowerCase().includes(searchProduct.toLowerCase()))
  );

  const filteredHistory = searchHistory
    ? history.filter(h => h.code.toLowerCase().includes(searchHistory.toLowerCase()) || h.notes?.toLowerCase().includes(searchHistory.toLowerCase()) || h.outputProduct.name.toLowerCase().includes(searchHistory.toLowerCase()))
    : history;

  if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)' }}>🍚 Trộn gạo</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Trộn nhiều loại gạo thành sản phẩm mới</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[
          { key: 'blend', label: 'Trộn gạo', icon: <Beaker size={16} /> },
          { key: 'history', label: `Lịch sử (${history.length})`, icon: <Clock size={16} /> },
          { key: 'templates', label: `Mẫu trộn (${templates.length})`, icon: <BookOpen size={16} /> },
        ].map(tab => (
          <button key={tab.key} className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab(tab.key as 'blend' | 'history' | 'templates')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* === TAB: BLEND === */}
      {activeTab === 'blend' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Tạo phiếu trộn mới</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {ingredients.length >= 2 && (
                <button className="btn btn-ghost" onClick={() => setShowSaveTemplate(true)}>
                  <BookOpen size={16} /> Lưu mẫu
                </button>
              )}
              <button className="btn btn-ghost" onClick={resetForm}>Xóa tất cả</button>
            </div>
          </div>

          {/* Search & add ingredients */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <div className="search-box">
              <Search />
              <input placeholder="Tìm nguyên liệu để thêm (2-5 loại)..." value={searchProduct} onChange={(e) => setSearchProduct(e.target.value)} />
            </div>
            {filteredProducts.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', zIndex: 10, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                {filteredProducts.map(p => (
                  <div key={p.id} onClick={() => addIngredient(p)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }} className="nav-item">
                    <span>{p.code} - {p.name}</span>
                    <span className="text-muted">Tồn: {formatNumber(p.stock)} {p.unit} • Giá vốn: {formatCurrency(p.costPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ingredients table */}
          {ingredients.length > 0 && (
            <div className="table-wrapper" style={{ marginBottom: 20 }}>
              <table className="table">
                <thead><tr><th>Nguyên liệu</th><th>ĐVT</th><th className="text-right">Tồn kho</th><th className="text-right">Giá vốn</th><th style={{ width: 130 }}>Số lượng trộn</th><th className="text-right">Thành tiền vốn</th><th style={{ width: 50 }}></th></tr></thead>
                <tbody>
                  {ingredients.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.unit}</td>
                      <td className="text-right text-muted">{formatNumber(item.stock)}</td>
                      <td className="text-right">{formatCurrency(item.costPrice)}</td>
                      <td><input className="form-input" type="number" min="0" step="any" value={item.quantity} onChange={(e) => updateIngredient(i, e.target.value)} placeholder="0" /></td>
                      <td className="text-right font-bold">{formatCurrency((parseFloat(item.quantity) || 0) * item.costPrice)}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => removeIngredient(i)}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                    <td colSpan={4}>Tổng cộng</td>
                    <td className="text-right">{formatNumber(totalInputQty)} kg</td>
                    <td className="text-right">{formatCurrency(totalInputCost)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Output product section */}
          {ingredients.length >= 2 && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <h4 style={{ marginBottom: 12, color: 'var(--text-heading)' }}>Sản phẩm đầu ra</h4>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className={`btn btn-sm ${outputMode === 'existing' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOutputMode('existing')}>Chọn SP có sẵn</button>
                <button className={`btn btn-sm ${outputMode === 'new' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setOutputMode('new')}>Tạo SP mới</button>
              </div>

              {outputMode === 'existing' ? (
                <select className="form-select" value={selectedOutputId} onChange={(e) => setSelectedOutputId(e.target.value)}>
                  <option value="">-- Chọn sản phẩm đầu ra --</option>
                  {products.filter(p => !ingredients.some(i => i.productId === p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name} (tồn: {p.stock} {p.unit})</option>
                  ))}
                </select>
              ) : (
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Tên sản phẩm mới *</label>
                    <input className="form-input" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="VD: Gạo trộn thượng hạng" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhóm SP *</label>
                    <select className="form-select" value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)}>
                      <option value="">Chọn nhóm</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">ĐVT</label>
                    <select className="form-select" value={newProductUnit} onChange={(e) => setNewProductUnit(e.target.value)}>
                      <option value="kg">kg</option><option value="bao">bao</option><option value="túi">túi</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giá bán</label>
                    <input className="form-input" type="number" value={newProductSalePrice} onChange={(e) => setNewProductSalePrice(e.target.value)} placeholder="0" />
                  </div>
                </div>
              )}

              {/* Summary */}
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span className="text-muted">Số lượng đầu ra:</span>
                  <strong>{formatNumber(totalInputQty)} kg</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Giá vốn trung bình:</span>
                  <strong style={{ color: 'var(--accent)' }}>{formatCurrency(outputCostPrice)}/kg</strong>
                </div>
              </div>
            </div>
          )}

          {/* Notes & Submit */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Ghi chú</label>
            <input className="form-input" value={blendNotes} onChange={(e) => setBlendNotes(e.target.value)} placeholder="VD: Trộn theo đơn KH001..." />
          </div>

          <button className="btn btn-success btn-lg w-full" onClick={handleBlend} disabled={ingredients.length < 2}>
            <Beaker size={18} /> Xác nhận trộn gạo
          </button>
        </div>
      )}

      {/* === TAB: HISTORY === */}
      {activeTab === 'history' && (
        <div>
          <div className="toolbar" style={{ marginBottom: 16 }}>
            <div className="toolbar-left">
              <div className="search-box" style={{ maxWidth: 350 }}>
                <Search />
                <input placeholder="Tìm theo mã, ghi chú, sản phẩm..." value={searchHistory} onChange={(e) => setSearchHistory(e.target.value)} />
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="card"><div className="empty-state"><Clock /><h3>Chưa có lịch sử trộn</h3></div></div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Mã</th><th>Ngày</th><th>Sản phẩm ra</th><th className="text-right">SL ra</th><th className="text-right">Giá vốn</th><th>Ghi chú</th><th className="text-center">Thao tác</th></tr></thead>
                <tbody>
                  {filteredHistory.map(h => (
                    <>
                      <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedHistory(expandedHistory === h.id ? null : h.id)}>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{h.code}</td>
                        <td>{formatDate(h.createdAt)}</td>
                        <td style={{ fontWeight: 600 }}>{h.outputProduct.name}</td>
                        <td className="text-right">{formatNumber(h.outputQuantity)} {h.outputProduct.unit}</td>
                        <td className="text-right">{formatCurrency(h.outputCostPrice)}/{h.outputProduct.unit}</td>
                        <td className="text-muted">{h.notes || '—'}</td>
                        <td className="text-center">
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setExpandedHistory(expandedHistory === h.id ? null : h.id); }}>
                              {expandedHistory === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            <button className="btn btn-ghost btn-sm text-danger" onClick={(e) => { e.stopPropagation(); handleDeleteBlend(h); }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                      {expandedHistory === h.id && (
                        <tr key={`${h.id}-detail`}>
                          <td colSpan={7} style={{ padding: '8px 24px', background: 'var(--bg-secondary)' }}>
                            <strong style={{ marginBottom: 8, display: 'block' }}>Nguyên liệu đã trộn:</strong>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              {h.items.map((item, i) => (
                                <div key={i} style={{ padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                                  <span style={{ fontWeight: 600 }}>{item.product.name}</span>
                                  <span className="text-muted"> • {formatNumber(item.quantity)} {item.product.unit}</span>
                                  <span className="text-muted"> • vốn {formatCurrency(item.costPrice)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === TAB: TEMPLATES === */}
      {activeTab === 'templates' && (
        <div>
          {templates.length === 0 ? (
            <div className="card"><div className="empty-state"><BookOpen /><h3>Chưa có mẫu trộn</h3><p>Tạo phiếu trộn rồi bấm &quot;Lưu mẫu&quot; để lưu công thức</p></div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
              {templates.map(t => (
                <div key={t.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ color: 'var(--text-heading)', margin: 0 }}>📋 {t.name}</h4>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => loadTemplate(t)}>Dùng mẫu</button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteTemplate(t)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                    {t.outputProduct && <span>→ {t.outputProduct.name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {t.items.map((item, i) => (
                      <span key={i} className="badge badge-neutral">{item.product.name}: {formatNumber(item.quantity)} {item.product.unit}</span>
                    ))}
                  </div>
                  {t.notes && <p className="text-muted" style={{ marginTop: 8, fontSize: 12 }}>{t.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div className="modal-overlay" onClick={() => setShowSaveTemplate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Lưu mẫu trộn</h3><button className="modal-close" onClick={() => setShowSaveTemplate(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tên mẫu trộn *</label>
                <input className="form-input" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="VD: Gạo thượng hạng lô A" onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()} autoFocus />
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                Sẽ lưu {ingredients.length} nguyên liệu: {ingredients.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-ghost" onClick={() => setShowSaveTemplate(false)}>Hủy</button>
                <button className="btn btn-primary" onClick={handleSaveTemplate}>Lưu mẫu</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
