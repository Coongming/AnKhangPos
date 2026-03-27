'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface ExpenseCategory { id: string; name: string; isActive: boolean; }

export default function ExpenseCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/expense-categories');
      setCategories(await res.json());
    } catch { showToast('error', 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('error', 'Vui lòng nhập tên'); return; }
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('success', 'Đã thêm danh mục');
      setNewName(''); fetchData();
    } catch (err) { showToast('error', err instanceof Error ? err.message : 'Lỗi'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}><h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-heading)' }}>Danh mục chi phí</h2></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 500 }}>
        <input className="form-input" placeholder="Tên danh mục mới..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Thêm</button>
      </div>
      {loading ? <div className="loading-page"><div className="loading-spinner" /></div> : categories.length === 0 ? (
        <div className="card"><div className="empty-state"><ClipboardList /><h3>Chưa có danh mục</h3></div></div>
      ) : (
        <div className="table-wrapper" style={{ maxWidth: 500 }}>
          <table className="table"><thead><tr><th>#</th><th>Tên danh mục</th></tr></thead>
            <tbody>{categories.map((c, i) => <tr key={c.id}><td className="text-muted">{i + 1}</td><td style={{ fontWeight: 600 }}>{c.name}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
