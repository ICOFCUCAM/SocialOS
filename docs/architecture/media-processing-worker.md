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
- Fresh signatures are downloaded at container start. Restart/redeploy the worker at least daily until a managed updater is introduced.

## Rendition generation

The worker derives outputs for the requested publishing targets. Supply an array of supported platform IDs in `social_media_assets.metadata.targetPlatforms`; when omitted, it prepares Instagram, Facebook, YouTube, LinkedIn and Pinterest profiles. Unknown IDs fail the job rather than silently receiving a wrong output.

Internal aspect-ratio profiles are deduplicated across platforms:

| Profile | Dimensions | Used by |
| --- | ---: | --- |
| Portrait image | 1080 × 1350 | Instagram, Facebook |
| Square image | 1080 × 1080 | Threads |
| Landscape image/video | 1920 × 1080 | YouTube, LinkedIn |
| Pin image | 1000 × 1500 | Pinterest |
| Vertical video | 1080 × 1920, 30 fps | Instagram, Facebook, Pinterest |
| Square video | 1080 × 1080, 30 fps | Threads |

- Image outputs are WebP, resized to fit without cropping. The existing general preview is retained.
- Video outputs are H.264/AAC MP4, scaled and padded to the target frame, with fixed frame rate and bounded bitrate.
- Identical aspect-ratio profiles are generated once even when multiple platforms use them.
- Derivatives are private and stored under the tenant/brand/asset path in a `renditions/` folder.
- Target platform IDs and the generated profile metadata are recorded with the processing result.

These are internal production presets, not a promise of platform acceptance. Platform APIs change their upload limits, codecs, duration, aspect ratios and publishing permissions. Each publishing adapter must validate current official requirements, apply final constraints and handle rejection responses before attempting publication. Do not represent a successful transcode as a successful platform upload.

## Processing contract

- Download originals only from the private Supabase bucket using the service role.
- Inspect file signatures; do not trust filename or declared MIME alone.
- Scan the original before any media parser/decoder is invoked.
- Decode and re-encode images with Sharp, applying EXIF orientation.
- Probe videos with ffprobe, enforce duration and pixel limits, produce a JPEG poster and platform rendition files.
- Invoke FFmpeg with argument arrays and `shell: false`.
- Store derivatives in the private bucket under server-generated tenant/brand/asset paths.
- Mark an asset ready only after scan, processing and every requested derivative upload succeed.
- Retry processing errors with bounded backoff; quarantine malware and signature/category mismatches; dead-letter exhausted jobs.
- Recover abandoned running jobs through `recover_stale_media_processing_jobs`.

## Validation and limitations

Run `npm test` in this package. Unit tests cover scanner exit handling and profile mapping. They do not replace a real ClamAV/EICAR integration test, media fixture tests or upload tests against a staging Supabase project.

Audio normalization, animated-GIF policy handling, derivative cleanup/retention, signed preview delivery, per-platform API validation, operational metrics and real publishing integration tests remain future work.

Apply the preceding migration stack in order before starting the worker. No migration is applied by this change. Verify the target Supabase project's global Storage size limit: local config currently declares 50 MiB while the private bucket migration allows 250 MiB.
