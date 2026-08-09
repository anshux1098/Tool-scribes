insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('banners', 'banners', true),
  ('collection-covers', 'collection-covers', true)
on conflict (id) do nothing;

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Avatars are public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own banner"
  on storage.objects for insert
  with check (bucket_id = 'banners' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own banner"
  on storage.objects for update
  using (bucket_id = 'banners' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Banners are public"
  on storage.objects for select
  using (bucket_id = 'banners');

create policy "Users can upload collection covers"
  on storage.objects for insert
  with check (bucket_id = 'collection-covers' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Collection covers are public"
  on storage.objects for select
  using (bucket_id = 'collection-covers');
