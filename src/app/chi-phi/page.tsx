'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, Filter } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ExpenseCategory { id: string; name: string; }
interface Expense { id: string; amount: number; date: string; description: string | null; notes: string | null; category: { name: string }; }

export default function ExpensesPage() {
  const { showToast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [form, setForm] = useState({ categoryId: '', amount: '', date: new Date().toISOString().split('T')[0], description: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set('categoryId', filterCat);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const [expRes, catRes] = await Promise.all([fetch(`/api/expenses?${params}`), fetch('/api/expense-categories')]);
      setExpenses(await expRes.json());
      setCategories(await catRes.json());
    } catch { showToast('error', 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [filterCat, dateFrom, dateTo, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId || !form.amount) { showToast('error', 'Vui lòng nhập đầy đủ'); return; }
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã thêm chi phí');
      setShowModal(false);
      setForm({ ...form, amount: '', description: '', notes: '' });
      fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)' }}>Quản lý chi phí</h2>
      </div>

      <div className="stat-card" style={{ marginBottom: 20 }}>
        <div className="stat-icon danger"><DollarSign size={22} /></div>
        <div className="stat-content">
          <h3>Tổng chi phí</h3>
          <div className="stat-value text-danger">{formatCurrency(totalExpense)}</div>
          <div className="stat-sub">{expenses.length} khoản chi</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <select className="form-select" style={{ width: 180 }} value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
            <option value="">Tất cả loại</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="form-input" type="date" style={{ width: 150 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-muted">đến</span>
          <input className="form-input" type="date" style={{ width: 150 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="toolbar-right">
          <button className="btn btn-primary" onClick={() => { setForm({ categoryId: categories[0]?.id || '', amount: '', date: new Date().toISOString().split('T')[0], description: '', notes: '' }); setShowModal(true); }}>
            <Plus size={16} /> Thêm chi phí
          </button>
        </div>
      </div>

      {loading ? <div className="loading-page"><div className="loading-spinner" /></div> : expenses.length === 0 ? (
        <div className="card"><div className="empty-state"><DollarSign /><h3>Chưa có chi phí</h3></div></div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th className="text-right">Số tiền</th><th>Ghi chú</th></tr></thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.date)}</td>
                  <td><span className="badge badge-neutral">{e.category.name}</span></td>
                  <td>{e.description || '—'}</td>
                  <td className="text-right font-bold text-danger">{formatCurrency(e.amount)}</td>
                  <td className="text-muted">{e.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Thêm chi phí</h3><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Loại chi phí *</label>
                    <select className="form-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                      <option value="">Chọn loại</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label className="form-label">Ngày</label><input className="form-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Số tiền *</label><input className="form-input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Nội dung</label><input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Ghi chú</label><textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Hủy</button><button type="submit" className="btn btn-primary">Thêm</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
