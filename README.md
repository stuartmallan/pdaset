# Pegasus Design System

**Pegasus** is the University of Strathclyde's student- and staff-facing web platform, accessed at `pegasus.strath.ac.uk`. It is an umbrella for dozens of individual "apps" — Login / My Account, Announcements, Course Finder, Staff Search, My Bookmarks, Dashboards, Content Manager, Accessibility logs, and more — all sharing a common chrome (header, sidebar, breadcrumbs, footer) and a single Vue 3 component library called **PegUI**.

This design system is a recreation of PegUI's visual and interaction language so agents can generate brand-correct mockups, prototypes and artifacts.

## Source material

- **Codebase:** PegUI Vue 3 component library (`peg-ui/`, provided via local mount). Package `peg-ui@4.0.1` by Martin Stewart.
  - Core tokens: `peg-ui/src/sass/_variables.scss`
  - Pegasus styles: `peg-ui/src/sass/pegasus/**`
  - Components: `peg-ui/src/components/**` (Vue 3 SFCs)
  - Live hosted assets: `https://pegasus.strath.ac.uk/peg-assets/...` (logos, loader SVG, remote header/footer module)
- **Hosted environments:** `pegasus.mis.strath.ac.uk`, `pegasus.strath.ac.uk`, plus test/dev peers.
- **Storybook:** component documentation lives in `peg-ui/src/stories/**` (categories: Getting Started, General, Application, Layout, Navigation, Forms, Data-Display, Feedback, Overlays, Search, System, Composables).

## The product universe

PegUI powers **a single web product** — Pegasus — but it ships as a library used across **many sub-apps** that plug into a common shell (`PegApp`):

1. **Pegasus shell** — the login/home experience at `pegasus.strath.ac.uk`. Top dark-blue header with the Pegasus winged-horse logo, optional sidebar menu, breadcrumbs band, dark footer.
2. **My Account** — personal profile, password/security, bookmarks, notifications, preferences.
3. **Application apps** — Course Finder, Staff Search, Address Finder, Service Finder (search-heavy).
4. **Content Manager** — CMS for editable text blocks, served into components via API.
5. **Admin apps** — data tables, cron builders, form designers, announcements editor.

Visually, all of these look the same. This design system captures the shared shell + components.

## File index

```
README.md                 – this file
colors_and_type.css       – CSS custom properties + semantic styles
SKILL.md                  – Claude Code skill manifest
fonts/                    – note on fonts (Google-fonts substitution)
assets/                   – logos, loader, icons documentation
preview/                  – design-system tab cards
ui_kits/
  myaccount/              – My Account portal recreation:
                            LoginScreen, DashboardScreen, ProfileScreen,
                            BookmarksScreen, NotificationsScreen,
                            PegShell, Primitives (buttons/inputs/cards/…)
```

## How to use this system

1. Start from `colors_and_type.css` — it gives you every token you need.
2. For real UI work, copy `ui_kits/myaccount/styles.css` and `Primitives.jsx` / `PegShell.jsx`. The whole portal is <700 lines of JSX; it's cheaper to adapt than to restyle Bootstrap.
3. The `preview/` folder is reference only — 17 self-contained cards you can peek at for exact spacings, tile treatment, button states, etc.
4. Fonts are **Alegreya Sans** (headings) and **Roboto** (body + UI) — loaded via Google Fonts. The original PegUI pulls both from Google as well. Flag: if you need offline-safe builds, drop `.woff2` files into `fonts/` and swap the `@import` in `colors_and_type.css` for `@font-face`.


---

## CONTENT FUNDAMENTALS

Pegasus copy is **direct, institutional, British, and unfussy**. It sounds like a university administrator talking to you through a web form — polite, specific, occasionally formal.

### Voice and tone
- **Second-person, plural of address.** "Logging in as **jbloggs**". "Your password has expired." "These aren't the droids you're looking for."
- **British English.** "authorise" (not authorize), "personalisation", "organisation", "sanitise". Spell-checking follows en-GB.
- **Functional first, friendly second.** Copy tells you what happened, what to do next, and who to contact. Wit is rare and dry; there is one Star Wars reference in the alert example (`"These aren't the droids you're looking for."`) — that's the ceiling.
- **Institutional register.** Words like "application", "referee", "advisor", "enquiry", "helpdesk", "service message", "announcement", "bookmark". Not "tickets", not "gotchas", not "✨".

