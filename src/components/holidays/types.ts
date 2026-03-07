export type HolidayRow = {
  id: string;
  school_id: string;
  date: string;
  name: string | null;
  created_at: string | null;
};

export type HolidayGroup = {
  ids: string[];
  startDate: string;
  endDate?: string | null;
  name: string | null;
};

export type Mode = 'single' | 'range';
