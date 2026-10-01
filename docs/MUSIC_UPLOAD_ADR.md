# Music Upload Architecture (Prompt 9 ADR)

Design only — implementation follows in Prompt 10 MVP.

## 1. Data model

| Table | Purpose |
|-------|---------|
| `music_requirements` | Per stage (`division_id`): deadline, max duration sec, allowed formats, max bytes, policy text |
| `music_submissions` | One row per competitor + division (stage) |
| `music_submission_versions` | Immutable versions; one `is_active` |
| `music_audit_events` | Append-only grant/upload/approve/reject/exception |

Statuses on submission: `missing | uploaded | processing | flagged | approved | rejected | locked`

## 2. Storage paths & bucket

- Private bucket: `competition-music`
- Path: `events/{event_id}/divisions/{division_id}/competitors/{competitor_id}/{version_id}.{ext}`
- No public ACL; only signed URLs (≤ 5 minutes upload, ≤ 2 minutes preview)
- Storage RLS: service role for server; no anon read

## 3. Upload & processing sequence

1. Client requests signed upload URL (auth + manage competitor + window/deadline).
2. Client PUTs bytes to signed URL.
3. Client confirms upload with checksum (SHA-256 of file).
4. Server creates version (`processing`), sets active, submission → `uploaded`/`processing`.
5. Async inspector interface (`MusicInspector`) validates type/size/duration; until then status stays `processing`.
6. Organizer approves → `approved`; can flag/reject with reason.

## 4. Threat model

| Threat | Mitigation |
|--------|------------|
| IDOR read/replace | Server resolves competitor ownership; never trust client competitor_id alone |
| Public bucket leak | Private bucket + short-lived signed URLs |
| MIME spoofing | Server-side magic-byte check in inspector; browser MIME ignored |
| Deadline bypass | Server time vs `music_deadline_at` / requirement deadline; exceptions table |
| Guardian/minor | `account_manages_competitor(..., 'music')` |
| Path traversal | Server-generated storage paths only |

## 5. File validation

- Allowed: `audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/mp4` (m4a)
- Max size: requirement.max_bytes (default 20MB)
- Duration: inspector; pending if worker unavailable
- Checksum required on confirm

## 6. Authorization matrix

| Action | Admin | Event music_manager / owner / organizer | Linked account (music) | Public |
|--------|-------|------------------------------------------|------------------------|--------|
| Set requirement | F | F | — | — |
| Upload/replace | F | — | W | — |
| Preview own | F | R | R | — |
| Approve/reject | F | F | — | — |
| Signed download for stage | F | F (ops) | — | — |

## 7. User flows

**Competitor:** registration → music tab → upload → preview → status.  
**Organizer:** readiness list by division → approve/flag → export running-order manifest later (Prompt 11).

## 8. Background jobs

- `MusicInspector.inspect(versionId)` — interface only in MVP; may no-op to `uploaded` with `validation_pending=true`.

## 9. MVP boundaries (Prompt 10)

In: requirements, signed upload, versions, checksum, deadline, competitor UI, organizer readiness, audit.  
Out: full stage player, offline cache playlist, hosted waveform, automatic loudness.

## Approval

Treated as approved for Prompt 10 implementation in this playbook run (user requested 9 then 10 continuously).
