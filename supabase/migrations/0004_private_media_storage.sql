-- Private object storage for SocialOS media. Uploads are issued by authenticated server routes.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'social-media','social-media',false,262144000,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- No authenticated or anonymous storage.objects policy is created for this bucket.
-- Storage access is through server-issued signed URLs only.

comment on table public.social_media_assets is
  'Tenant-scoped media records. Object storage is private; clients use server-issued signed URLs.';