### Casing
- **Sentence case everywhere.** Button labels, headings, menu items: "Forgotten password/username?", "Filter sidebar items", "Collapse sidebar", "Back to previous app". NOT Title Case.
- Acronyms and product names keep their native casing: PEGASUS (sometimes all-caps in login screen), Strathclyde, PegUI, Azure AD.
- Form labels are sentence case: "Username", "Password", "Email address".

### Buttons and actions
- Verbs: "Login", "Next", "Back", "Collapse sidebar", "Expand sidebar", "Email me my password", "Please wait…"
- A loading state always replaces the label: "Logging in…", "Please wait…"
- Destructive or unavailable actions carry an explicit disabled tooltip ("Button disabled", etc).

### Microcopy patterns seen in-codebase
- `"Logging in as **{username}**"` — during two-step login
- `"Filter sidebar items"` — placeholder + tooltip
- `"Forgotten password/username?"` — slash, no "or"
- `"No items"` — empty state
- `"Loading, please wait…"` — generic wait copy
- `"if issue persists please contact the helpdesk"` — error fallback
- Error toasts/alerts use a `type` prop (`info` | `success` | `danger` | `warning`). Copy leads with the problem, ends with the remedy.

### Emoji, icons-in-copy, decoration
- **No emoji.** Not in UI, not in copy. Use FontAwesome icons through `<peg-icon>`.
- **No em-dashes-as-separators, no ALL-CAPS emphasis, no exclamation points** except in the single "obvs" JSDoc joke and welcome messages.
- Help text uses a gray pill with a leading "?" FontAwesome glyph (`\f128`) — never a raw question mark.

---

## VISUAL FOUNDATIONS

Pegasus is **Bootstrap 4.1 skinned with University of Strathclyde corporate colours**. It is professional, dense, utilitarian, and accessible-first. There are no decorative gradients, no hero illustrations, no glassmorphism, no motion-heavy flourishes — the look is **administrative software**, done well.

### Colour
- **Primary ("corpblue"):** `#002b5c` — deep navy. Owns the top header, primary brand surface, active/focus borders.
- **Accent blue ("strath-blue"):** `#0078ae` — mid-cyan. Used for links, form-field labels, focus outline, the characteristic 100px "blue-hr" rule under headings, and the 4px header tab indicator.
- **Primary action:** `#018489` — Pegasus teal. All `btn-primary` buttons. Hover/active darkens 10%.
- **Highlighted:** `lighten($strath-blue, 55%)` — very pale cyan for selection/hover.
- **Grayscale (Bootstrap defaults):** `#fdfdfd → #212529` in 10 steps; `gray-accessible` = `$gray-700` (`#495057`) for AAA text.
- **Semantics:** danger `#e82011`, warning `#f47b20`, success `#218739`, info `#0078ae`.
- **Alert link colour override:** `#006594` — slightly deeper than strath-blue so bold links inside alert bodies read well.
- **Code text:** `#a41357` — deep magenta.
- **Footer:** `$gray-900` (`#212529`) background, white text.

### Typography
- **Body:** `"Roboto", Arial, Verdana, sans-serif`, base 1rem (16px), line-height 1.4 on paragraphs.
- **Headings:** `"Alegreya Sans", sans-serif`, with a *responsive scale* — headings shrink on xs/sm/md breakpoints via `$header-xs-scale: 0.7 → $header-lg-scale: 1`.
- **Mono:** `SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` — used inside `pre`, `code`, `kbd`, `samp`, always on `$gray-100` background with 1rem padding, `white-space: pre-wrap`.
- **Font weight for bold:** `500` (not 700). Subtle.
- **Scale:** h1 1.9rem, h2 1.75rem, h3 1.5rem, h4 1.25rem, h5 1.1rem, h6 = base. Labels = base.
- **Icons:** `"FontAwesome"` (v4) via `<peg-icon :icon="...">` — the entire system references FA4 names without the `fa-` prefix.

