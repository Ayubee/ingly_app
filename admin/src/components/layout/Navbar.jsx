import React from 'react';
import { Search, Bell, Shield, Smartphone, Globe } from 'lucide-react';

export default function Navbar({ currentTab, onQuickSearch }) {
  const pageTitles = {
    dashboard: 'Umumiy Dashboard va Tahlillar',
    words: "4000 Essential Words - So'zlar va Darslar Boshqaruvi",
    users: 'Foydalanuvchilar va O\'rganish Progressi',
    monetization: 'Monetizatsiya va Tizim Sozlamalari (Feature Flags)',
    admins: 'Adminlar va Huquqlar Boshqaruvi (RBAC)',
    notifications: 'Smart Push Bildirishnomalar Markazi',
  };

  return (
    <header className="h-18 bg-white border-b border-inglyBorder fixed top-0 right-0 left-64 z-20 px-8 flex items-center justify-between">
      {/* Page Title & Breadcrumbs */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          {pageTitles[currentTab] || 'Boshqaruv Paneli'}
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Ingly Platform</span>
          <span>/</span>
          <span className="text-brand-600 font-medium capitalize">{currentTab}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Live Status Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>100% Bepul va Reklamasiz rejim</span>
        </div>

        {/* Mobile App sync badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
          <Smartphone size={14} className="text-brand-500" />
          <span>React Native v1.0.0</span>
        </div>

        {/* Notification Bell */}
        <button
          title="Bildirishnomalar"
          className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
        </button>

        {/* Admin Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-inglyBorder">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            SA
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-bold text-slate-900 leading-tight">Super Admin</div>
            <div className="text-[11px] font-medium text-brand-600 flex items-center gap-1">
              <Shield size={11} /> To'liq huquq
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
