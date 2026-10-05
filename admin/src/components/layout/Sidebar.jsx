import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  DollarSign,
  ShieldCheck,
  Bell,
  Sparkles,
  Database,
  ExternalLink,
} from 'lucide-react';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'words',
      label: "So'zlar boshqaruvi",
      icon: BookOpen,
      badge: null,
    },
    {
      id: 'users',
      label: 'Foydalanuvchilar',
      icon: Users,
      badge: null,
    },
    {
      id: 'monetization',
      label: 'Reklama & Obuna',
      icon: DollarSign,
      badge: null,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'admins',
      label: 'Adminlar & Huquqlar',
      icon: ShieldCheck,
      badge: 'RBAC',
    },
    { id: 'finances', label: 'Moliya va kirim-chiqimlar', icon: DollarSign, badge: null },
    {
      id: 'notifications',
      label: 'Push Bildirishnomalar',
      icon: Bell,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-inglyBorder flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-18 px-6 flex items-center justify-between border-b border-inglyBorder">
        <div className="flex items-center gap-3">
          {/* Logo Squircle with Gradient */}
          <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-brand-500 to-accent-400 flex items-center justify-center shadow-md shadow-brand-500/25">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 font-display">INGLY</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded border border-brand-200">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">4000 Essential Words</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Asosiy Boshqaruv
        </p>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                    item.badgeColor
                      ? item.badgeColor
                      : isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Supabase & Cloud Status Footer */}
      <div className="p-4 border-t border-inglyBorder bg-slate-50/60 m-3 rounded-2xl border">
        <div className="flex items-center gap-2 mb-2">
          <Database size={15} className="text-emerald-500" />
          <span className="text-xs font-semibold text-slate-800">Supabase DB</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Ulanish holati server so‘rovlari orqali tekshiriladi.
        </p>
        <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-brand-600 font-semibold cursor-pointer hover:underline">
          <span>Hujjatlar & API</span>
          <ExternalLink size={12} />
        </div>
      </div>
    </aside>
  );
}
