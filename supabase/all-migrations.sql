-- כל העדכונים של מסד הנתונים בקובץ אחד. אפשר להריץ שוב ושוב בלי נזק.
-- הדבק ב-Supabase: SQL Editor, New query, ואז Run.

-- ===== migration_v2.sql =====
-- הרץ פעם אחת אם כבר הרצת את schema.sql בעבר (FSRS + תאריך מבחן)
alter table fc_progress add column if not exists stability real;
alter table fc_progress add column if not exists difficulty real;
alter table fc_progress add column if not exists last_review timestamptz;
alter table fc_progress add column if not exists reps int not null default 0;
alter table fc_progress add column if not exists lapses int not null default 0;
alter table fc_sets add column if not exists exam_date date;

-- ===== migration_v3.sql =====
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

-- ===== migration_v4.sql =====
-- הרץ פעם אחת: רמת בדיקת תשובות לכל סט + תשובות נוספות שמתקבלות לכל כרטיסייה
alter table fc_sets  add column if not exists grading text not null default 'flexible';
alter table fc_cards add column if not exists alts text not null default '';

-- ===== migration_v5.sql =====
-- הרץ פעם אחת: רמת בדיקה לכל כרטיסייה (ריק = כמו הסט)
alter table fc_cards add column if not exists grading text check (grading in ('exact', 'flexible', 'smart'));

-- ===== migration_v6.sql =====
-- הרץ פעם אחת: פונקציה שמחזירה כמה מקום בשימוש (בסיס נתונים ואחסון קבצים).
-- האפליקציה קוראת לה בכל כניסה ומציגה התראה אדומה כשהמקום מתמלא.
create or replace function public.fc_usage()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'files_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0)
  );
$$;

revoke all on function public.fc_usage() from public, anon;
grant execute on function public.fc_usage() to authenticated;

notify pgrst, 'reload schema';
