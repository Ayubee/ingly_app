import React from 'react';
import {
  Users,
  CheckCircle2,
  Flame,
  TrendingUp,
  BookOpen,
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { mockStats } from '../services/mockData';

export default function DashboardPage({ setCurrentTab }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-brand-500 to-accent-400 p-8 text-white shadow-xl shadow-brand-500/15">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="accent" size="sm" className="bg-white/20 text-white border-white/30 mb-3">
            v1.0.0 Alpha • Boshqaruv Markazi
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight font-display mb-2">
            Xush kelibsiz, Ingly Boshqaruv Paneliga!
          </h1>
          <p className="text-white/85 text-sm leading-relaxed mb-6">
            Paul Nation'ning "4000 Essential English Words" kitoblari asosidagi o'zbek foydalanuvchilari uchun maxsus ta'lim ekotizimi. Hozirda ilova 100% bepul va reklamasiz rejimda ishlamoqda.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="md"
              className="bg-white text-brand-600 border-transparent hover:bg-slate-100 font-semibold"
              onClick={() => setCurrentTab('words')}
            >
              So'zlarni Ko'rish (4000)
            </Button>
            <Button
              variant="outline"
              size="md"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={() => setCurrentTab('monetization')}
            >
              Monetizatsiya Switchlari
            </Button>
          </div>
        </div>

        {/* Decorative background shapes */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-40 top-0 -translate-y-20 w-60 h-60 rounded-full bg-accent-400/20 blur-xl pointer-events-none" />
      </div>

      {/* Top 4 Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <Card hoverEffect padding="sm" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Jami Foydalanuvchilar</span>
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500">
              <Users size={20} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-display">
            {mockStats.totalUsers.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{mockStats.userGrowthPct} o'tgan haftaga nisbatan</span>
          </div>
        </Card>

        {/* Metric 2 */}
        <Card hoverEffect padding="sm" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Bugungi Faollar (DAU)</span>
            <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center text-accent-500">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-display">
            {mockStats.activeToday.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{mockStats.activeGrowthPct} bugun faol</span>
          </div>
        </Card>

        {/* Metric 3 */}
        <Card hoverEffect padding="sm" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Yodlangan So'zlar</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-display">
            {mockStats.wordsLearned.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{mockStats.wordsGrowthPct} so'nggi 30 kunda</span>
          </div>
        </Card>

        {/* Metric 4 */}
        <Card hoverEffect padding="sm" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Streak Peshqadamlari 🔥</span>
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-streak-DEFAULT">
              <Flame size={20} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-display">
            {mockStats.streakChampions}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-streak-DEFAULT">
            <Zap size={14} />
            <span>10+ kunlik streak egalari</span>
          </div>
        </Card>
      </div>

      {/* 6 Books Progress Grid */}
      <Card
        header={
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                6 ta Kitob Bo'yicha Foydalanuvchilarning O'zlashtirish Dinamikasi
              </h3>
              <p className="text-xs text-slate-500">
                Har bir kitobda 30 tadan unit, 600 tadan so'z (Jami 4000 ta so'z)
              </p>
            </div>
            <Badge variant="primary" size="sm">
              Book 1 - Book 6
            </Badge>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockStats.booksProgress.map((item) => (
            <div
              key={item.book}
              className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-slate-800 text-sm">{item.title}</span>
                <span
                  className="text-xs font-extrabold px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  {item.progress}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.progress}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Faol talabalar:</span>
                <span className="font-semibold text-slate-700">
                  {item.activeUsers.toLocaleString()} ta
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Launch & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Policies */}
        <Card
          className="lg:col-span-2"
          header={<h3 className="text-base font-bold text-slate-900">Loyiha Arxitekturasi & Hozirgi Holati</h3>}
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={16} />
              </span>
              <div>
                <p className="font-semibold text-slate-900">1-bosqich: Bepul va Reklamasiz jalb qilish</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Foydalanuvchilar sonini oshirish va ijobiy fikrlarni to'plash uchun Google AdMob va pullik to'siqlar hozircha butunlay o'chirilgan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="p-2 rounded-lg bg-brand-100 text-brand-700">
                <Sparkles size={16} />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Kinolar va Seriallardan Qisqa Parchalar (3-5 soniya)</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Har bir so'z uchun Harry Potter, Friends, Avengers va boshqa kinolardan aniq video fragmentlar kiritilgan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <span className="p-2 rounded-lg bg-accent-100 text-accent-700">
                <BookOpen size={16} />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Smart Cache & 15-20 MB Yengil O'lcham</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  4000 so'z matni ilovada lokal saqlanadi, internet yo'qligida ham bir zumda ochiladi.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Actions Card */}
        <Card header={<h3 className="text-base font-bold text-slate-900">Tezkor Amallar</h3>}>
          <div className="space-y-2.5">
            <Button
              variant="outline"
              className="w-full justify-start text-xs py-2.5"
              onClick={() => setCurrentTab('words')}
            >
              + Yangi so'z yoki dars qo'shish
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-xs py-2.5"
              onClick={() => setCurrentTab('notifications')}
            >
              🔔 Kreativ Push xabarnoma yuborish
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-xs py-2.5"
              onClick={() => setCurrentTab('users')}
            >
              👥 Foydalanuvchilarni bloklash / tahrirlash
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-xs py-2.5"
              onClick={() => setCurrentTab('monetization')}
            >
              ⚙️ Monetizatsiya parametrlarini o'zgartirish
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
