-- הרץ פעם אחת: סטים ציבוריים בחיפוש + תרשימים אינטראקטיביים
alter table fc_sets add column if not exists listed boolean not null default false;

create table if not exists fc_diagrams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  set_id uuid not null references fc_sets on delete cascade,
  title text not null default 'תרשים חדש',
  image_url text not null,
  points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists fc_diagrams_set_idx on fc_diagrams(set_id);
alter table fc_diagrams enable row level security;

drop policy if exists "own diagrams" on fc_diagrams;
create policy "own diagrams" on fc_diagrams for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public diagrams readable" on fc_diagrams;
create policy "public diagrams readable" on fc_diagrams for select to anon, authenticated
  using (exists (select 1 from fc_sets s where s.id = fc_diagrams.set_id and s.is_public));

notify pgrst, 'reload schema';
