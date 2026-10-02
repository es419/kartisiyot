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
