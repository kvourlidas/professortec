-- Adds student address, school attended, and parent AFM (Greek tax ID) fields.
alter table public.students
  add column if not exists address text,
  add column if not exists school_name text,
  add column if not exists father_afm text,
  add column if not exists mother_afm text;

alter table public.students
  add constraint students_father_afm_format check (father_afm is null or father_afm ~ '^\d{9}$'),
  add constraint students_mother_afm_format check (mother_afm is null or mother_afm ~ '^\d{9}$');
