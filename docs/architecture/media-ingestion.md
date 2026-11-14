# SocialOS media ingestion and processing

## Upload protocol

1. The browser sends metadata (workspace, brand, filename, MIME type and byte size) to `POST /api/social/media/upload-url`.
2. The route requires a signed-in user, active workspace membership, an upload-capable role and an active brand in that workspace.
3. The server creates a tenant-scoped asset record and issues a short-lived signed upload URL for the private `social-media` bucket.
4. The browser uploads the bytes directly to Supabase Storage. The application server does not proxy large media files.
5. The browser calls `POST /api/social/media/finalize` with the asset ID.
6. The server uses the user's RLS-scoped session to verify access to the asset, then checks the object exists and its stored size/type metadata matches the declared values.
7. The server creates one durable `media_processing_jobs` record. The asset remains `pending`; it is not yet eligible for publishing.
8. A trusted media worker claims jobs using `claim_media_processing_jobs(worker_id, limit)`.

## Supported upload types in this initial slice

- Images: JPEG, PNG, WebP, GIF.
- Video: MP4, QuickTime/MOV, WebM.
- Maximum declared size: 250 MiB per file.

The storage bucket is private. No authenticated or anonymous browser storage policy is created for this bucket. The browser receives a short-lived signed upload URL only after the server checks the user's workspace and brand permissions.

## Worker processing contract

The media worker must not trust browser-provided MIME types, filenames, extensions, dimensions or duration. It must:

1. Claim a job atomically and establish a renewable worker lease.
2. Download the object using server credentials into an isolated, non-public working directory.
3. Inspect magic bytes and container structure; reject extension/MIME mismatches and malformed files.
4. Enforce actual byte-size, pixel dimensions, frame count, duration, codec and resource limits.
5. Run malware/content scanning appropriate to the deployment and quarantine failures.
6. For images, decode/re-encode safe derivatives, strip EXIF/GPS metadata, create thumbnails and calculate dimensions.
7. For videos, use a pinned FFmpeg build in a sandbox with CPU, memory, disk and wall-clock limits; probe streams, generate poster frames and produce platform-neutral mezzanine output. Do not execute uploaded files or trust embedded paths.
8. Store derivatives in private tenant-scoped storage keys. Do not expose permanent public object URLs.
9. Update `social_media_assets.processing_status` to `ready` only after every required validation and derivative has succeeded. Record dimensions, duration, checksum and derivative references.
10. On permanent failure, mark the asset `failed` or `quarantined`; on transient failure, use bounded exponential backoff with jitter and eventually dead-letter the job.
11. Remove temporary files on success and failure. Never log signed URLs, credentials or raw media contents.

## Publishing gate

The existing post-creation database function accepts only media assets with `processing_status='ready'`. Therefore a newly uploaded asset cannot be attached to a publishable post until the trusted media worker completes validation and processing.

## Current implementation boundary

This milestone implements private storage provisioning, authenticated signed-upload issuance, upload finalization and a durable processing queue with atomic job claiming. It does **not** yet implement the browser uploader, FFmpeg worker, malware scanner, thumbnail generation, derivative storage, signed download/preview endpoint or publishing adapters. Do not mark media ready manually or deploy this as a completed production media pipeline.
