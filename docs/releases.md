# Immutable release contract

The monitor publishes exported records; CodeXomics remains the authority for scientific review and annotation changes.

```json
{
  "release": {
    "id": "U00096-review-2026-10-12-r1",
    "kind": "reviewed",
    "publishedAt": "2026-10-12T00:00:00Z",
    "label": "Reviewed annotation release",
    "description": "Complete reference annotation with explicitly reviewed changes",
    "reviewedIds": ["b0001"],
    "changedIds": ["b0001"]
  },
  "files": [
    {"format": "gbk", "path": "/path/to/complete-reviewed.gbk"},
    {"format": "gff3", "path": "/path/to/complete-reviewed.gff3"},
    {"format": "fasta", "path": "/path/to/reference.fasta"},
    {"format": "evidence", "path": "/path/to/evidence-manifest.json"},
    {"format": "changesets", "path": "/path/to/exported-changesets.json"}
  ]
}
```

This example specifies a schema, not an observed reviewed release. Replace every value with a verified export. IDs match the exact feature census, including coordinate suffixes for repeated locus tags. The monitor does not adjudicate scientific claims or verify that every qualifier in an uploaded file was independently reviewed.

`kind: "reference"` requires empty reviewed and changed ID lists. A reference snapshot may contain existing annotations, but does not establish their independent quality or curator approval history.

Files are staged separately through authenticated `PUT /api/release-files/{releaseId}/{format}` requests (40 MB maximum each). The authenticated release POST then computes or retrieves SHA-256 and atomically adds the manifest to the current snapshot. Uncommitted staged files are not downloadable through the public API. A failed concurrent publication leaves its files staged; use a fresh ID after reconciling the current state. Existing file keys and release IDs cannot be overwritten.

Download endpoints resolve exact release IDs, not mutable paths. `latestReleaseId` is a separately updated pointer. All original files remain accessible after subsequent releases. The original GenBank download preserves exact source bytes; GFF3/FASTA conversions are derivative files.