### Spacing
- `$spacer = 1rem`. Bootstrap 4.1 spacing scale (`p-0 p-1 p-2 p-3 p-4 p-5`, m-equivalents).
- Container paddings: sidebar 20rem, collapsed mobile sidebar 5rem, header 3.75rem, footer 3.75rem, breadcrumbs 3.125rem.
- Form max width: 600px. Aside max: 31.25rem.

### Corner radii
- Default border-radius from Bootstrap (`$border-radius` ≈ 0.25rem).
- **Buttons are pills:** `$btn-border-radius: 20px` — all sizes. This is the most recognisable Pegasus tell.
- **Form controls are "tab-topped":** top corners rounded, bottom corners square; bottom border darker (`$gray-accessible`). On focus, the bottom re-rounds and the whole control gets the strath-blue border.

### Shadows, borders, elevation
- `$box-shadow-md: 0 0.25rem 0.3125rem rgba(black, 0.15)`
- `$box-shadow-md-hover: 0 0.25rem 0.5rem rgba(black, 0.4)`
- `$box-shadow-md-white: 0 0.25rem 0.3125rem rgba(white, 0.15)` (for dark backgrounds)
- Standard border: 1px `$gray-300`. "Accessible border": 1px `$gray-accessible` (used on form-control bottom edge).
- `blue-border: 4px solid $strath-blue` — used as a heavy accent; also used as the header-tab active indicator (4px × 24px teal block at the bottom of the active header icon).

### Backgrounds / surfaces
- **No imagery in the shell.** Body is `$white`. Breadcrumbs band is `$gray-200`. Header is `$primaryblue`. Footer is `$gray-900`. Sidebar background is `$gray-100` with a `$gray-400` 1px right border.
- **No gradients.** Ever. Flat fills.
- **No textures, patterns, grain.** Pure surfaces.
- **Login uses a pegasus logo** (`pegasus-logo-with-text-portrait.svg`, 200px wide) centred above the form; the form sits on a `gray-100` "form-bg" with 1px `gray-200` border.

### Cards
- Bootstrap `.card` (white, 1px `$gray-300` border, subtle radius).
- **Hover recolours in 0.3s:** on a link-wrapped card, `.card-header` turns `$primaryblue` with white text; `.card-body` turns `$gray-200`. This is the signature card interaction — strong, confident, hover-as-selection.

### Animation
- **Minimal.** Transitions are 0.15–0.3s ease on `background`, `border`, `box-shadow`, `color`, `left`, `max-height`, `opacity`, `top`.
- **"animated fadeIn"** wrapper class on the main content area — a fade-in on app mount, nothing more.
- The header icons slide down and fade in on mobile via a `show-icons` keyframe (80ms, from `top: 1.5rem → 2rem`, opacity 0 → 1).
- **No bounces, springs, overshoot, parallax, scroll animations.**

### Hover / focus / press states
- **Hover:**
  - Links lose underline (`text-decoration: none` on `a:hover`) — unusual but deliberate; links already have underline via `text-decoration: underline !important` on specific components.
  - Primary buttons darken 10% on hover/active/focus.
  - Sidebar dashboard tile icons turn strath-blue.
- **Focus (visible):**
  - `.btn:focus` → outline `0.2rem solid $strath-blue`, offset `1px`, plus a box-shadow pair.
  - Form controls: border becomes `$strath-blue`, bottom radius returns.
  - Focusable content has `scroll-margin-top: header + 1.25rem` and `scroll-margin-bottom: footer + 1.25rem` so keyboard-scrolled items aren't hidden behind the fixed chrome.
- **Press/active:** same as hover for primaries (no extra shrink/scale).
- **Disabled:** `aria-disabled="true"` + `pointer-events: none`, opacity dropped to Bootstrap's `$btn-disabled-opacity` (0.65). Icon buttons in the header use `opacity: .5`.

