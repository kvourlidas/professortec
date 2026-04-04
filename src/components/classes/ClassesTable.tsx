// import React from 'react';
// import { School, Search, BookOpen, GraduationCap, Users, ChevronLeft, ChevronRight } from 'lucide-react';
// import EditDeleteButtons from '../ui/EditDeleteButtons';
// import type { ClassRow, SubjectRow } from './types';

// interface ClassesTableProps {
//   loading: boolean;
//   classes: ClassRow[];
//   filteredClasses: ClassRow[];
//   pagedClasses: ClassRow[];
//   subjects: SubjectRow[];
//   levelNameById: Map<string, string>;
//   isDark: boolean;
//   page: number;
//   pageCount: number;
//   showingFrom: number;
//   showingTo: number;
//   onSetPage: React.Dispatch<React.SetStateAction<number>>;
//   onEditClass: (c: ClassRow) => void;
//   onDeleteClass: (target: { id: string; title: string }) => void;
//   onViewStudents: (target: { id: string; title: string }) => void;
// }

// export default function ClassesTable({
//   loading,
//   classes,
//   filteredClasses,
//   pagedClasses,
//   subjects,
//   levelNameById,
//   isDark,
//   page,
//   pageCount,
//   showingFrom,
//   showingTo,
//   onSetPage,
//   onEditClass,
//   onDeleteClass,
//   onViewStudents,
// }: ClassesTableProps) {
//   const theadRowCls = `border-b ${isDark ? 'border-slate-700/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`;
//   const tbodyDivideCls = `divide-y ${isDark ? 'divide-slate-800/50' : 'divide-slate-100'}`;
//   const trHoverCls = `group transition-colors ${isDark ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}`;
//   const paginationBtnCls = `inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-30 ${isDark ? 'border-slate-700/60 bg-slate-900/30 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`;
//   const paginationFooterCls = `flex items-center justify-between gap-3 border-t px-5 py-3 ${isDark ? 'border-slate-800/70 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'}`;

//   if (loading) {
//     return (
//       <div className={`space-y-0 divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
//         {[...Array(5)].map((_, i) => (
//           <div key={i} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
//             <div className={`h-3 w-1/4 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
//             <div className={`h-3 w-1/5 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/80'}`} />
//             <div className={`h-3 w-16 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
//           </div>
//         ))}
//       </div>
//     );
//   }

//   if (classes.length === 0) {
//     return (
//       <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
//         <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
//           <School className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
//         </div>
//         <div>
//           <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν υπάρχουν ακόμη τμήματα</p>
//           <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Πατήστε «Προσθήκη Τμήματος» για να δημιουργήσετε το πρώτο.</p>
//         </div>
//       </div>
//     );
//   }

//   if (filteredClasses.length === 0) {
//     return (
//       <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
//         <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${isDark ? 'border-slate-700/50 bg-slate-800/50' : 'border-slate-200 bg-slate-100'}`}>
//           <Search className={`h-6 w-6 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
//         </div>
//         <div>
//           <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Δεν βρέθηκαν τμήματα</p>
//           <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Δοκιμάστε διαφορετικά κριτήρια αναζήτησης.</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       <div className="overflow-x-auto">
//         <table className="min-w-full border-collapse text-xs">
//           <thead>
//             <tr className={theadRowCls}>
//               {[
//                 { icon: <School className="h-3 w-3" />, label: 'ΟΝΟΜΑ ΤΜΗΜΑΤΟΣ' },
//                 { icon: <BookOpen className="h-3 w-3" />, label: 'ΜΑΘΗΜΑ' },
//                 { icon: <GraduationCap className="h-3 w-3" />, label: 'ΕΠΙΠΕΔΟ' },
//                 { icon: <Users className="h-3 w-3" />, label: 'ΜΑΘΗΤΕΣ' },
//               ].map(({ icon, label }) => (
//                 <th key={label} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest"
//                   style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
//                   <span className="inline-flex items-center gap-1.5">
//                     <span className="opacity-60">{icon}</span>{label}
//                   </span>
//                 </th>
//               ))}
//               <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest"
//                 style={{ color: 'color-mix(in srgb, var(--color-accent) 80%, white)' }}>
//                 ΕΝΕΡΓΕΙΕΣ
//               </th>
//             </tr>
//           </thead>
//           <tbody className={tbodyDivideCls}>
//             {pagedClasses.map((c) => {
//               let levelName = '—';
//               if (c.subject_id) {
//                 const subjRow = subjects.find((s) => s.id === c.subject_id);
//                 if (subjRow?.level_id) levelName = levelNameById.get(subjRow.level_id) ?? '—';
//               }
//               return (
//                 <tr key={c.id} className={trHoverCls}>
//                   <td className="px-5 py-3.5">
//                     <span className={`font-medium transition-colors ${isDark ? 'text-slate-100 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900'}`}>
//                       {c.title}
//                     </span>
//                   </td>
//                   <td className="px-5 py-3.5">
//                     {c.subject ? (
//                       <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
//                         style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)' }}>
//                         {c.subject}
//                       </span>
//                     ) : (
//                       <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
//                     )}
//                   </td>
//                   <td className="px-5 py-3.5">
//                     {levelName !== '—' ? (
//                       <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] ${isDark ? 'border-slate-600/50 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
//                         {levelName}
//                       </span>
//                     ) : (
//                       <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>—</span>
//                     )}
//                   </td>
//                   <td className="px-5 py-3.5">
//                     <button
//                       type="button"
//                       onClick={() => onViewStudents({ id: c.id, title: c.title })}
//                       className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500 transition hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-600"
//                     >
//                       <Users className="h-3 w-3" />
//                       Προβολή
//                     </button>
//                   </td>
//                   <td className="px-5 py-3.5">
//                     <div className="flex items-center justify-end gap-1">
//                       <EditDeleteButtons onEdit={() => onEditClass(c)} onDelete={() => onDeleteClass({ id: c.id, title: c.title })} />
//                     </div>
//                   </td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </div>

//       {/* Pagination footer */}
//       <div className={paginationFooterCls}>
//         <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
//           <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{showingFrom}–{showingTo}</span>{' '}
//           από <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{filteredClasses.length}</span> τμήματα
//         </p>
//         <div className="flex items-center gap-1.5">
//           <button type="button" onClick={() => onSetPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className={paginationBtnCls}>
//             <ChevronLeft className="h-3.5 w-3.5" />
//           </button>
//           <div className={`rounded-lg border px-3 py-1 text-[11px] ${isDark ? 'border-slate-700/60 bg-slate-900/20 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
//             <span className={`font-medium ${isDark ? 'text-slate-50' : 'text-slate-800'}`}>{page}</span>
//             <span className={`mx-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>/</span>
//             <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{pageCount}</span>
//           </div>
//           <button type="button" onClick={() => onSetPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className={paginationBtnCls}>
//             <ChevronRight className="h-3.5 w-3.5" />
//           </button>
//         </div>
//       </div>
//     </>
//   );
// }
