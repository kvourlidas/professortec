import { useRef, useState } from 'react';
import {
  X, FileSpreadsheet, Download, Upload, Loader2,
  AlertCircle, XCircle, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { ModalErrorBox } from '../ui/ModalField.tsx';
import type { TutorRow, SpecialtyRow } from './types.ts';
import { normalizeText } from './utils.ts';
import { downloadTutorImportTemplate } from './importTutorsShared.ts';
import { parseTutorImportFile, type ParsedTutorRow } from './parseTutorImportFile.ts';

type Step = 'select' | 'preview' | 'importing' | 'done';

type RowResult = { rowNumber: number; full_name: string; status: 'success' | 'failed'; message?: string };

export type TutorImportResult = {
  tutors: TutorRow[];
  newSpecialties: SpecialtyRow[];
  links: { tutorId: string; specialties: SpecialtyRow[] }[];
};

interface Props {
  schoolId: string;
  specialties: SpecialtyRow[];
  onImported: (result: TutorImportResult) => void;
  onClose: () => void;
}

export default function TutorImportModal({ schoolId, specialties, onImported, onClose }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedTutorRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [templateBusy, setTemplateBusy] = useState(false);

  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeToClose(step !== 'importing', onClose);

  const modalBg = isDark ? 'border-slate-700/60 bg-slate-900' : 'border-slate-200 bg-white';
  const cancelBtnCls = `btn border px-4 py-1.5 disabled:opacity-50 ${isDark ? 'border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/60' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`;
  const rowBorderCls = isDark ? 'divide-y divide-slate-800/60' : 'divide-y divide-slate-200';

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const handleDownloadTemplate = async () => {
    setTemplateBusy(true);
    try {
      await downloadTutorImportTemplate();
    } finally {
      setTemplateBusy(false);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setParseError(null);
    setFileName(file.name);
    try {
      const parsed = await parseTutorImportFile(file);
      if (parsed.length === 0) {
        setParseError('Δεν βρέθηκαν γραμμές καθηγητών στο αρχείο.');
        return;
      }
      setRows(parsed);
      setStep('preview');
    } catch (err) {
      console.error('Parse import file error', err);
      setParseError('Δεν ήταν δυνατή η ανάγνωση του αρχείου. Βεβαιωθείτε ότι είναι αρχείο .xlsx.');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);

    // Seeded with the existing catalog; grows as new specialty names are met.
    const specialtyByName = new Map<string, SpecialtyRow>();
    specialties.forEach((s) => specialtyByName.set(normalizeText(s.name), s));

    const createdTutors: TutorRow[] = [];
    const newSpecialties: SpecialtyRow[] = [];
    const links: { tutorId: string; specialties: SpecialtyRow[] }[] = [];
    const rowResults: RowResult[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];

      try {
        // Resolve (or create) each specialty name against the running catalog.
        const rowSpecialties: SpecialtyRow[] = [];
        for (const name of r.specialtyNames) {
          const key = normalizeText(name);
          let specialty = specialtyByName.get(key);
          if (!specialty) {
            const { data, error: insErr } = await supabase
              .from('specialties').insert({ school_id: schoolId, name }).select('*').maybeSingle();
            if (insErr || !data) {
              console.error('Create specialty error for row', r.rowNumber, insErr);
              continue;
            }
            specialty = data as SpecialtyRow;
            specialtyByName.set(key, specialty);
            newSpecialties.push(specialty);
          }
          rowSpecialties.push(specialty);
        }

        const payload = {
          full_name: r.full_name,
          date_of_birth: r.date_of_birth,
          hire_date: r.hire_date,
          afm: r.afm,
          phone: r.phone,
          email: r.email,
          iban: r.iban,
          notes: r.notes,
        };

        const { data, error } = await supabase.functions.invoke('tutors-create', { body: payload });
        if (error || !data?.item) {
          rowResults.push({ rowNumber: r.rowNumber, full_name: r.full_name, status: 'failed', message: 'Αποτυχία δημιουργίας' });
        } else {
          const tutor = data.item as TutorRow;
          createdTutors.push(tutor);
          rowResults.push({ rowNumber: r.rowNumber, full_name: r.full_name, status: 'success' });

          if (rowSpecialties.length > 0) {
            const { error: linkErr } = await supabase.from('tutor_specialties').upsert(
              rowSpecialties.map((s) => ({ school_id: schoolId, tutor_id: tutor.id, specialty_id: s.id })),
              { onConflict: 'tutor_id,specialty_id' },
            );
            if (linkErr) console.error('Link specialties error for row', r.rowNumber, linkErr);
            else links.push({ tutorId: tutor.id, specialties: rowSpecialties });
          }
        }
      } catch (err) {
        console.error('Import row error', r.rowNumber, err);
        rowResults.push({ rowNumber: r.rowNumber, full_name: r.full_name, status: 'failed', message: 'Σφάλμα δικτύου' });
      }

      setProgress(i + 1);
      setResults([...rowResults]);
    }

    if (createdTutors.length > 0 || newSpecialties.length > 0) {
      onImported({ tutors: createdTutors, newSpecialties, links });
    }
    setStep('done');
  };

  const successCount = results.filter((r) => r.status === 'success').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl ${modalBg}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--ch-divider)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: 'var(--ch-icon-bg)', border: '1px solid var(--ch-icon-border)' }}>
              <FileSpreadsheet className="h-4 w-4" style={{ color: 'var(--ch-icon)' }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ch-text)' }}>Εισαγωγή καθηγητών από Excel</h2>
          </div>
          <button type="button" onClick={onClose} disabled={step === 'importing'}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-40"
            style={{ background: 'var(--ch-btn-bg)', border: '1px solid var(--ch-btn-border)', color: 'var(--ch-btn-text)' }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {parseError && (
          <ModalErrorBox isDark={isDark}>
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{parseError}
          </ModalErrorBox>
        )}

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {step === 'select' && (
            <div className="space-y-5">
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Κατεβάστε το πρότυπο αρχείο Excel, συμπληρώστε τα στοιχεία των καθηγητών και ανεβάστε το εδώ για μαζική εισαγωγή.
                Στη στήλη «Ειδικότητες» γράψτε μία ή περισσότερες ειδικότητες χωρισμένες με κόμμα (π.χ. «Μαθηματικά, Φυσική»)· όσες δεν
                υπάρχουν ήδη στο σχολείο θα δημιουργηθούν αυτόματα.
              </p>

              <button type="button" onClick={handleDownloadTemplate} disabled={templateBusy}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition disabled:opacity-60 ${isDark ? 'border-slate-700/60 bg-slate-800/40 hover:bg-slate-800/70' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'}`}>
                  {templateBusy ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Download className="h-4 w-4 text-emerald-500" />}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Λήψη προτύπου Excel</p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Μία γραμμή ανά καθηγητή, κάτω από τις επικεφαλίδες</p>
                </div>
              </button>

              <button type="button" onClick={() => fileInputRef.current?.click()}
                className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${isDark ? 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/30' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}>
                <Upload className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Επιλέξτε συμπληρωμένο αρχείο .xlsx</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fileName || 'Κάντε κλικ για αναζήτηση αρχείου'}</p>
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
                  <CheckCircle2 className="h-3 w-3" />{validRows.length} έτοιμοι για εισαγωγή
                </span>
                {invalidRows.length > 0 && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
                    <XCircle className="h-3 w-3" />{invalidRows.length} με σφάλματα (θα παραλειφθούν)
                  </span>
                )}
              </div>

              <div className={`max-h-72 overflow-y-auto rounded-xl border ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                <table className="min-w-full text-xs">
                  <thead className={isDark ? 'bg-slate-800/60' : 'bg-slate-100'}>
                    <tr>
                      <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Γραμμή</th>
                      <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ονοματεπώνυμο</th>
                      <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Ειδικότητες</th>
                      <th className={`px-3 py-2 text-left font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Κατάσταση</th>
                    </tr>
                  </thead>
                  <tbody className={rowBorderCls}>
                    {rows.map((r) => (
                      <tr key={r.rowNumber}>
                        <td className={`px-3 py-2 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.rowNumber}</td>
                        <td className={`px-3 py-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.full_name || '—'}</td>
                        <td className={`px-3 py-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{r.specialtyNames.join(', ') || '—'}</td>
                        <td className="px-3 py-2">
                          {r.errors.length > 0 ? (
                            <span className="flex items-start gap-1.5 text-red-500"><XCircle className="mt-0.5 h-3 w-3 shrink-0" />{r.errors.join('· ')}</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-emerald-500"><CheckCircle2 className="h-3 w-3 shrink-0" />Εντάξει</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(step === 'importing' || step === 'done') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                  {step === 'importing' ? 'Εισαγωγή σε εξέλιξη…' : 'Η εισαγωγή ολοκληρώθηκε'}
                </span>
                <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{progress}/{validRows.length}</span>
              </div>
              <div className={`h-2 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className="h-full rounded-full transition-all" style={{ width: `${validRows.length ? (progress / validRows.length) * 100 : 0}%`, background: 'var(--color-accent)' }} />
              </div>

              {step === 'done' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
                    <CheckCircle2 className="h-3 w-3" />{successCount} δημιουργήθηκαν
                  </span>
                  {failedCount > 0 && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDark ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
                      <XCircle className="h-3 w-3" />{failedCount} απέτυχαν
                    </span>
                  )}
                </div>
              )}

              <div className={`max-h-56 overflow-y-auto rounded-xl border ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                <table className="min-w-full text-xs">
                  <tbody className={rowBorderCls}>
                    {results.map((r) => (
                      <tr key={r.rowNumber}>
                        <td className={`px-3 py-2 tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.rowNumber}</td>
                        <td className={`px-3 py-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{r.full_name}</td>
                        <td className="px-3 py-2">
                          {r.status === 'success' ? (
                            <span className="flex items-center gap-1.5 text-emerald-500"><CheckCircle2 className="h-3 w-3" />Δημιουργήθηκε</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-red-500"><XCircle className="h-3 w-3" />{r.message ?? 'Αποτυχία'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end gap-2.5 border-t px-6 py-4 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`}>
          {step === 'select' && (
            <button type="button" onClick={onClose} className={cancelBtnCls}>Ακύρωση</button>
          )}
          {step === 'preview' && (
            <>
              <button type="button" onClick={() => { setStep('select'); setRows([]); }} className={cancelBtnCls}>Πίσω</button>
              <button type="button" onClick={handleImport} disabled={validRows.length === 0}
                className="btn-primary gap-1.5 px-4 py-1.5 font-semibold disabled:opacity-60">
                Εισαγωγή {validRows.length} καθηγητών
              </button>
            </>
          )}
          {step === 'importing' && (
            <button type="button" disabled className={cancelBtnCls}>
              <Loader2 className="h-3 w-3 animate-spin" />
            </button>
          )}
          {step === 'done' && (
            <button type="button" onClick={onClose} className="btn-primary gap-1.5 px-4 py-1.5 font-semibold">Κλείσιμο</button>
          )}
        </div>
      </div>
    </div>
  );
}
