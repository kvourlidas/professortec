export type LevelRow = { id: string; school_id: string; name: string; created_at: string };
export type SubjectRow = { id: string; school_id: string; name: string; level_id: string | null; created_at: string };
export type TutorRow = { id: string; school_id: string; full_name: string | null };
export type ModalMode = 'create' | 'edit';
