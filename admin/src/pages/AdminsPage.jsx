import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Key,
  Trash2,
  Edit,
  Check,
  Shield,
  Lock,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { mockAdmins } from '../services/mockData';

export default function AdminsPage() {
  const [admins, setAdmins] = useState(mockAdmins);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  const availablePermissions = [
    { key: 'manage_words', label: "So'zlar va darslarni tahrirlash (CRUD)", group: 'Kontent' },
    { key: 'manage_users', label: 'Foydalanuvchilarni ko\'rish, tahrirlash va bloklash', group: 'Foydalanuvchi' },
    { key: 'manage_admins', label: 'Yangi admin qo\'shish va boshqarish (Faqat Super Admin)', group: 'Xavfsizlik' },
    { key: 'view_stats', label: 'Statistika va analitika hisobotlarini ko\'rish', group: 'Tahlil' },
    { key: 'send_push', label: 'Push-bildirishnomalar yuborish', group: 'Marketing' },
    { key: 'manage_settings', label: 'Monetizatsiya va tizim sozlamalarini boshqarish', group: 'Tizim' },
  ];

  const [newAdminForm, setNewAdminForm] = useState({
    full_name: '',
    username: '',
    role: 'editor',
    permissions: ['manage_words', 'view_stats'],
  });

  const handleTogglePermission = (permKey) => {
    if (newAdminForm.permissions.includes(permKey)) {
      setNewAdminForm({
        ...newAdminForm,
        permissions: newAdminForm.permissions.filter((p) => p !== permKey),
      });
    } else {
      setNewAdminForm({
        ...newAdminForm,
        permissions: [...newAdminForm.permissions, permKey],
      });
    }
  };

  const handleAddAdmin = (e) => {
    e.preventDefault();
    if (!newAdminForm.full_name || !newAdminForm.username) return;

    const newAdmin = {
      id: `adm-${Date.now()}`,
      full_name: newAdminForm.full_name,
      username: newAdminForm.username,
      role: newAdminForm.role,
      role_label:
        newAdminForm.role === 'super_admin'
          ? 'Super Admin'
          : newAdminForm.role === 'editor'
          ? 'Kontent Menejer'
          : 'Moderator',
      permissions: newAdminForm.permissions,
      is_active: true,
    };

    setAdmins([...admins, newAdmin]);
    setIsAddModalOpen(false);
    setNewAdminForm({
      full_name: '',
      username: '',
      role: 'editor',
      permissions: ['manage_words', 'view_stats'],
    });
  };

  const handleDeleteAdmin = (id) => {
    if (window.confirm("Haqiqatan ham bu adminni tizimdan o'chirmoqchimisiz?")) {
      setAdmins(admins.filter((a) => a.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Adminlar va Rollar Boshqaruvi (RBAC)
            </h3>
            <p className="text-xs text-slate-500">
              Har bir admin uchun faqat kerakli bo'limlarga ruxsat berish orqali xavfsizlikni ta'minlang.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={UserPlus}
            onClick={() => setIsAddModalOpen(true)}
          >
            Yangi Admin Qo'shish
          </Button>
        </div>
      </Card>

      {/* Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {admins.map((admin) => (
          <Card key={admin.id} padding="default" className="relative flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                      admin.role === 'super_admin'
                        ? 'bg-gradient-to-tr from-brand-600 to-indigo-600'
                        : admin.role === 'moderator'
                        ? 'bg-gradient-to-tr from-sky-500 to-accent-500'
                        : 'bg-gradient-to-tr from-emerald-500 to-teal-600'
                    }`}
                  >
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{admin.full_name}</h4>
                    <p className="text-xs text-slate-400 font-mono">@{admin.username}</p>
                  </div>
                </div>

                <Badge
                  variant={admin.role === 'super_admin' ? 'primary' : 'accent'}
                  size="sm"
                >
                  {admin.role_label}
                </Badge>
              </div>

              {/* Permissions List */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Biriktirilgan Ruxsatlar ({admin.permissions.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {admin.permissions.map((p) => {
                    const match = availablePermissions.find((ap) => ap.key === p);
                    return (
                      <span
                        key={p}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200"
                      >
                        ✓ {match ? match.label.split('(')[0] : p}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
            {admin.role !== 'super_admin' && (
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-50"
                  icon={Trash2}
                  onClick={() => handleDeleteAdmin(admin.id)}
                >
                  O'chirish
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add Admin Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yangi Admin Tayinlash"
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={handleAddAdmin}>
              Adminni Saqlash
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">To'liq Ism *</label>
            <input
              type="text"
              placeholder="masalan: Sardor Rustamov"
              value={newAdminForm.full_name}
              onChange={(e) => setNewAdminForm({ ...newAdminForm, full_name: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Login (Username) *</label>
              <input
                type="text"
                placeholder="sardor_editor"
                value={newAdminForm.username}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Roli</label>
              <select
                value={newAdminForm.role}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, role: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 font-medium"
              >
                <option value="editor">Kontent Menejer (Editor)</option>
                <option value="moderator">Moderator</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Beriladigan Huquqlar (Permissions)
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {availablePermissions.map((perm) => {
                const isChecked = newAdminForm.permissions.includes(perm.key);
                return (
                  <label
                    key={perm.key}
                    onClick={() => handleTogglePermission(perm.key)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-brand-50/50 border-brand-300 text-brand-900 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="rounded text-brand-500 focus:ring-0"
                    />
                    <span>{perm.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
