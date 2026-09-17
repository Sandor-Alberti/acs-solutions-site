# ACS Solutions

Personal website redesign, built as a static site. No build step or third-party runtime dependencies.

## Preview

Serve this folder with any static HTTP server. For example:

```sh
python -m http.server 3876 --bind 127.0.0.1
```

Open http://127.0.0.1:3876.

## Files

- `index.html`: personal introduction, featured work, example dashboard, services, payments, About, and contact.
- `site.css`: responsive light theme, hover/focus scrolling project previews, and reduced-motion support.
- `site.js`: sample dashboard period selector and accessible native project preview dialogs.
- `assets/`: supplied portrait and ACS banner, plus screenshots from the local Ben Lammers and T.FIN projects.

The KPI figures are explicitly labeled sample data. Ben's client portal is described as a demo. The CardConnect/Fiserv partnership wording follows Alex's supplied description. Existing email, telephone, LinkedIn, and terms links are retained.

This redesign is on `codex/personal-site-refresh` in an isolated worktree. It has not been published.

The hero leads with a rotating website/dashboard showcase and one work link. The supplied portrait appears in About. Animated SVG circuit signals follow the ACS visual identity. A shared pause control stops hero motion; reduced-motion preferences disable it automatically. Rotation also stops while the showcase is hovered/focused, when the hero is off-screen, and when the tab is hidden.

The footer uses native text and inline SVG, preserving sharp branding at every viewport width. Its ACS blocks align with the right viewport edge. Project windows use fresh full-page captures from the local sites; hover or keyboard focus scrolls the preview, and clicking opens a larger scrollable view. Touch and reduced-motion visitors receive a static preview with the same enlargement action.
