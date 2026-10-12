# HTTP API

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Storage and ingestion readiness; no secret values |
| `GET /api/snapshot` | Public feature census, statistics and release metadata |
| `GET /api/genes/{featureId}` | Full exported detail for one exact feature |
| `GET /api/events` | Typed snapshot SSE events, heartbeats and source-error events |
| `GET /api/export` | Download complete monitor snapshot |
| `GET /api/releases/{releaseId}/files/{format}` | Download an immutable published artifact |
| `POST /api/ingest` | Authenticated observed snapshot import |
| `PUT /api/release-files/{releaseId}/{format}` | Authenticated immutable staged artifact |
| `POST /api/releases` | Authenticated release manifest commit |

`?mode=demo` is supported by read endpoints only. Demo observations cannot enter the observed ingestion endpoint. The default is observed mode, which remains empty when no source is connected.

Writes require `Authorization: Bearer $MONITOR_INGEST_TOKEN`; absent configuration fails closed. Private Sites service authentication additionally uses its supported platform service credential. No write credential is sent to browser code.

Snapshots use `schemaVersion: 1`, explicit `dataStatus: "observed"`, an ISO `updatedAt`, genome identity and reference length, the entire eligible feature census and run records. Each feature has a stable ID, 1-based inclusive coordinates, research state, reported progress, independent review state, provenance and optional source-linked candidate changes. The census length must equal `eligibleFeatures`.

Research states: unprocessed, queued, researching, synthesizing, validating, completed, failed and cancelled. Review states: not_reviewed, pending, accepted, edited, rejected, no_change, insufficient_evidence and published. A successful DGR task never implies an accepted ChangeSet. The imported CodeXomics report must bind a ChangeSet to its task, or the review state remains unknown. Ambiguous repeated locus tags are not guessed; exact target coordinates are required for their mapping.

Observed snapshots are serialized into persistent storage using ETag compare-and-swap. Stale timestamps and incompatible reference identity are rejected. A published feature must belong to a stored release; incoming snapshots cannot create release manifests or move the latest pointer. Public census responses omit bulky notes and full candidate details; feature detail endpoints provide them separately.

SSE sends an initial snapshot and emits changes when the stored revision changes. Connections close after 55 seconds and the browser reconnects; polling retains visibility during outages. Idle real agents remain idle. Demo progress is synthetic and visibly labeled.
