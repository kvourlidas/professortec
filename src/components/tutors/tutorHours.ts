import { supabase } from '../../lib/supabaseClient';

export type TutorProgramItem = {
  id: string;
  class_id: string | null;
  student_id: string | null;
  day_of_week: string;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  room: string | null;
  subject_id: string | null;
};

type TutorProgramOverride = {
  program_item_id: string;
  override_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_deleted: boolean | null;
};

export async function fetchTutorProgramItems(schoolId: string, tutorId: string): Promise<TutorProgramItem[]> {
  const { data: programs, error: programsErr } = await supabase.from('programs').select('id').eq('school_id', schoolId);
  if (programsErr) { console.error(programsErr); return []; }
  const programIds = (programs ?? []).map((p: { id: string }) => p.id);
  if (programIds.length === 0) return [];

  const { data, error } = await supabase
    .from('program_items')
    .select('id, class_id, student_id, day_of_week, start_time, end_time, start_date, end_date, room, subject_id')
    .in('program_id', programIds)
    .eq('tutor_id', tutorId);
  if (error) { console.error(error); return []; }
  return (data ?? []) as TutorProgramItem[];
}

function minutesBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0;
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : 0;
}

export function formatHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}λ`;
  if (minutes === 0) return `${hours}ω`;
  return `${hours}ω ${minutes}λ`;
}

/**
 * Sums the duration of every session actually held (proven by an attendance
 * row) for this tutor within [startISO, endISO]. Attendance is recorded one
 * row per student, so sessions are de-duplicated by (program item, date)
 * before their duration — from the program item, adjusted by any one-off
 * override for that date — is added to the total.
 */
export async function computeTutorHoursInRange(
  schoolId: string,
  tutorId: string,
  startISO: string,
  endISO: string,
): Promise<{ totalMinutes: number; sessionCount: number }> {
  const items = await fetchTutorProgramItems(schoolId, tutorId);
  if (items.length === 0) return { totalMinutes: 0, sessionCount: 0 };

  const itemById = new Map(items.map((it) => [it.id, it]));
  const classItems = items.filter((it) => it.class_id);
  const privateItemIds = items.filter((it) => it.student_id).map((it) => it.id);
  const classIds = [...new Set(classItems.map((it) => it.class_id as string))];
  const itemIdsByClassId = new Map<string, string>();
  classItems.forEach((it) => { if (it.class_id) itemIdsByClassId.set(it.class_id, it.id); });

  const { data: overrideData, error: overrideErr } = await supabase
    .from('program_item_overrides')
    .select('program_item_id, override_date, start_time, end_time, is_deleted')
    .in('program_item_id', items.map((it) => it.id));
  if (overrideErr) console.error(overrideErr);
  const overrideByKey = new Map<string, TutorProgramOverride>();
  (overrideData ?? []).forEach((ov: TutorProgramOverride) => {
    if (ov.override_date) overrideByKey.set(`${ov.program_item_id}-${ov.override_date}`, ov);
  });

  const seenSessions = new Set<string>();
  let totalMinutes = 0;

  const addSession = (item: TutorProgramItem, sessionDate: string) => {
    const key = `${item.id}-${sessionDate}`;
    if (seenSessions.has(key)) return;
    seenSessions.add(key);
    const override = overrideByKey.get(key);
    if (override?.is_deleted) return;
    const start = override?.start_time ?? item.start_time;
    const end = override?.end_time ?? item.end_time;
    totalMinutes += minutesBetween(start, end);
  };

  if (classIds.length > 0) {
    const { data, error } = await supabase
      .from('class_attendance')
      .select('class_id, program_item_id, session_date')
      .eq('school_id', schoolId)
      .in('class_id', classIds)
      .gte('session_date', startISO)
      .lte('session_date', endISO);
    if (error) console.error(error);
    (data ?? []).forEach((row: { class_id: string; program_item_id: string | null; session_date: string }) => {
      const item = (row.program_item_id ? itemById.get(row.program_item_id) : null)
        ?? (itemIdsByClassId.has(row.class_id) ? itemById.get(itemIdsByClassId.get(row.class_id)!) : undefined);
      if (item) addSession(item, row.session_date);
    });
  }

  if (privateItemIds.length > 0) {
    const { data, error } = await supabase
      .from('private_lesson_attendance')
      .select('program_item_id, session_date')
      .eq('school_id', schoolId)
      .in('program_item_id', privateItemIds)
      .gte('session_date', startISO)
      .lte('session_date', endISO);
    if (error) console.error(error);
    (data ?? []).forEach((row: { program_item_id: string; session_date: string }) => {
      const item = itemById.get(row.program_item_id);
      if (item) addSession(item, row.session_date);
    });
  }

  return { totalMinutes, sessionCount: seenSessions.size };
}
