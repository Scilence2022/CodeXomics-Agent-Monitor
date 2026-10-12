# CodeXomics Agent Monitor

A live, read-only observatory for genome database maintenance. It displays agent work, feature-level annotation state, evidence and candidate qualifiers, historical runs, and immutable annotation downloads. It does **not** run DGR research, approve ChangeSets, or apply annotations.

## What is implemented

- Real-time Server-Sent Events, reconnects and polling fallback.
- Active gene cards, reported research stages, and recent exported activity.
- A genome maintenance map, searchable CDS census, state filters and pagination.
- Stable feature links, before/candidate qualifiers, citations, task and ChangeSet IDs.
- Separate research, curator-review and publication states.
- Daily run accounting including failures and unrecorded costs.
- Full GenBank, GFF3 and FASTA downloads, release IDs and SHA-256 checksums.
- Persistent local file storage and a compatible Cloudflare R2 backend.
- An authenticated import/relay API and large-artifact staging.
- Strictly separate observed and visibly simulated demonstration modes.

The maintenance map is a status overview, not a replacement for CodeXomics's detailed native genome browser. Annotation downloads can be opened in CodeXomics. A complete Web port of CodeXomics's Electron UI is outside this monitor's scope; no JBrowse dependency is used.

## Run locally

Requires Node.js 22 or newer; there are no third-party runtime dependencies.

```sh
npm test
npm run dev
# Open http://127.0.0.1:4178/?mode=demo
```

Observed mode starts empty until a source is imported. Demo mode contains synthetic genes, events and downloadable synthetic files; it is never an observed biological dataset.

```sh
export ANNOTATION_WORKSPACE=/path/to/GenomeAnnotationTasks
export DGR_TASK_FILE=/path/to/deep-gene-research/tasks.json
npm run import
npm start
```

The importer reads a single-sequence GenBank reference, daily `reports/run-report-*.json`, and optionally the DGR durable task ledger. The server watches source modification signatures every five seconds and imports only when something changes. Keep exactly one Node process per local storage directory. Multi-instance deployments should use R2 conditional writes instead.

Runtime files live under ignored `.data/`. Real annotations, reports, API keys, task ledgers, and manuscripts are not committed to this repository. Failed source imports retain the last valid state and log an error.

The importer freezes the original GenBank as a **reference snapshot** with zero established review coverage. It does not claim that existing annotations were reviewed by the monitor, and it does not apply pending suggestions. GFF3 conversion is disabled if unsupported locations remain; GenBank is authoritative. One monitor namespace currently supports one reference sequence. Assembly identity follows sequence content; annotation versions retain separate input hashes.

## Observe a hosted monitor

```sh
export MONITOR_URL=https://your-monitor.example
export MONITOR_INGEST_TOKEN=your-server-side-ingestion-secret
# Required only for a private Sites deployment; obtain supported service access.
export SITES_SERVICE_TOKEN=your-private-site-service-credential
export ANNOTATION_WORKSPACE=/path/to/GenomeAnnotationTasks
export DGR_TASK_FILE=/path/to/deep-gene-research/tasks.json
npm run bridge -- --releases --watch
```

The bridge reads existing records only. It uploads sanitized snapshots when source files change, optionally synchronizes existing frozen releases, and never invokes curation tools. Research completion is distinct from accepted or published annotation. Configure secrets through the hosting provider; never expose them in browser code. The private hosting boundary and the monitor ingestion token are separate controls.

## Publish a reviewed annotation version

Export actual curator decisions into the observed snapshot first. Prepare a JSON package with a unique release ID, `kind: "reviewed"`, explicit `reviewedIds` and `changedIds`, and complete annotation file paths. Then:

```sh
npm run release -- /path/to/release-package.json
```

See [the release contract](docs/releases.md). Publication records the exported decision; it does not itself approve a CodeXomics proposal. Each reviewed feature must have an accepted, edited or no-change decision, and changed features must be a subset of reviewed features. A complete file includes untouched records, so file completeness and review coverage are separate measurements.

## Deploy

```sh
npm run build
```

The build emits a self-contained Worker ES module under `dist/server/index.js` and the Sites hosting manifest. The Worker requires an R2 binding named `BUCKET` for observed data persistence and `MONITOR_INGEST_TOKEN` for writes. Without the write secret, ingestion is disabled. Demo mode is available without importing observations.

For a laboratory server, use the included Dockerfile or run `npm start` with a durable data volume and a reverse proxy providing HTTPS. Configure `HOST=0.0.0.0` only inside the intended service environment. Review site audience before changing a private deployment to public.

## Architecture and validation

- `web/`: browser UI and client event stream.
- `worker/index.js`: shared HTTP API, validation and release publication.
- `scripts/storage.mjs`: atomic local R2-compatible storage and compare-and-swap.
- `scripts/adapter.mjs`: allowlisted export from CodeXomics reports and DGR tasks.
- `scripts/genbank.mjs`: reference census and conservative GFF3/FASTA conversion.
- `scripts/bridge.mjs`: optional authenticated live source relay.
- `tests/`: validation, approval boundaries, immutable downloads, concurrent writes, streaming and reference conversion.

Source availability, reported agent success, source counts and curator acceptance are not independent measures of biological accuracy. The UI deliberately exposes missing evidence and missing approval records.
