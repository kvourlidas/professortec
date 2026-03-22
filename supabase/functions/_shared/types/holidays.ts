export type CreateHolidayInput = {
  rows: { date: string; name: string | null }[];
};

export type DeleteHolidayInput = {
  ids: string[];
};
