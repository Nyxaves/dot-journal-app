-- Dot Journal: private encrypted backup bucket.
-- Run this script once in Supabase Dashboard > SQL Editor.
-- No application data tables are created in Postgres.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dot-journal-private-backups',
  'dot-journal-private-backups',
  false,
  26214400,
  array['application/octet-stream']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "dot_journal_backup_select_own" on storage.objects;
create policy "dot_journal_backup_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dot-journal-private-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) = 'djbackup'
);

drop policy if exists "dot_journal_backup_insert_own" on storage.objects;
create policy "dot_journal_backup_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dot-journal-private-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) = 'djbackup'
);

drop policy if exists "dot_journal_backup_delete_own" on storage.objects;
create policy "dot_journal_backup_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dot-journal-private-backups'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and storage.extension(name) = 'djbackup'
);
