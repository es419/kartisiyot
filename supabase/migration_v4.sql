-- הרץ פעם אחת: רמת בדיקת תשובות לכל סט + תשובות נוספות שמתקבלות לכל כרטיסייה
alter table fc_sets  add column if not exists grading text not null default 'flexible';
alter table fc_cards add column if not exists alts text not null default '';
notify pgrst, 'reload schema';
