// Computes accrued session charges by replaying the same recurrence/holiday/override
// rules the dashboard calendar uses to decide whether a given occurrence is active —
// but bounded through a cutoff date (normally "today") instead of a calendar view range,
// and producing a charge amount instead of a calendar event.

export type ChargeableProgramItem = {
  id: string;
  day_of_week: string;
  start_date: string | null;
  end_date: string | null;
  charge_per_session: number | null;
  subject_id: string | null;
};

export type ChargeOverrideRow = {
  program_item_id: string;
  override_date: string | null;
  is_deleted: boolean | null;
  is_inactive: boolean | null;
  holiday_active_override: boolean | null;
  charge_amount: number | null;
};

export type AccruedCharge = {
  programItemId: string;
  date: string;
  amount: number;
  subjectId: string | null;
};

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const pad2 = (n: number) => n.toString().padStart(2, '0');
const formatLocalYMD = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function getNextDateForDow(from: Date, dow: number): Date {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** `throughDateIso` is inclusive — pass today's date (YYYY-MM-DD) to charge everything occurred so far. */
export function computeAccruedCharges(
  items: ChargeableProgramItem[],
  overrides: ChargeOverrideRow[],
  holidayDates: Set<string>,
  throughDateIso: string,
): AccruedCharge[] {
  const overrideMap = new Map<string, ChargeOverrideRow>();
  overrides.forEach((o) => { if (o.override_date) overrideMap.set(`${o.program_item_id}-${o.override_date}`, o); });

  const boundEnd = new Date(`${throughDateIso}T23:59:59`);
  const out: AccruedCharge[] = [];

  for (const item of items) {
    const dow = WEEKDAY_TO_INDEX[item.day_of_week];
    if (dow === undefined) continue;
    const patternStart = item.start_date ? new Date(`${item.start_date}T00:00:00`) : new Date('1970-01-01T00:00:00');
    const patternEnd = item.end_date ? new Date(`${item.end_date}T23:59:59`) : new Date('2999-12-31T23:59:59');
    const effectiveEnd = patternEnd < boundEnd ? patternEnd : boundEnd;
    if (patternStart > effectiveEnd) continue;

    let cur = getNextDateForDow(patternStart, dow);
    while (cur <= effectiveEnd) {
      const dateStr = formatLocalYMD(cur);
      const ov = overrideMap.get(`${item.id}-${dateStr}`);
      const isHoliday = holidayDates.has(dateStr);
      const manualInactive = !!ov?.is_inactive;
      const holidayActiveOverride = !!ov?.holiday_active_override;
      const isInactive = manualInactive || (isHoliday && !holidayActiveOverride);
      const isDeleted = !!ov?.is_deleted;
      if (!isDeleted && !isInactive) {
        const amount = ov?.charge_amount ?? item.charge_per_session;
        if (amount != null && amount > 0) {
          out.push({ programItemId: item.id, date: dateStr, amount, subjectId: item.subject_id ?? null });
        }
      }
      const next = new Date(cur);
      next.setDate(next.getDate() + 7);
      cur = next;
    }
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
