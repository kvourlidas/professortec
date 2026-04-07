export type UpsertProgramItemOverrideInput = {
  program_item_id: string;
  override_date: string;
  start_time: string | null;
  end_time: string | null;
  is_deleted: boolean;
  is_inactive: boolean;
  holiday_active_override: boolean;
};
