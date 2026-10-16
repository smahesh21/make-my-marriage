# Design System: Make My Marriage

## Visual theme

Make My Marriage is a calm, editorial workspace for the people carrying an Indian wedding together. The landing page should feel like a well-composed invitation crossed with a thoughtful planning tool: warm, spacious, confident, and useful. Use an asymmetric editorial rhythm with an airy density, purposeful image moments, and restrained motion.

## Color palette

- **Warm Ivory** (`#FBF9F4`) — primary canvas and page background.
- **Paper White** (`#FFFFFF`) — elevated surfaces and form controls.
- **Charcoal Ink** (`#1B1C19`) — primary text; never use pure black.
- **Muted Olive** (`#5C5F5B`) — supporting copy, metadata, and labels.
- **Soft Stone** (`#E4E2DD`) — borders and structural dividers.
- **Deep Sage** (`#52604C`) — structural accents, selected text, and workspace navigation.
- **Muted Sage** (`#75836D`) — primary action surfaces and restrained brand highlight.
- **Muted Sage hover** (`#606D59`) — pressed and hover state for primary actions.

Do not introduce purple, neon, oversaturated gradients, or a second competing accent.

## Typography

- **Display:** Noto Serif — warm editorial serif for hero and major section headings.
- **UI and body:** Inter — compact, clear, and readable at mobile sizes to match the Stitch workspace system.
- **Body measure:** keep paragraphs near 65 characters per line.
- **Scale:** use controlled `clamp()` sizing; the hero should feel confident, never oversized for its own sake.

Generic serif fonts and dashboard serif typography are banned. Inter is reserved for operational UI copy and data, not display headlines.

## Layout and components

- Use an asymmetric grid rather than three equal feature cards.
- Contain content at `min(1440px, calc(100% - 2 * gutter))` with generous whitespace.
- Collapse every multi-column composition below `768px`.
- Full-height surfaces use `min-height: 100dvh`, never `100vh` or `h-screen`.
- Top navigation headers use a consistent `56px` height and `12px 16px` padding
  across public, authentication, and workspace screens; fixed headers reserve
  the same height in the content below. Section eyebrow labels have no bottom margin.
- Standard text/action buttons use a compact `32px` height including padding;
  icon-only controls may remain larger when needed for comfortable interaction.
- Cards use quiet borders and warm, diffused shadows only when elevation communicates hierarchy.
- Primary buttons are solid sage with tactile press feedback; secondary actions are quiet text links or outlined controls.

## Content rules

Describe the product as a shared wedding workspace for couples and family members. Mention events, tasks, guests, invitations, RSVPs, expenses, vendors, wedding websites, livestream links, and private photo sharing. Do not promise budget planning, automated WhatsApp or SMS messaging, hotel/flight management, extra permission roles, or real-time collaboration.

## Motion

Use short spring-like transitions on hover and press states, plus staggered entrance reveals where appropriate. Animate only `transform` and `opacity`. Respect `prefers-reduced-motion` and remove non-essential motion when it is enabled.

## Banned patterns

- No emojis, neon glows, pure black, or generic AI marketing phrases.
- No centered, generic hero with a wall of copy.
- No three-equal-card feature row.
- No overlapping text and images.
- No fake percentages or unsupported product claims.
- No filler prompts such as “scroll to explore”.

## Guest workspace — Stitch implementation reference

Use the revised desktop registry (`534eca3bd65a4fa2a027530c6cee0bb6`), add
drawer (`2094e94b1f8645a284e45eeaf84e5f5b`), and details drawer
(`26b428edcb534e2da4812c82bed874f0`) in Stitch project `10501377685127019753`.
Keep the existing palette and typography above, balanced operational density,
compact 32px actions, 44px fields, 56px headers, and an 8px spacing rhythm.
Use five restrained summary tiles, a wrapping fixed-layout registry, and a
right-hand drawer with a single scrolling body and persistent header/footer.
At smaller widths stack guest rows into readable labelled groups instead of
clipping columns. Preserve visible focus and restrained transform/opacity motion.
States include skeleton loading, empty/no results, inline validation, retained
failed drafts, explicit read retry, discard confirmation, and destructive-action
confirmation. Never reproduce prototype-only CSV, cohorts, waitlists, tracking,
or automated messaging. Invitation-group counts and actual attendance are
different metrics. Bulk campaigns remain deferred; do not add inactive controls
that suggest they already work.

## Guest invitations — Stitch implementation reference

The public page follows revised screen `13923c7ae5a74bcfa0bb9385babeb297`:
minimal 56px brand header, ivory canvas, centred editorial invitation panel,
couple names and group greeting, wedding date/location, then a two-column ceremony
itinerary and RSVP panel. Use real invited event data only; no unconfigured stock
venue photo, all-access badge, dietary fields, deadline, or account controls.
Below 768px stack the itinerary and response form. Keep 32px text actions and 44px
inputs, visible keyboard focus, and zero page-level horizontal overflow.
Pending responses start without a preselected answer. Saved Yes/No responses
have a calm confirmation and Change response. Validation, temporary load failure,
generic unavailable links, preserved failed drafts, capacity conflicts, and
rate-limit retry guidance reuse the established inline-feedback language.
The details drawer's sharing panel explicitly reveals a stable private link,
offers Copy/Open/manual WhatsApp draft, and explains holder access and manual-copy
fallback. Email sends/resends and reminders require recipient confirmation; show
provider acceptance as Sent, never Delivered. No simulation controls are included.

## Photos & Gallery — Stitch implementation reference

The organiser increment follows gallery screen `8c73e51b8ca14010beea23192680c788`
and upload drawer `7596f6387a1b4712a6b580684403398c` in project
`10501377685127019753`. Retain the ivory canvas, editorial Noto Serif headings,
Inter operational text, sage accents, quiet stone borders, 8px spacing rhythm,
56px headers and 32px actions. The responsive collection uses wrapping event
filters, a four-column desktop image grid with one wider editorial image,
compact-grid toggle, original-aspect viewer, and explicit cursor pagination.
Below 768px stack the content without horizontal page overflow. Uploads use a
right-hand drawer with one scrolling body and persistent header/footer. Show
per-file progress, retained failed drafts, individual retries, discard warnings,
and confirmation for permanent deletion. Respect reduced motion and trap dialog
focus, restoring it on dismissal.

Prototype-only search by tags, highlights, view counts, named guest attribution,
passcodes, live sync, public-website controls, and unsupported formats/large-file
claims are not implemented. Use real filenames, dates, event names and counts.
The public gallery and sharing/QR designs exist but remain a later increment as
specified by the current API clarification. Do not show inactive sharing controls
or expose a stable token before that feature is implemented.
