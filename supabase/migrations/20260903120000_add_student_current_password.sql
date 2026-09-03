-- Stores the last plaintext password set for a student's app login, purely as an
-- admin convenience so staff can read it back to a student who forgot it.
-- Supabase Auth still authenticates against its own hashed password separately;
-- this column is not used for authentication.
alter table public.students
  add column if not exists current_password text;
