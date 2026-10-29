insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('aura-recordings','aura-recordings',false,52428800,array['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
create policy "aura_recordings_read" on storage.objects for select to authenticated using (bucket_id='aura-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "aura_recordings_insert" on storage.objects for insert to authenticated with check (bucket_id='aura-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "aura_recordings_delete" on storage.objects for delete to authenticated using (bucket_id='aura-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
