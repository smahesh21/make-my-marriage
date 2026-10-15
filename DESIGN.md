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
