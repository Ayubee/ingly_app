import React, { useState } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  KeyRound,
  Edit,
  Shield,
  Crown,
  Flame,
  CheckCircle,
  Phone,
  Calendar,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import ToggleSwitch from '../components/common/ToggleSwitch';
import { mockUsers } from '../services/mockData';

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, blocked, premium
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Edit user state
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    phone: '',
    is_premium: false,
  });

  const [newPassword, setNewPassword] = useState('');

  const handleToggleBlock = (id) => {
    setUsers(
      users.map((u) => {
        if (u.id === id) {
          return { ...u, is_blocked: !u.is_blocked };
        }
        return u;
      })
    );
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name,
      username: user.username,
      phone: user.phone,
      is_premium: user.is_premium,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    setUsers(
      users.map((u) =>
        u.id === selectedUser.id ? { ...u, ...editForm } : u
      )
    );
    setIsEditModalOpen(false);
  };

  const openPasswordModal = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleSavePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      alert("Parol kamida 6 ta belgidan iborat bo'lishi kerak!");
      return;
    }
    alert(`Foydalanuvchi ${selectedUser.username} uchun yangi parol muvaffaqiyatli saqlandi.`);
    setIsPasswordModalOpen(false);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery);

    if (statusFilter === 'active') return matchesSearch && !u.is_blocked;
    if (statusFilter === 'blocked') return matchesSearch && u.is_blocked;
    if (statusFilter === 'premium') return matchesSearch && u.is_premium;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card padding="sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Ism, login yoki telefon orqali qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-inglyBorder rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {['all', 'active', 'blocked', 'premium'].map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer border ${
                  statusFilter === f
                    ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                    : 'bg-white text-slate-600 border-inglyBorder hover:bg-slate-50'
                }`}
              >
                {f === 'all'
                  ? 'Barchasi'
                  : f === 'active'
                  ? 'Faol'
                  : f === 'blocked'
                  ? 'Bloklangan'
                  : 'VIP / Premium'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-inglyBorder text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Foydalanuvchi</th>
                <th className="py-3.5 px-4">Aloqa & Login</th>
                <th className="py-3.5 px-4">O'rganish Progressi</th>
                <th className="py-3.5 px-4">Streak & Holat</th>
                <th className="py-3.5 px-4">Obuna</th>
                <th className="py-3.5 px-4">Ro'yxatdan o'tgan</th>
                <th className="py-3.5 px-4 text-right">Boshqaruv (Admin)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inglyBorder">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        alt={user.full_name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{user.full_name}</div>
                        <div className="text-xs text-slate-400 font-mono">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-xs font-semibold text-slate-800">@{user.username}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone size={12} className="text-slate-400" />
                      {user.phone}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="text-xs font-bold text-slate-900">
                      Book {user.current_book} • Unit {user.current_unit}
                    </div>
                    <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                      <CheckCircle size={12} />
                      {user.words_mastered} ta so'z yodlangan
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-bold text-xs">
                        <Flame size={13} className="text-orange-500" />
                        <span>{user.current_streak} kun</span>
                      </div>
                      {user.is_blocked ? (
                        <Badge variant="hard" size="sm">
                          Bloklangan
                        </Badge>
                      ) : (
                        <Badge variant="mastered" size="sm">
                          Faol
                        </Badge>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {user.is_premium ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                        <Crown size={12} className="text-amber-500" />
                        VIP
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Standart</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-xs text-slate-500">
                    <div>{user.created_at}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Oxirgi kirish: {user.last_login_at}</div>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Edit Details */}
                      <button
                        title="Ma'lumotlarni tahrirlash"
                        onClick={() => openEditModal(user)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                      >
                        <Edit size={16} />
                      </button>

                      {/* Change Password */}
                      <button
                        title="Parolni yangilash"
                        onClick={() => openPasswordModal(user)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <KeyRound size={16} />
                      </button>

                      {/* Ban / Unban Toggle */}
                      <button
                        title={user.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
                        onClick={() => handleToggleBlock(user.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          user.is_blocked
                            ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-rose-500 hover:bg-rose-50'
                        }`}
                      >
                        {user.is_blocked ? <UserCheck size={16} /> : <UserX size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit User Modal */}
      {selectedUser && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Foydalanuvchini tahrirlash: ${selectedUser.full_name}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button variant="primary" onClick={handleSaveEdit}>
                O'zgarishlarni Saqlash
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ism va Familiya</label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username (Login)</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telefon Raqami</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <ToggleSwitch
                checked={editForm.is_premium}
                onChange={(val) => setEditForm({ ...editForm, is_premium: val })}
                label="Ingly VIP / Premium obunachi"
                description="Ushbu foydalanuvchiga barcha 6 ta kitob va offline xizmatlarga to'liq kirish huquqini berish."
                activeColor="bg-amber-500"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Change Password Modal */}
      {selectedUser && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title={`Parolni o'zgartirish: @${selectedUser.username}`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setIsPasswordModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button variant="danger" onClick={handleSavePassword}>
                Parolni Yangilash
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Admin sifatida siz foydalanuvchi parolini qayta tiklashingiz yoki yangi vaqtinchalik parol tayinlashingiz mumkin.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Yangi Parol (Kamida 6 belgi)</label>
              <input
                type="password"
                placeholder="Yangi kuchli parol kiriting"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
