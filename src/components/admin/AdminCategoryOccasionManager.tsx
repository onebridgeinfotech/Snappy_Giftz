'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  RefreshCw,
  FolderTree,
  Calendar,
  X
} from 'lucide-react';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  _count?: { products: number };
}

interface OccasionItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  _count?: { products: number };
}

export const AdminCategoryOccasionManager: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'categories' | 'occasions'>('categories');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [occasions, setOccasions] = useState<OccasionItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<{ id?: string; name: string; slug: string; description: string; imageUrl: string; isActive: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const [catRes, occRes] = await Promise.all([
        fetch('/api/admin/catalog/categories'),
        fetch('/api/admin/catalog/occasions'),
      ]);

      const catData = await catRes.json();
      const occData = await occRes.json();

      if (catData.success) {
        setCategories(catData.data || []);
      }
      if (occData.success) {
        setOccasions(occData.data || []);
      }
    } catch {
      setErrorBanner('Failed to load taxonomy categories and occasions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenAdd = () => {
    setEditingItem({
      name: '',
      slug: '',
      description: '',
      imageUrl: '',
      isActive: true,
    });
    setErrorBanner(null);
    setSuccessBanner(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      imageUrl: item.imageUrl || '',
      isActive: item.isActive !== false,
    });
    setErrorBanner(null);
    setSuccessBanner(null);
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) {
      setErrorBanner('Name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorBanner(null);

    const isCategory = activeSubTab === 'categories';
    const baseUrl = isCategory ? '/api/admin/catalog/categories' : '/api/admin/catalog/occasions';
    const url = editingItem.id ? `${baseUrl}/${editingItem.id}` : baseUrl;
    const method = editingItem.id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingItem.name.trim(),
          slug: editingItem.slug.trim() || undefined,
          description: editingItem.description.trim() || undefined,
          imageUrl: editingItem.imageUrl.trim() || undefined,
          isActive: editingItem.isActive,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessBanner(`${isCategory ? 'Category' : 'Occasion'} "${editingItem.name}" saved successfully.`);
        setTimeout(() => {
          setIsModalOpen(false);
          setEditingItem(null);
          setSuccessBanner(null);
          fetchData();
        }, 1200);
      } else {
        setErrorBanner(data.error || 'Failed to save item.');
      }
    } catch {
      setErrorBanner('Network error saving taxonomy record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: any) => {
    const isCategory = activeSubTab === 'categories';
    const url = `${isCategory ? '/api/admin/catalog/categories' : '/api/admin/catalog/occasions'}/${item.id}`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: item.isActive === false ? true : false,
        }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch {
      setErrorBanner('Failed to toggle status.');
    }
  };

  const itemsToDisplay = activeSubTab === 'categories' ? categories : occasions;
  const filteredItems = itemsToDisplay.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.slug.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D5A34A]/20 pb-4">
        <div>
          <h2 className="font-serif text-2xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-[#F5BD48]" />
            <span>Categories & Occasions Taxonomy</span>
          </h2>
          <p className="text-xs text-[#94A3B8] mt-1">
            Manage product collections, occasions, custom slugs, and active storefront visibility without breaking product URLs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-[#17181C] hover:bg-[#1E2028] border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:brightness-110 text-[#08090B] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#D5A34A]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add {activeSubTab === 'categories' ? 'Category' : 'Occasion'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => { setActiveSubTab('categories'); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'categories'
              ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] shadow-md'
              : 'bg-[#17181C] text-[#94A3B8] hover:text-white border border-white/5'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Product Categories ({categories.length})</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('occasions'); setSearchQuery(''); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'occasions'
              ? 'bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] text-[#08090B] shadow-md'
              : 'bg-[#17181C] text-[#94A3B8] hover:text-white border border-white/5'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Celebration Occasions ({occasions.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder={`Search ${activeSubTab} by name or slug...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 text-xs bg-[#0D0F14] text-white focus:outline-hidden focus:border-[#D5A34A]"
        />
        <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-[#94A3B8] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#F5BD48]" />
            <span>Loading {activeSubTab}...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#94A3B8] bg-[#12141A] rounded-2xl border border-white/10 p-6">
            <Layers className="w-8 h-8 text-[#94A3B8] mx-auto mb-2 opacity-50" />
            <p className="font-semibold text-white">No {activeSubTab} found</p>
            <p className="text-[11px] text-[#64748B] mt-1">Click "Add {activeSubTab === 'categories' ? 'Category' : 'Occasion'}" to create one.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-[#12141A] border border-white/10 hover:border-[#D5A34A]/40 transition-all flex flex-col justify-between space-y-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm">{item.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      item.isActive !== false
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}>
                      {item.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[#D5A34A]">/{item.slug}</div>
                  {item.description && (
                    <p className="text-xs text-[#94A3B8] line-clamp-2 mt-1">{item.description}</p>
                  )}
                </div>

                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
                  />
                )}
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#94A3B8]">
                  Products Assigned: <strong className="text-white">{item._count?.products ?? 0}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className="p-1.5 rounded-lg bg-[#17181C] hover:bg-[#1E2028] text-[#94A3B8] hover:text-white border border-white/10"
                    title={item.isActive !== false ? 'Deactivate' : 'Activate'}
                  >
                    {item.isActive !== false ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg bg-[#17181C] hover:bg-[#1E2028] text-[#94A3B8] hover:text-[#F5BD48] border border-white/10"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal for Add / Edit */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#12141A] border border-[#D5A34A]/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-white/10 pb-3">
              <h3 className="font-serif text-xl font-bold text-white">
                {editingItem.id ? `Edit ${activeSubTab === 'categories' ? 'Category' : 'Occasion'}` : `Create New ${activeSubTab === 'categories' ? 'Category' : 'Occasion'}`}
              </h3>
            </div>

            {errorBanner && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
                {errorBanner}
              </div>
            )}
            {successBanner && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs">
                {successBanner}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs">
              <div>
                <label className="block text-white font-semibold mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    setEditingItem((prev: any) => ({
                      ...prev,
                      name,
                      slug: prev.id ? prev.slug : slug,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#0D0F14] border border-white/15 text-white focus:outline-hidden focus:border-[#D5A34A]"
                  placeholder="e.g. Personalized Gold Keepsakes"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-1">URL Slug</label>
                <input
                  type="text"
                  value={editingItem.slug}
                  onChange={(e) => setEditingItem((prev: any) => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0D0F14] border border-white/15 text-[#D5A34A] font-mono focus:outline-hidden focus:border-[#D5A34A]"
                  placeholder="e.g. personalized-gold-keepsakes"
                />
                <span className="text-[10px] text-[#64748B]">Auto-generated from name if left empty.</span>
              </div>

              <div>
                <label className="block text-white font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingItem.description}
                  onChange={(e) => setEditingItem((prev: any) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0D0F14] border border-white/15 text-white focus:outline-hidden focus:border-[#D5A34A]"
                  placeholder="Curated selection of luxury gifting articles..."
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-1">Image URL</label>
                <input
                  type="text"
                  value={editingItem.imageUrl}
                  onChange={(e) => setEditingItem((prev: any) => ({ ...prev, imageUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-[#0D0F14] border border-white/15 text-white font-mono text-[11px] focus:outline-hidden focus:border-[#D5A34A]"
                  placeholder="https://..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={editingItem.isActive}
                  onChange={(e) => setEditingItem((prev: any) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded-md accent-[#D5A34A]"
                />
                <label htmlFor="isActiveToggle" className="text-white cursor-pointer select-none">
                  Active and visible on storefront navigation
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#17181C] text-[#94A3B8] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#F5BD48] to-[#D5A34A] hover:brightness-110 text-[#08090B] font-bold flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

