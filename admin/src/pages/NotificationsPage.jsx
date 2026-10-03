import React, { useState } from 'react';
import {
  Bell,
  Send,
  Flame,
  Coffee,
  Clock,
  Sparkles,
  Smartphone,
  CheckCircle,
  Users,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { mockPushTemplates } from '../services/mockData';

export default function NotificationsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState(mockPushTemplates[0]);
  const [customTitle, setCustomTitle] = useState(mockPushTemplates[0].title);
  const [customBody, setCustomBody] = useState(mockPushTemplates[0].body);
  const [targetAudience, setTargetAudience] = useState('all');
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setCustomTitle(tpl.title);
    setCustomBody(tpl.body);
  };

  const handleSendPush = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-8">
      {/* Intro Header */}
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 font-display">
          Kreativ Push Bildirishnomalar Markazi
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          TZ.txt 4.6 bo'limida belgilangan do'stona va odamiy eslatmalar bilan o'quvchilarni ilovaga qaytaring.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Push Composer & Templates (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Templates list */}
          <Card header={<h4 className="font-bold text-slate-900 text-sm">TZ.txt Standart Shablonlari</h4>}>
            <div className="space-y-2.5">
              {mockPushTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedTemplate.id === tpl.id
                      ? 'bg-brand-50 border-brand-400 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200/80 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">{tpl.title}</span>
                    <Badge variant="accent" size="sm">
                      {tpl.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{tpl.body}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Composer Form */}
          <Card header={<h4 className="font-bold text-slate-900 text-sm">Xabarni Tahrirlash va Yuborish</h4>}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xabar Sarlavhasi</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xabar Matni</label>
                <textarea
                  rows={3}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Maqsadli Auditoriya (Segment)
                </label>
                <select
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 font-bold"
                >
                  <option value="all">Barcha foydalanuvchilar (14,850 ta)</option>
                  <option value="streak_risk">Streak'i uzilish arafasidagilar (bugun kirmaganlar - 2,410 ta)</option>
                  <option value="inactive_3d">3 kundan beri dars qilmaganlar (1,120 ta)</option>
                  <option value="book_finishers">Book 1 ni tugatgan yangilar (850 ta)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  FCM / APNs orqali darhol yetkaziladi
                </span>
                <Button
                  variant="primary"
                  size="md"
                  icon={Send}
                  disabled={isSending}
                  onClick={handleSendPush}
                >
                  {isSending ? 'Yuborilmoqda...' : 'Hozir Yuborish'}
                </Button>
              </div>

              {sentSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span>Xabarnoma tanlangan auditoriyaga muvaffaqiyatli jo'natildi!</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Phone Live Preview Mockup (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone size={16} /> Foydalanuvchi Ekranidagi Jonli Ko'rinishi
          </p>

          {/* Smartphone Frame */}
          <div className="w-[310px] h-[580px] bg-slate-900 rounded-[44px] p-4 shadow-2xl border-4 border-slate-800 relative flex flex-col justify-between overflow-hidden">
            {/* Dynamic Island / Notch */}
            <div className="w-24 h-4 bg-black rounded-full mx-auto mb-4" />

            {/* Lock screen clock */}
            <div className="text-center text-white/90 my-auto -mt-6">
              <div className="text-5xl font-extralight tracking-tight font-sans">09:41</div>
              <div className="text-xs font-medium text-slate-300 mt-1">Shanba, 3-Oktyabr</div>

              {/* Push Notification Card Bubble */}
              <div className="mt-8 mx-1 bg-white/80 backdrop-blur-md rounded-2xl p-3.5 text-left shadow-lg border border-white/40 text-slate-900 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-brand-500 flex items-center justify-center text-white text-[10px] font-extrabold">
                      I
                    </div>
                    <span className="font-extrabold text-[11px] text-slate-800">INGLY</span>
                  </div>
                  <span className="text-[10px] text-slate-500">hozirgina</span>
                </div>
                <h5 className="font-bold text-xs text-slate-900 leading-snug">{customTitle}</h5>
                <p className="text-[11px] text-slate-700 mt-1 leading-snug">{customBody}</p>
              </div>
            </div>

            {/* Bottom swipe bar */}
            <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mb-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
