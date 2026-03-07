export type SchoolEventRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  created_at: string | null;
};

export type ModalMode = 'create' | 'edit';
