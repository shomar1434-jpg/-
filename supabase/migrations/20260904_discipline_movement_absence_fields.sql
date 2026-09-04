alter table public.staff_discipline_movements
  add column if not exists absence_days integer not null default 0;
alter table public.staff_discipline_movements
  add column if not exists excuse_type text;
alter table public.staff_discipline_movements
  add column if not exists excuse_status text;
