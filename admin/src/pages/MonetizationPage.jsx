import React, { useState } from 'react';
import {
  DollarSign,
  Tv,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Save,
  Info,
  Shield,
  Smartphone,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import ToggleSwitch from '../components/common/ToggleSwitch';
import { mockFeatureFlags } from '../services/mockData';

export default function MonetizationPage() {
  const [settings, setSettings] = useState(mockFeatureFlags);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8">
      {/* Overview Alert */}
      <div className="p-5 rounded-2xl bg-sky-50 border border-sky-200 flex items-start gap-3">
        <Info className="text-sky-600 mt-0.5 shrink-0" size={20} />
        <div className="text-sm">
          <p className="font-bold text-sky-900">
            Hozirgi Bosqich: 100% Bepul va Reklamasiz Strategiya
          </p>
          <p className="text-sky-700 text-xs mt-1 leading-relaxed">
            TZ.txt 10-bandiga muvofiq, loyihaning dastlabki bosqichida barcha foydalanuvchilar uchun 6 ta kitob va barcha testlar bepul va reklamasiz ishlaydi. Quyidagi switchlar kelgusida bitta bosish bilan monetizatsiyani darhol yoqish imkonini beradi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* AdMob Configuration */}
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-brand-600">
                  <Tv size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Google AdMob Reklamalari</h3>
                  <p className="text-xs text-slate-500">Banner va Interstitial (so'zlar orasida)</p>
                </div>
              </div>
              <Badge variant={settings.adsEnabled ? 'streak' : 'muted'} size="sm">
                {settings.adsEnabled ? 'FAOL (ON)' : 'O\'CHIQ (OFF)'}
              </Badge>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <ToggleSwitch
                checked={settings.adsEnabled}
                onChange={(checked) => setSettings({ ...settings, adsEnabled: checked })}
                label="Mobil ilovada Google AdMob reklamalarini yoqish"
                description="Yoqilganida, foydalanuvchilar dars va testlar o'rtasida nozik banner hamda video reklamalarni ko'rishadi."
                activeColor="bg-brand-500"
              />
            </div>

            {settings.adsEnabled ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle size={15} /> Diqqat: Reklamalar yoqildi
                </p>
                <p>
                  Ilovada avtomatik tarzda Google AdMob App ID va Unit ID kodlari orqali reklamalar yuklanishi boshlanadi.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Reklamasiz toza ta'lim tajribasi
                </p>
                <p className="mt-1">
                  Hech qanday reklama ko'rsatilmaydi. Ilova maksimal tezlik va qulaylikda ishlaydi.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Premium / VIP Configuration */}
        <Card
          header={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Ingly Premium / VIP Obuna</h3>
                  <p className="text-xs text-slate-500">Pullik rejim va kitoblar taqsimoti</p>
                </div>
              </div>
              <Badge variant={settings.premiumModeEnabled ? 'warning' : 'muted'} size="sm">
                {settings.premiumModeEnabled ? 'FAOL (ON)' : 'O\'CHIQ (OFF)'}
              </Badge>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <ToggleSwitch
                checked={settings.premiumModeEnabled}
                onChange={(checked) => setSettings({ ...settings, premiumModeEnabled: checked })}
                label="Pullik Obuna Tizimini (Paywall) yoqish"
                description="Yoqilganda, belgilangan sondan keyingi kitoblar faqat VIP foydalanuvchilar uchun ochiladi."
                activeColor="bg-amber-500"
              />
            </div>

            {/* Sub-settings if premium enabled */}
            <div className={`space-y-4 transition-all duration-200 ${!settings.premiumModeEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bepul Kitoblar Soni (Qolganlari Pullik)
                </label>
                <select
                  value={settings.freeBooksCount}
                  onChange={(e) => setSettings({ ...settings, freeBooksCount: Number(e.target.value) })}
                  className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 font-bold"
                >
                  <option value={1}>Faqat Book 1 bepul (Book 2-6 pullik)</option>
                  <option value={2}>Book 1 va Book 2 bepul (Book 3-6 pullik)</option>
                  <option value={3}>Book 1, 2 va 3 bepul (Book 4-6 pullik)</option>
                  <option value={6}>Barcha 6 ta kitob bepul</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Oylik Obuna (UZS)
                  </label>
                  <input
                    type="number"
                    value={settings.monthlyPriceUzs}
                    onChange={(e) => setSettings({ ...settings, monthlyPriceUzs: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Yillik Obuna (UZS)
                  </label>
                  <input
                    type="number"
                    value={settings.yearlyPriceUzs}
                    onChange={(e) => setSettings({ ...settings, yearlyPriceUzs: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Settings Bar */}
      <div className="p-6 rounded-2xl bg-white border border-inglyBorder flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Shield className="text-brand-500" size={24} />
          <div>
            <h4 className="font-bold text-slate-900 text-sm">O'zgarishlarni darhol kuchga kiritish</h4>
            <p className="text-xs text-slate-500">
              Parametrlar saqlangach, mobil ilovalar navbatdagi so'rovda yangi konfiguratsiyani oladi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSaved && (
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 size={16} /> Muvaffaqiyatli saqlandi!
            </span>
          )}
          <Button variant="primary" size="md" icon={Save} onClick={handleSave}>
            Sozlamalarni Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
