-- إضافة غير هدامة لدعم أكثر من مادة ونصاب مستقل لكل مادة.
-- لا حذف ولا تعديل للبيانات السابقة.
alter table if exists public.school_teacher_profiles
  add column if not exists teaching_subjects jsonb not null default '[]'::jsonb;

comment on column public.school_teacher_profiles.teaching_subjects is
  'مواد المعلم وأنصبة كل مادة [{subject, weekly_lessons}]؛ subject/weekly_lessons القديمان يبقيان للتوافق.';
