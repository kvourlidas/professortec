-- Classes now belong to exactly one school year (instead of year-membership
-- being derived indirectly from overlapping program_items date ranges), so
-- each year keeps its own distinct set of classes and enrollments.
alter table public.classes
  add column if not exists school_year_id uuid references public.school_years(id) on delete set null;

create index if not exists idx_classes_school_year_id on public.classes(school_year_id);

-- Backfill existing classes into whichever school year contains today's date.
update public.classes c
set school_year_id = sy.id
from public.school_years sy
where c.school_id = sy.school_id
  and c.school_year_id is null
  and current_date between sy.start_date and sy.end_date;