### Transparency / blur
- No `backdrop-filter`, no translucent cards.
- Modal backdrop is Bootstrap's default dim overlay (`.modal-backdrop.fade.show`, 0.5 black).
- Tooltip arrows + inner use Bootstrap defaults.
- Profile-picture "missing" state uses an SVG initials avatar, never a blurred placeholder.

### Layout rules
- **Fixed top header** (min-height 300px viewport). **Fixed footer** at `lg+` breakpoint. **Fixed sidebar** on `lg+`. All elevation layered with explicit `z-index`: header=4, icons=4/5, sidebar=1, breadcrumb wrapper=0, footer=2.
- Main content scrolls inside the remaining viewport. Skip-to-content link for a11y.
- Content width: 1200px max on `.header-menu`; `main` inherits a fluid Bootstrap grid.
- Sidebar collapses to 5rem (icons-only) via a toggle that writes `desktopSidebarCollapsed=true` to a cookie.

### Iconography vibe
- **Everything is FontAwesome 4.** Names like `star`, `angle-right`, `angle-double-left`, `cog`, `user-circle`, `envelope`, `plus`, `eye-slash`, `warning`, `check-circle`, `info-circle`, `search`, `home`, `book`, `loading` (custom). No Lucide, no Material, no Heroicons.
- **Flat, line-filled FA4 glyphs** — no duotone, no brand-stroke weight overrides, no custom line weights. Size scales with `font-size` inherited.
- **Breadcrumb divider** is the FA4 chevron-right unicode (`\f054`).
- **Home link** in breadcrumbs is the FA4 `fa-home` glyph.

### Imagery
- The only imagery shipped is **the Pegasus winged-horse logo** (portrait SVG with tagline) and an `loader.svg` spinner. Both hosted at `pegasus.strath.ac.uk/peg-assets/images/`.
- **No stock photography.** No full-bleed marketing imagery. No illustrations. Any screen that wants a "hero" area uses the logo on a form card.

---

## ICONOGRAPHY

Pegasus uses **FontAwesome 4** throughout — loaded as a remote script from `use.fontawesome.com/7fa7667ab8.js` in Storybook, and as the shell package's default icon font in production. Every icon in the UI flows through `<peg-icon :icon="name" />`, which renders `<span class="fa fa-{name}" aria-hidden="true">` with a sibling screen-reader label.

- **Icon font:** FontAwesome 4.7 (kit `7fa7667ab8`). Names are passed without the `fa-` prefix.
- **SVG usage:** limited to the brand logo (`pegasus-logo-with-text-portrait.svg`), the loader (`loader.svg`), and generated initials-avatar SVGs for missing profile pictures.
- **PNG icons:** none — the codebase has no raster icons.
- **Emoji / unicode as icons:** not used, except the breadcrumb divider (FA4 chevron-right via `unicode(\f054)`).
- **Custom "loading" icon:** the name `loading` is re-routed to `fa-spinner fa-spin`-style behaviour via a regex in `<peg-icon>`.
- **Interaction colour:** icons in buttons inherit the button's text colour; link-style buttons get `$gray-600` on the icon, flipping to `$strath-blue` on hover.

In this design system we reference FontAwesome 4 via the same CDN kit used by production; no icon files are copied locally. See `assets/README.md` for the exact CDN reference.

---

## Known substitutions / caveats

- **Fonts:** `Roboto` and `Alegreya Sans` are loaded from Google Fonts in our HTML previews; we do not ship local TTF/WOFF files. Production Pegasus uses the same families (Google Fonts in the remote header). No substitution.
- **Brand logo:** we link directly to the live hosted `pegasus.strath.ac.uk/peg-assets/images/pegasus-logo-with-text-portrait.svg` rather than vendoring a copy. If the CDN is unreachable, a text fallback ("PEGASUS") shows.
- **Remote header/footer:** the real Pegasus app loads a Module-Federation remote (`peg_assets/Header`). Our UI kit recreates the header cosmetically; it is not functionally identical.
- **Bootstrap:** the codebase locks to Bootstrap 4.1 with a local copy of its SCSS partials. Our HTML previews use hand-authored CSS that follows Bootstrap 4 class names where it helps clarity, but we do not include Bootstrap wholesale.
