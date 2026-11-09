'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Lock,
  User,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { QuickFillSnippet } from '@/lib/types';

interface QuickFillVaultProps {
  onInjectText: (text: string) => void;
  isStreaming: boolean;
}

const DEFAULT_SNIPPETS: QuickFillSnippet[] = [
  { id: 'auth-1', title: 'Admin Email', value: 'admin@devmirror.local', category: 'auth' },
  { id: 'auth-2', title: 'QA Test User', value: 'qa.tester+automirror@company.io', category: 'auth' },
  { id: 'auth-3', title: 'Strong Password', value: 'Aether#Sec2026!Dev', category: 'auth' },
  { id: 'auth-4', title: 'Pin Code', value: '123456', category: 'auth' },
  
  { id: 'data-1', title: 'Full Name', value: 'Prajith Jayachandran', category: 'data' },
  { id: 'data-2', title: 'Phone (US)', value: '+1 (555) 019-2834', category: 'data' },
  { id: 'data-3', title: 'Phone (IN)', value: '+91 98765 43210', category: 'data' },
  { id: 'data-4', title: 'Mock Address', value: '404 Neon Cyberpunk Way, Suite 808', category: 'data' },
  { id: 'data-5', title: 'Short Lorem', value: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.', category: 'data' },

  { id: 'pay-1', title: 'Test Visa', value: '4111111111111111', category: 'payment' },
  { id: 'pay-2', title: 'Test Mastercard', value: '5555555555554444', category: 'payment' },
  { id: 'pay-3', title: 'Card Expiry', value: '12/28', category: 'payment' },
  { id: 'pay-4', title: 'CVV', value: '789', category: 'payment' },
];

export const QuickFillVault: React.FC<QuickFillVaultProps> = ({
  onInjectText,
  isStreaming,
}) => {
  const [snippets, setSnippets] = useState<QuickFillSnippet[]>(DEFAULT_SNIPPETS);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newValue, setNewValue] = useState('');
  const [injectedId, setInjectedId] = useState<string | null>(null);

  // Load custom snippets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aether_quickfill_snippets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Merge defaults with custom snippets
          setSnippets([...DEFAULT_SNIPPETS, ...parsed]);
        }
      }
    } catch (e) {}
  }, []);

  const handleInject = (snippet: QuickFillSnippet) => {
    if (!isStreaming) return;
    onInjectText(snippet.value);
    setInjectedId(snippet.id);
    setTimeout(() => setInjectedId(null), 1500);
  };

  const handleAddCustomSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newValue.trim()) return;

    const newSnippet: QuickFillSnippet = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      value: newValue.trim(),
      category: 'custom',
    };

    const updated = [...snippets, newSnippet];
    setSnippets(updated);

    // Save only custom snippets to localStorage
    const customOnly = updated.filter((s) => s.category === 'custom');
    try {
      localStorage.setItem('aether_quickfill_snippets', JSON.stringify(customOnly));
    } catch (e) {}

    setNewTitle('');
    setNewValue('');
    setIsAddingNew(false);
  };

  const handleDeleteCustomSnippet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    const customOnly = updated.filter((s) => s.category === 'custom');
    try {
      localStorage.setItem('aether_quickfill_snippets', JSON.stringify(customOnly));
    } catch (e) {}
  };

  const filteredSnippets = snippets.filter((s) => {
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.value.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="ultra-glass-card rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden transition-all duration-300">
      {/* Decorative ambient top glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer select-none"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Developer Quick-Fill Vault
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
            {snippets.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            title={isExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-3 pt-1">
          {/* Search & Category Filter Pills */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mock data pills..."
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-400 transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'auth', label: 'Auth', icon: Lock },
                { id: 'data', label: 'Data', icon: User },
                { id: 'payment', label: 'Pay', icon: CreditCard },
                { id: 'custom', label: 'Custom', icon: FileText },
              ].map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    <span>{cat.label}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setIsAddingNew((prev) => !prev)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-all border border-emerald-500/30 whitespace-nowrap ml-auto"
                title="Add Custom Mock Pill"
              >
                <Plus className="w-3 h-3" />
                <span>Add Pill</span>
              </button>
            </div>
          </div>

          {/* New Custom Snippet Form */}
          {isAddingNew && (
            <form
              onSubmit={handleAddCustomSnippet}
              className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300">New Custom Snippet</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Pill Title (e.g. Test Token)"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-400"
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Text value to paste into Android..."
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold self-end transition-all"
              >
                Save Snippet
              </button>
            </form>
          )}

          {/* Snippet Pills Grid */}
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
            {filteredSnippets.length === 0 ? (
              <div className="col-span-2 text-center py-3 text-xs text-slate-500">
                No matching snippet pills found.
              </div>
            ) : (
              filteredSnippets.map((snippet) => {
                const isInjected = injectedId === snippet.id;
                return (
                  <button
                    key={snippet.id}
                    onClick={() => handleInject(snippet)}
                    disabled={!isStreaming}
                    className={`group relative text-left p-2 rounded-xl border transition-all flex flex-col justify-between gap-1 disabled:opacity-40 ${
                      isInjected
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                        : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-cyan-500/40 text-slate-200'
                    }`}
                    title={`Click to paste "${snippet.value}" into phone`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold tracking-tight truncate max-w-[100px]">
                        {snippet.title}
                      </span>
                      {isInjected ? (
                        <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
                      ) : snippet.category === 'custom' ? (
                        <span
                          onClick={(e) => handleDeleteCustomSnippet(snippet.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 p-0.5 rounded transition-all"
                          title="Delete snippet"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 truncate w-full">
                      {snippet.value}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <p className="text-[10px] text-slate-500 text-center">
            One-click injects text directly into active Android input field.
          </p>
        </div>
      )}
    </div>
  );
};
