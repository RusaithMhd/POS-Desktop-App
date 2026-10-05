'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, X, Check, ArrowLeft, Tag } from 'lucide-react';
import { getRawSqlDb } from '@/infrastructure/database/sqlite/db';
import { SQLiteProductRepository } from '@/infrastructure/repositories/SQLiteRepositories';
import { CategoryEntity } from '@/domain/entities/Product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated?: () => void;
}

export function CategoryModal({ isOpen, onClose, onCategoriesUpdated }: CategoryModalProps) {
  const [categories, setCategories] = useState<CategoryEntity[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setEditingId(null);
    setIsEditing(false);
    setErrorMsg(null);
    setDeleteConfirmId(null);
  };

  const loadData = async () => {
    try {
      const repo = new SQLiteProductRepository();
      const list = await repo.getCategories();
      setCategories(list);

      // Compute product counts per category
      const db = getRawSqlDb();
      const countStmt = db.prepare('SELECT category_id, COUNT(*) as cnt FROM products GROUP BY category_id');
      const counts: Record<string, number> = {};
      while (countStmt.step()) {
        const r = countStmt.getAsObject();
        if (r.category_id) {
          counts[r.category_id as string] = (r.cnt as number) || 0;
        }
      }
      countStmt.free();
      setProductCounts(counts);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (cat: CategoryEntity) => {
    setEditingId(cat.id);
    setName(cat.name);
    setCode(cat.code || '');
    setDescription(cat.description || '');
    setIsEditing(true);
    setErrorMsg(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Category name is required.');
      return;
    }

    try {
      const repo = new SQLiteProductRepository();
      await repo.saveCategory({
        id: editingId || undefined,
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        isActive: true,
      });

      await loadData();
      if (onCategoriesUpdated) onCategoriesUpdated();
      resetForm();
    } catch (err: any) {
      console.error('Failed to save category:', err);
      setErrorMsg(err?.message || 'Failed to save category.');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const repo = new SQLiteProductRepository();
      await repo.deleteCategory(id);
      await loadData();
      if (onCategoriesUpdated) onCategoriesUpdated();
      setDeleteConfirmId(null);
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-700 mr-1 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <Layers className="h-5 w-5 text-emerald-600" />
            )}
            <h3 className="text-base font-extrabold text-slate-900">
              {isEditing ? (editingId ? 'Edit Category' : 'Create Category') : 'Manage Categories'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsEditing(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-2.5 gap-1 shadow-2xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Category
              </Button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* INLINE CREATE/EDIT FORM */}
        {isEditing ? (
          <form onSubmit={handleSaveCategory} className="space-y-3 pt-1">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-lg">
                {errorMsg}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Category Name *</label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverages & Coffee"
                className="h-9 text-xs font-semibold bg-slate-50 border-slate-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Category Code (Optional)</label>
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BEV"
                className="h-9 text-xs font-semibold bg-slate-50 border-slate-300 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Description (Optional)</label>
              <Input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief category description..."
                className="h-9 text-xs font-semibold bg-slate-50 border-slate-300"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="text-xs font-semibold cursor-pointer"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer">
                Save Category
              </Button>
            </div>
          </form>
        ) : (
          /* CATEGORY LIST MODE */
          <div className="space-y-3">
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {categories.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium space-y-2">
                  <p>No product categories created yet.</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="bg-emerald-600 text-white font-bold text-xs"
                  >
                    + Create First Category
                  </Button>
                </div>
              ) : (
                categories.map((cat) => {
                  const count = productCounts[cat.id] || 0;
                  const isConfirmingDelete = deleteConfirmId === cat.id;

                  return (
                    <div key={cat.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="min-w-0 pr-2">
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-2">
                          <span>{cat.name}</span>
                          {cat.code && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded">
                              {cat.code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {count} {count === 1 ? 'product' : 'products'} assigned
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-red-600 font-bold">Delete?</span>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="px-2 py-1 bg-red-600 text-white font-bold text-[10px] rounded hover:bg-red-700 cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 font-bold text-[10px] rounded hover:bg-slate-300 cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(cat)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer transition-colors"
                              title="Edit Category"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(cat.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetForm();
                  setIsEditing(true);
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 p-0 h-auto cursor-pointer"
              >
                + Create New Category
              </Button>
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold cursor-pointer">
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
