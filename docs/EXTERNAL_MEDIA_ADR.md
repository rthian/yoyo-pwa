# External Media (Prompt 13)

Curated **external** media links for events (YouTube, Vimeo, Twitch, Instagram, generic URL).

## Scope

**In (Prompt 13):** store/validate/list public links; admin CRUD; hub Media tab.  
**In (Prompt 14–15):** allowlisted embed URLs + click-to-load iframe players (YouTube privacy-enhanced, Vimeo, Twitch with `parent`). Instagram/other remain outbound links. No autoplay.

## Model

`event_external_media` rows per event (optional `division_id` scope):

| Field | Notes |
|-------|--------|
| `kind` | `livestream` \| `highlight` \| `routine` \| `photo_album` \| `other` |
| `provider` | Detected from URL: `youtube` \| `vimeo` \| `twitch` \| `instagram` \| `other` |
| `url` | Absolute https URL |
| `title` | Required display label |
| `is_public` | Hub only shows public rows |
| `sort_order` | Ascending |

## Auth

- Write: `manage_event` (owner / organizer / admin)
- Read public: no auth when `is_public` and event is published/active/completed
- Staff preview: `view_ops` can list non-public

## Surfaces

- Admin event tab **Media**
- Public hub tab **Media** (when any public items exist)

## Callers

Referenced by `CLAUDE.md` migrations list; implemented by `lib/media/external.ts`, `app/api/events/[id]/media/route.ts`, `EventMediaPanel`, hub.

## User instruction

`prompt 13`
