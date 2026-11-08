# Media processing worker

The processor is a separate long-running container service. Run it on a container host such as DeployPro, not inside a Vercel route or browser process.

## Build and run

Build using `workers/media-processor/Dockerfile` with `workers/media-processor` as the build context. The image includes Node.js 22, FFmpeg/ffprobe, Sharp and ClamAV.

Required private environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional: `MEDIA_BUCKET`, `WORKER_ID`, `POLL_INTERVAL_MS`, `MAX_MEDIA_BYTES`, `CLAMAV_DATABASE`, `CLAMSCAN_BIN`. Start with one replica and one job per worker. Set strict container CPU, memory, ephemeral disk and restart limits.

## Malware scanning gate

- Container startup runs `freshclam` and refuses to start unless the main and daily signature databases are present.
- Every downloaded original is scanned by ClamAV before Sharp, ffprobe or FFmpeg is allowed to parse/decode it.
- ClamAV exit 0 means clean; exit 1 means infected and quarantines the asset; all other exit codes, missing binaries and timeouts fail closed and enter normal retry/dead-letter handling.
- A scan failure never permits an asset to become `ready`.
- The image runs as the unprivileged Node user. The signature database is stored in the container's writable temporary area.
- Fresh signatures are downloaded at container start. Restart/redeploy the worker on a regular schedule (at least daily) to refresh signatures until a managed updater is added. Do not treat a stale, long-running container as having current signatures.

This gate is malware scanning, not a guarantee that every unknown or zero-day threat will be detected. ClamAV definitions and engine must be kept current.

## Processing contract

- Download originals only from the private Supabase bucket using the service role.
- Inspect file signatures; do not trust filename or declared MIME alone.
- Scan the original before any media parser/decoder is invoked.
- Decode and re-encode images with Sharp, applying EXIF orientation and producing a WebP preview.
- Probe videos with ffprobe, enforce duration and pixel limits, produce a JPEG poster, and encode a bounded H.264/AAC MP4 mezzanine derivative with FFmpeg.
- Invoke FFmpeg with argument arrays and `shell: false`.
- Store derivatives in the private bucket under server-generated tenant/brand/asset paths.
- Mark an asset ready only after scan, processing and derivative upload succeed.
- Retry processing errors with bounded backoff; quarantine malware and signature/category mismatches; dead-letter exhausted jobs.
- Recover abandoned running jobs through `recover_stale_media_processing_jobs`.

## Validation and limitations

Run `npm test` in this package. Tests cover clean/malware/unavailable scanner exit handling using a controlled fake scanner; they do not replace an integration test with real ClamAV signatures and the EICAR test file. No malware scan has been performed against a production upload.

Platform-specific renditions, animated-GIF policy handling, audio normalization, derivative cleanup/retention, signed preview delivery and operational metrics are not yet implemented.

Apply the preceding migration stack in order before starting the worker. No migration is applied by this change. Verify the target Supabase project's global Storage size limit: local config currently declares 50 MiB while the private bucket migration allows 250 MiB.
