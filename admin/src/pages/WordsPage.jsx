import React, { useState } from 'react';
import {
  Search,
  Plus,
  Volume2,
  Video,
  Image as ImageIcon,
  Edit2,
  Trash2,
  Download,
  Upload,
  ExternalLink,
  Film,
  Check,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import { mockWords } from '../services/mockData';
import { booksConfig } from '../../../shared/theme.js';

export default function WordsPage() {
  const [selectedBook, setSelectedBook] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [words, setWords] = useState(mockWords);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeVideoModal, setActiveVideoModal] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  // New Word Form State
  const [formData, setFormData] = useState({
    word: '',
    phonetic: '',
    pos: 'noun',
    uzbek: '',
    definition: '',
    definition_uz: '',
    example: '',
    example_uz: '',
    image_url: '',
    audio_url: '',
    video_clip_url: '',
    movie_title: '',
  });

  const handlePlayAudio = (id) => {
    setPlayingAudioId(id);
    setTimeout(() => {
      setPlayingAudioId(null);
    }, 1200);
  };

  const handleAddWord = (e) => {
    e.preventDefault();
    if (!formData.word || !formData.uzbek) return;

    const newWord = {
      id: Date.now(),
      book: selectedBook,
      unit: selectedUnit,
      ...formData,
    };

    setWords([newWord, ...words]);
    setIsAddModalOpen(false);
    setFormData({
      word: '',
      phonetic: '',
      pos: 'noun',
      uzbek: '',
      definition: '',
      definition_uz: '',
      example: '',
      example_uz: '',
      image_url: '',
      audio_url: '',
      video_clip_url: '',
      movie_title: '',
    });
  };

  const handleDelete = (id) => {
    if (window.confirm("Rostdan ham ushbu so'zni o'chirmoqchimisiz?")) {
      setWords(words.filter((w) => w.id !== id));
    }
  };

  const filteredWords = words.filter((w) => {
    const matchesSearch =
      w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.uzbek.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls: Books tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {booksConfig.map((b) => (
          <button
            key={b.book}
            onClick={() => setSelectedBook(b.book)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all duration-150 cursor-pointer flex items-center gap-2 border ${
              selectedBook === b.book
                ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-500/20'
                : 'bg-white text-slate-700 border-inglyBorder hover:bg-slate-50'
            }`}
          >
            <span>Book {b.book}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                selectedBook === b.book ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {b.badgeText}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and Action Bar */}
      <Card padding="sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Unit selector & search */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <span className="text-xs font-bold text-slate-500 pl-2">Unit:</span>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(Number(e.target.value))}
                className="bg-white border-none rounded-lg text-xs font-bold text-slate-800 px-3 py-1.5 focus:ring-0 cursor-pointer"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((u) => (
                  <option key={u} value={u}>
                    Unit {u} ({u * 20 - 19}-{u * 20})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-12 text-slate-400 w-4 h-4 -translate-y-2" />
              <input
                type="text"
                placeholder="So'z yoki tarjima qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-inglyBorder rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              icon={Upload}
              onClick={() => alert("Excel/JSON import mexanizmi tayyorlanmoqda...")}
            >
              Import JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Download}
              onClick={() => alert("Book " + selectedBook + " so'zlari eksport qilindi.")}
            >
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsAddModalOpen(true)}
            >
              Yangi So'z Qo'shish
            </Button>
          </div>
        </div>
      </Card>

      {/* Words Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-inglyBorder text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">Inglizcha So'z</th>
                <th className="py-3.5 px-4">Turkumi</th>
                <th className="py-3.5 px-4">O'zbekcha Ma'nosi</th>
                <th className="py-3.5 px-4">Inglizcha Ta'rif & Misol</th>
                <th className="py-3.5 px-4 text-center">Multimedia (Audio/Kino)</th>
                <th className="py-3.5 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-inglyBorder">
              {filteredWords.map((word, idx) => (
                <tr key={word.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">{word.word}</span>
                      <span className="text-xs text-slate-400 font-mono">{word.phonetic}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant="accent" size="sm" className="capitalize">
                      {word.pos}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {word.uzbek}
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="text-xs text-slate-600 line-clamp-1 italic">
                      "{word.definition}"
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      Misol: {word.example}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {/* Audio Button */}
                      <button
                        title="Ovozni tinglash"
                        onClick={() => handlePlayAudio(word.id)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          playingAudioId === word.id
                            ? 'bg-emerald-500 text-white border-emerald-500 scale-110'
                            : 'bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-600 border-slate-200'
                        }`}
                      >
                        <Volume2 size={16} />
                      </button>

                      {/* Video Clip Button */}
                      {word.video_clip_url && (
                        <button
                          title={`Kino parchasini ko'rish (${word.movie_title || 'Clip'})`}
                          onClick={() => setActiveVideoModal(word)}
                          className="p-1.5 rounded-lg bg-indigo-50 text-brand-600 border border-brand-200 hover:bg-brand-100 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <Film size={14} />
                          <span className="hidden lg:inline">3s Clip</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Tahrirlash"
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        title="O'chirish"
                        onClick={() => handleDelete(word.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Word Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yangi So'z Qo'shish (4000 Essential English Words)"
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button variant="primary" onClick={handleAddWord}>
              Saqlash va Qo'shish
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inglizcha So'z *</label>
              <input
                type="text"
                placeholder="masalan: Afraid"
                value={formData.word}
                onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transkripsiya (IPA)</label>
              <input
                type="text"
                placeholder="/əˈfreɪd/"
                value={formData.phonetic}
                onChange={(e) => setFormData({ ...formData, phonetic: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">So'z Turkumi</label>
              <select
                value={formData.pos}
                onChange={(e) => setFormData({ ...formData, pos: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none font-medium"
              >
                <option value="noun">Noun (Ot)</option>
                <option value="verb">Verb (Fe'l)</option>
                <option value="adjective">Adjective (Sifat)</option>
                <option value="adverb">Adverb (Ravish)</option>
                <option value="preposition">Preposition (Predlog)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">O'zbekcha Aniq Tarjimasi *</label>
            <input
              type="text"
              placeholder="Qo'rqqan"
              value={formData.uzbek}
              onChange={(e) => setFormData({ ...formData, uzbek: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inglizcha Ta'rif</label>
              <textarea
                rows={2}
                placeholder="When someone is afraid, they feel fear."
                value={formData.definition}
                onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">O'zbekcha Ta'rif</label>
              <textarea
                rows={2}
                placeholder="Biror kimsa qo'rqqanda, u xavf yoki vahimani his qiladi."
                value={formData.definition_uz}
                onChange={(e) => setFormData({ ...formData, definition_uz: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inglizcha Misol Gap</label>
              <textarea
                rows={2}
                placeholder="The woman was afraid of what she saw."
                value={formData.example}
                onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Misolning O'zbekcha Tarjimasi</label>
              <textarea
                rows={2}
                placeholder="Ayol ko'rgan narsasidan qo'rqib ketdi."
                value={formData.example_uz}
                onChange={(e) => setFormData({ ...formData, example_uz: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rasm URL (WebP)</label>
              <input
                type="text"
                placeholder="https://.../word.webp"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Audio URL (MP3)</label>
              <input
                type="text"
                placeholder="https://.../word.mp3"
                value={formData.audio_url}
                onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kino Lavhasi (MP4)</label>
              <input
                type="text"
                placeholder="Harry Potter / Friends..."
                value={formData.video_clip_url}
                onChange={(e) => setFormData({ ...formData, video_clip_url: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-inglyBorder bg-slate-50 focus:bg-white focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Video Clip Modal Preview */}
      {activeVideoModal && (
        <Modal
          isOpen={!!activeVideoModal}
          onClose={() => setActiveVideoModal(null)}
          title={`Kino Konteksti: "${activeVideoModal.word}"`}
          maxWidth="max-w-lg"
          footer={
            <Button variant="outline" onClick={() => setActiveVideoModal(null)}>
              Yopish
            </Button>
          }
        >
          <div className="space-y-4 text-center">
            <div className="aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
              <Film size={48} className="text-brand-400 mb-3 animate-pulse" />
              <p className="font-bold text-lg">{activeVideoModal.movie_title || 'Film epizodi'}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                "{activeVideoModal.example}"
              </p>
              <div className="absolute bottom-3 left-4 text-[11px] bg-white/20 px-2 py-0.5 rounded font-mono">
                00:03 / 00:05 WebM HD
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Ushbu 3-5 soniyalik hissiy kino lavhalari o'quvchiga so'zni xotirada mustahkam saqlashga yordam beradi.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
