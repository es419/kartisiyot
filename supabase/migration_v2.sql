-- הרץ פעם אחת אם כבר הרצת את schema.sql בעבר (FSRS + תאריך מבחן)
alter table fc_progress add column if not exists stability real;
alter table fc_progress add column if not exists difficulty real;
alter table fc_progress add column if not exists last_review timestamptz;
alter table fc_progress add column if not exists reps int not null default 0;
alter table fc_progress add column if not exists lapses int not null default 0;
alter table fc_sets add column if not exists exam_date date;
notify pgrst, 'reload schema';
