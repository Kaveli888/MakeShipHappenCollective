-- Media object storage bucket + access policies.
-- The worker uses the service role (bypasses these) to download for publishing.
-- Clients (authenticated users) may read/write only objects they own. Tightening
-- to workspace-membership-by-path (objects keyed `<workspace_id>/...`) is a
-- later hardening step.

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy "media owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

create policy "media owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and owner = auth.uid());

create policy "media owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and owner = auth.uid());

create policy "media owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and owner = auth.uid());
