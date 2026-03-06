// src/pages/TutorsPage.tsx
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';
import { useTheme } from '../context/ThemeContext';
import EditDeleteButtons from '../components/ui/EditDeleteButtons';
import DatePickerField from '../components/ui/AppDatePicker';
import {
  Users, Search, UserPlus, ChevronLeft, ChevronRight,
  User, Phone, Mail, Calendar, Hash, GraduationCap, X, Loader2,
} from 'lucide-react';

type TutorRow = {
  id: string; school_id: string; full_name: string;
  date_of_birth: string | null; afm: string | null;
  phone: string | null; email: string | null; created_at: string;
};
type ModalMode = 'create' | 'edit';
type TutorFormState = { fullName: string; dateOfBirth: string; afm: string; phone: string; email: string };

const emptyForm: TutorFormState = { fullName: '', dateOfBirth: '', afm: '', phone: '', email: '' };
const TUTOR_SELECT = 'id, school_id, full_name, date_of_birth, afm, phone, email, created_at';

function formatDateToGreek(dateStr: string | null): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
function isoToDisplay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
function displayToIso(display: string): string {
  if (!display) return '';
  const parts = display.split(/[\/\-\.]/);
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  if (!d || !m || !y) return '';
  return `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`;
}
function normalizeText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function FormField({ label, icon, children, isDark }: {
  label: string; icon?: React.ReactNode; children: React.ReactNode; isDark: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TutorsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const schoolId = profile?.school_id ?? null;

  const [tutors, setTutors] = useState<TutorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingTutor, setEditingTutor] = useState<TutorRow | null>(null);
  const [form, setForm] = useState<TutorFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);

  const [deleteTarget, setDeleteTarget] = useState<TutorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase.from('tutors').select(TUTOR_SELECT).eq('school_id', schoolId).order('full_name', { ascending: true });
      if (error) { console.error(error); setError('Αποτυχία φόρτωσης καθηγητών.'); }
      else { setTutors((data ?? []) as TutorRow[]); }
      setLoading(false);
    };
    load();
  }, [schoolId]);

  const resetForm = () => setForm(emptyForm);
  const openCreateModal = () => { resetForm(); setError(null); setModalMode('create'); setEditingTutor(null); setModalOpen(true); };
  const openEditModal = (row: TutorRow) => {
    setError(null); setModalMode('edit'); setEditingTutor(row);
    setForm({ fullName: row.full_name ?? '', dateOfBirth: row.date_of_birth ? isoToDisplay(row.date_of_birth) : '', afm: row.afm ?? '', phone: row.phone ?? '', email: row.email ?? '' });
    setModalOpen(true);
  };
  const closeModal = () => { if (saving) return; setModalOpen(false); setEditingTutor(null); setModalMode('create'); resetForm(); };
  const handleFormChange = (field: keyof TutorFormState) => (e: ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!schoolId) { setError('Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο.'); return; }
    const fullNameTrimmed = form.fullName.trim();
    if (!fullNameTrimmed) return;
    setSaving(true); setError(null);
    const payload = { school_id: schoolId, full_name: fullNameTrimmed, date_of_birth: displayToIso(form.dateOfBirth) || null, afm: form.afm.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null };
    if (modalMode === 'create') {
      const { data, error } = await supabase.from('tutors').insert(payload).select(TUTOR_SELECT).maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία δημιουργίας καθηγητή.'); return; }
      setTutors((prev) => [...prev, data as TutorRow]); closeModal();
    } else if (modalMode === 'edit' && editingTutor) {
      const { data, error } = await supabase.from('tutors').update({ full_name: payload.full_name, date_of_birth: payload.date_of_birth, afm: payload.afm, phone: payload.phone, email: payload.email }).eq('id', editingTutor.id).eq('school_id', schoolId).select(TUTOR_SELECT).maybeSingle();
      setSaving(false);
      if (error || !data) { console.error(error); setError('Αποτυχία ενημέρωσης καθηγητή.'); return; }
      setTutors((prev) => prev.map((t) => (t.id === editingTutor.id ? (data as TutorRow) : t))); closeModal();
    } else { setSaving(false); }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !schoolId) return;
    setDeleting(true); setError(null);
    const { error } = await supabase.from('tutors').delete().eq('id', deleteTarget.id).eq('school_id', schoolId);
    setDeleting(false);
    if (error) { console.error(error); setError('Αποτυχία διαγραφής καθηγητή.'); return; }
    setTutors((prev) => prev.filter((t) => t.id !== deleteTarget.id)); setDeleteTarget(null);
  };

  const filteredTutors = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return tutors;
    return tutors.filter((t) => {
      const composite = [t.full_name, t.afm, t.phone, t.email, t.date_of_birth, t.date_of_birth ? formatDateToGreek(t.date_of_birth) : ''].filter(Boolean).join(' ');
      return normalizeText(composite).includes(q);
    });
  }, [tutors, search]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredTutors.length / pageSize)), [filteredTutors.length]);
  useEffect(() => { setPage((p) => Math.min(Math.max(1, p), pageCount)); }, [pageCount]);
  const pagedTutors = useMemo(() => { const start = (page - 1) * pageSize; return filteredTutors.slice(start, start + pageSize); }, [filteredTutors, page]);
  const showingFrom = filteredTutors.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, filteredTutors.length);

  // ── Style helpers ──
  const cardCls = `overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md ring-1 ring-inset ${isDark ? 'border-slate-700/50 bg-slate-950/40 ring-white/[0.04]' : 'border-slate-200 bg-white/80 ring-black/[0.02]'}`;
  const inputCls = `h-9 w-full rounded-lg border px-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400'}`;
  const searchInputCls = `h-9 w-full rounded-lg border pl-9 pr-3 text-xs outline-none transition focus:ring-1 focus:ring-[color:var(--color-accent)]/30 focus:border-[color:var(--color-accent)] sm:w-52 ${isDark ? 'border-slate-700/70 bg-slate-900/60 text-slate-100 placeholder-slate-500' : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400'}`;
  const theadRowCls = `border-b ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
  const tbodyDivideCls = `divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`;
  const trHoverCls = `group transition-colors ${isDark ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}`;
  const modalBg = isDark ? 'border-slate-700/60 bg-[#1f2d3d]' : 'border-slate-200 bg-white';
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}`;
  const closeBtnCls = `flex h-7 w-7 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200' : 'border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
  const paginationBtnCls = `inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
  const paginationFooterCls = `flex items-center justify-between gap-3 border-t px-5 py-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;
  const modalFooterCls = `flex justify-end gap-2.5 border-t px-6 py-4 mt-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;

  return (
    <div className="space-y-6 px-1">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, transparent))' }}>
            <Users className="h-4.5 w-4.5" style={{ color: 'var(--color-input-bg)' }} />
          </div>
          <div>
            <h1 className={`text-base font-semibold tracking-tight ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Καθηγητές</h1>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Διαχείριση καθηγητών και στοιχείων επικοινωνίας.</p>
            {schoolId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-800/50 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                  <Users className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  {tutors.length} σύνολο
                </span>
                {search.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)' }}>
                    <Search className="h-3 w-3" />
                    {filteredTutors.length} αποτελέσματα
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
          <div className="relative">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input className={searchInputCls} placeholder="Αναζήτηση καθηγητή..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button type="button" onClick={openCreateModal}
            className="btn-primary h-9 gap-2 px-4 font-semibold shadow-sm hover:brightness-110 active:scale-[0.98]">
            <UserPlus className="h-3.5 w-3.5" />
            Προσθήκη καθηγητή
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-400" />{error}
        </div>
      )}
      {!schoolId && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs backdrop-blur ${isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
          Το προφίλ σας δεν είναι συνδεδεμένο με σχολείο (school_id είναι null).
        </div>
      )}

      {/* ── Table card ── */}
      <div className={cardCls}>
        {loading ? (
          <div className={`space-y-0 divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
                <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`h-3 w-20 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
                <div className={`h-3 w-24 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
                <div className={`h-3 w-28 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/50'}`} />
              </div>
            ))}
          </div>
        ) : tutors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Users className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη καθηγητές</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη καθηγητή» για να δημιουργήσετε τον πρώτο.</p>
            </div>
          </div>
        ) : filteredTutors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
              <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν καθηγητές</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className={theadRowCls}>
                  {[
                    { icon: <User className="h-3 w-3" />, label: 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ' },
                    { icon: <Calendar className="h-3 w-3" />, label: 'ΗΜ. ΓΕΝΝΗΣΗΣ' },
                    { icon: <Hash className="h-3 w-3" />, label: 'ΑΦΜ' },
                    { icon: <Phone className="h-3 w-3" />, label: 'ΤΗΛΕΦΩΝΟ' },
                    { icon: <Mail className="h-3 w-3" />, label: 'EMAIL' },
                  ].map(({ icon, label }) => (
                    <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
                      <span className="inline-flex items-center gap-1.5"><span className="opacity-60">{icon}</span>{label}</span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>ΕΝΕΡΓΕΙΕΣ</th>
                </tr>
              </thead>
              <tbody className={tbodyDivideCls}>
                {pagedTutors.map((t) => (
                  <tr key={t.id} className={trHoverCls}>
                    <td className="px-5 py-3.5">
                      <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>{t.full_name}</span>
                    </td>
                    <td className={`px-5 py-3.5 tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.date_of_birth ? formatDateToGreek(t.date_of_birth) : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {t.afm
                        ? <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] tabular-nums ${isDark ? 'border-slate-600/50 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{t.afm}</span>
                        : <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                    </td>
                    <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.phone || <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                    </td>
                    <td className={`px-5 py-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t.email || <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <EditDeleteButtons onEdit={() => openEditModal(t)} onDelete={() => { setError(null); setDeleteTarget(t); }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredTutors.length > 0 && (
          <div className={paginationFooterCls}>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{showingFrom}–{showingTo}</span>{' '}
              από <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{filteredTutors.length}</span> καθηγητές
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className={`rounded-lg border px-3 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-900/20 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
                <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
                <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>/</span>
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
              </div>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 30%, transparent))' }} />

            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
                  <GraduationCap className="h-4 w-4" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div>
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>
                    {modalMode === 'create' ? 'Νέος καθηγητής' : 'Επεξεργασία καθηγητή'}
                  </h2>
                  {modalMode === 'edit' && editingTutor && (
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{editingTutor.full_name}</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={closeModal} className={closeBtnCls}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {error && (
              <div className={`mx-6 mb-3 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${isDark ? 'border-red-500/30 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-6 pb-2">
                <FormField label="Ονοματεπώνυμο" icon={<User className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} placeholder="π.χ. Γιάννης Παπαδόπουλος" value={form.fullName} onChange={handleFormChange('fullName')} required />
                </FormField>
                <FormField label="Ημερομηνία γέννησης" icon={<Calendar className="h-3 w-3" />} isDark={isDark}>
                  <DatePickerField label="" value={form.dateOfBirth} onChange={(value) => setForm((prev) => ({ ...prev, dateOfBirth: value }))} placeholder="π.χ. 24/12/1985" id="tutor-dob" />
                </FormField>
                <FormField label="ΑΦΜ" icon={<Hash className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} placeholder="π.χ. 123456789" value={form.afm} onChange={handleFormChange('afm')} />
                </FormField>
                <FormField label="Τηλέφωνο" icon={<Phone className="h-3 w-3" />} isDark={isDark}>
                  <input className={inputCls} placeholder="π.χ. 6900000000" value={form.phone} onChange={handleFormChange('phone')} />
                </FormField>
                <FormField label="Email" icon={<Mail className="h-3 w-3" />} isDark={isDark}>
                  <input type="email" className={inputCls} placeholder="π.χ. tutor@example.com" value={form.email} onChange={handleFormChange('email')} />
                </FormField>
              </div>

              <div className={modalFooterCls}>
                <button type="button" onClick={closeModal} disabled={saving} className={cancelBtnCls}>Ακύρωση</button>
                <button type="submit" disabled={saving}
                  className="btn-primary gap-1.5 px-4 py-1.5 font-semibold shadow-sm hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
                  {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Αποθήκευση...</> : modalMode === 'create' ? 'Αποθήκευση' : 'Ενημέρωση'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
            <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-500" />
            <div className="p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-500/30">
                <Users className="h-5 w-5 text-red-400" />
              </div>
              <h3 className={`mb-1 text-sm font-semibold ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>Διαγραφή καθηγητή</h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Σίγουρα θέλετε να διαγράψετε τον καθηγητή{' '}
                <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>«{deleteTarget.full_name}»</span>;
                {' '}Η ενέργεια αυτή δεν μπορεί να ανακληθεί.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button type="button" onClick={() => { if (!deleting) setDeleteTarget(null); }} disabled={deleting} className={cancelBtnCls}>Ακύρωση</button>
                <button type="button" onClick={handleConfirmDelete} disabled={deleting}
                  className="btn bg-red-600 px-4 py-1.5 font-semibold text-white shadow-sm hover:bg-red-500 active:scale-[0.97] disabled:opacity-60">
                  {deleting ? 'Διαγραφή…' : 'Διαγραφή'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}