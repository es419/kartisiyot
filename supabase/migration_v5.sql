-- הרץ פעם אחת: רמת בדיקה לכל כרטיסייה (ריק = כמו הסט)
alter table fc_cards add column if not exists grading text check (grading in ('exact', 'flexible', 'smart'));
notify pgrst, 'reload schema';
