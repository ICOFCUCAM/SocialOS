# Media processing worker

The processor is a separate long-running container service. It must run on a container host such as DeployPro, not inside a Vercel route or browser process.

## Build and run

Build using `workers/media-processor/Dockerfile` with `workers/media-processor` as the build context. The image includes Node.js 22, FFmpeg/ffprobe and Sharp. It does not expose an HTTP port.

Required private environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: `MEDIA_BUCKET`, `WORKER_ID`, `POLL_INTERVAL_MS`. Start with one replica and a batch size of two (fixed in this initial worker implementation). Set strict container CPU, memory, ephemeral disk and restart limits.

## Processing contract

- Download originals only from the private Supabase bucket using the service role.
- Inspect file signatures; do not trust filename or declared MIME alone.
- Decode and re-encode images with Sharp, applying EXIF orientation and producing a WebP preview.
- Probe videos with ffprobe, enforce duration and pixel limits, and produce a JPEG poster with FFmpeg.
- Invoke FFmpeg with argument arrays and `shell: false`.
- Store derivatives in the private bucket under server-generated tenant/brand/asset paths.
- Mark an asset ready only after processing and derivative upload succeed.
- Retry processing errors with bounded backoff; quarantine signature/category mismatches; dead-letter exhausted jobs.
- Recover abandoned running jobs through `recover_stale_media_processing_jobs`.

## Production limitations

This is the first worker foundation, not a complete media-security certification. Malware scanning, video transcoding/mezzanine generation, animated-GIF policy handling, audio normalization, derivative cleanup/retention, signed preview delivery and operational metrics are not yet implemented. A valid signature and successful decode do not prove a file is malware-free. Do not describe uploaded media as malware-scanned until a scanner is integrated and enforced.

Apply the preceding migration stack and `0008_media_worker_lease_recovery.sql` in the intended order before starting the worker. No migration is applied by this change. Verify the target Supabase project's global Storage size limit: local config currently declares 50 MiB while the private bucket migration allows 250 MiB.
