-- כרטיסיות: סכמה ל-Supabase
-- הרץ את כל הקובץ ב-SQL Editor. כל הטבלאות עם הקידומת fc_ כדי לא להתנגש באפליקציות אחרות באותו פרויקט.

create table if not exists fc_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists fc_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  folder_id uuid references fc_folders on delete set null,
  title text not null default 'סט חדש',
  description text not null default '',
  is_public boolean not null default false,
  term_lang text not null default 'en-US',
  def_lang text not null default 'he-IL',
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fc_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  set_id uuid not null references fc_sets on delete cascade,
  term text not null default '',
  definition text not null default '',
  image_url text,
  position int not null default 0,
  starred boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists fc_progress (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references fc_cards on delete cascade,
  set_id uuid not null references fc_sets on delete cascade,
  box int not null default 0,
  due_at timestamptz not null default now(),
  correct int not null default 0,
  wrong int not null default 0,
  stability real,
  difficulty real,
  last_review timestamptz,
  reps int not null default 0,
  lapses int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists fc_activity (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  cards int not null default 0,
  correct int not null default 0,
  primary key (user_id, day)
);

create table if not exists fc_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  type text not null default 'concept',
  title text not null default '',
  body text not null default '',
  tag text not null default '',
  resolved boolean not null default false,
  card_id uuid references fc_cards on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fc_sets_user_idx on fc_sets(user_id, updated_at desc);
create index if not exists fc_cards_set_idx on fc_cards(set_id, position);
create index if not exists fc_progress_due_idx on fc_progress(user_id, due_at);
create index if not exists fc_progress_set_idx on fc_progress(set_id);
create index if not exists fc_entries_user_idx on fc_entries(user_id, created_at desc);

alter table fc_folders  enable row level security;
alter table fc_sets     enable row level security;
alter table fc_cards    enable row level security;
alter table fc_progress enable row level security;
alter table fc_activity enable row level security;
alter table fc_entries  enable row level security;

drop policy if exists "own folders" on fc_folders;
create policy "own folders" on fc_folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sets" on fc_sets;
create policy "own sets" on fc_sets for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public sets readable" on fc_sets;
create policy "public sets readable" on fc_sets for select to anon, authenticated using (is_public);

drop policy if exists "own cards" on fc_cards;
create policy "own cards" on fc_cards for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public cards readable" on fc_cards;
create policy "public cards readable" on fc_cards for select to anon, authenticated
  using (exists (select 1 from fc_sets s where s.id = fc_cards.set_id and s.is_public));

drop policy if exists "own progress" on fc_progress;
create policy "own progress" on fc_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own activity" on fc_activity;
create policy "own activity" on fc_activity for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own entries" on fc_entries;
create policy "own entries" on fc_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function fc_bump_activity(d date, n int, c int) returns void
language sql as $$
  insert into fc_activity (user_id, day, cards, correct) values (auth.uid(), d, n, c)
  on conflict (user_id, day) do update
    set cards = fc_activity.cards + excluded.cards,
        correct = fc_activity.correct + excluded.correct;
$$;

-- תמונות לכרטיסיות
insert into storage.buckets (id, name, public) values ('fc-images', 'fc-images', true)
on conflict (id) do nothing;

drop policy if exists "fc upload own images" on storage.objects;
create policy "fc upload own images" on storage.objects for insert to authenticated
  with check (bucket_id = 'fc-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fc delete own images" on storage.objects;
create policy "fc delete own images" on storage.objects for delete to authenticated
  using (bucket_id = 'fc-images' and (storage.foldername(name))[1] = auth.uid()::text);
