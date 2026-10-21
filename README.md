# Artofy Studio

A complete, buildless anime artist portfolio with eleven real HTML pages. The redesign follows **The Living Artist’s Sketchbook**: warm paper tone, graphite details, restrained pink accents, layered artwork sheets, handwritten annotations, and an interactive 3D WebGL sketchbook.

---

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Page Inventory](#page-inventory)
- [System Architecture & Design Principles](#system-architecture--design-principles)
- [JavaScript Modules & APIs](#javascript-modules--apis)
  - [1. `assets/js/main.js`](#1-assetsjsmainjs)
  - [2. `assets/js/hero.js`](#2-assetsjsherojs)
  - [3. `assets/js/scroll-motion.js`](#3-assetsjsscroll-motionjs)
  - [4. `assets/js/pencil-cursor.js`](#4-assetsjspencil-cursorjs)
- [CSS Visual & Motion System](#css-visual--motion-system)
  - [`assets/css/site.css`](#assetscsssitecss)
  - [`assets/css/motion.css`](#assetscssmotioncss)
- [Inquiry & Commission Workflow](#inquiry--commission-workflow)
- [Local Preview & Development](#local-preview--development)
- [Verification & Automated Test Suite](#verification--automated-test-suite)
  - [`scripts/check.py`](#scriptscheckpy)
  - [`scripts/check-interactions.mjs`](#scriptscheck-interactionsmjs)
  - [`scripts/check-cursor.mjs`](#scriptscheck-cursormjs)
  - [`scripts/check-upgrade.py`](#scriptscheck-upgradepy)
- [Asset Provenance & Licenses](#asset-provenance--licenses)

---

## Overview

Artofy Studio is an anime artist portfolio built directly on web standards with standard HTML, CSS, and modern JavaScript modules. It requires no build step, transpiler, bundler, or external package manager at runtime. It features:

- **11 Complete HTML Pages**: Fully functional, static navigation with relative paths ready for GitHub Pages or any static host.
- **Interactive 3D WebGL Hero**: Built with local Three.js r169 featuring physical spread geometry, 2-sided page turning, curved paper deformation, and lifting artwork sheets.
- **GSAP ScrollTrigger Animation System**: Smooth desktop pinning over 140vh scroll travel, depth gallery parallax, and stroke animations.
- **Interactive Pencil Drawing Canvas**: ES module Canvas 2D engine with independent line group aging, strict memory bounds, and text/element protection.
- **Accessible Lightbox & Form Processing**: Client-side validated mailto/clipboard inquiry workflow with focus containment and keyboard accessibility.
- **Comprehensive Automated Test Suite**: Built-in Python and Node.js test scripts validating HTML structure, interaction logic, canvas cursor mechanics, and asset references.

---

## Directory Structure

```
artofystudio/
├── README.md                      # Complete project documentation
├── VERIFICATION.md                # Manual and visual browser check instructions
├── UPGRADE-VERIFICATION.md        # Upgrade verification guidelines
├── index.html                     # Homepage with 3D WebGL sketchbook and gallery
├── artwork.html                   # Artwork gallery with accessible lightbox dialog
├── about.html                     # Studio approach and detailed artwork breakdown
├── commissions.html               # Commission packages and pricing
├── process.html                   # 4-step workflow (Request → Discuss → Creation → Delivery)
├── faq.html                       # Verified studio FAQs and accordion
├── contact.html                   # Validated email inquiry form
├── artwork/                       # Detail pages for individual portfolio works
│   ├── fantasy-battle.html
│   ├── character-illustration.html
│   ├── fantasy-warrior.html
│   └── anime-knight.html
├── assets/
│   ├── ASSETS.md                  # Detailed asset provenance
│   ├── favicon.svg                # Studio favicon
│   ├── paper-grain.svg            # Subtle paper background overlay
│   ├── css/
│   │   ├── site.css               # Visual foundation, layout, typography, base components
│   │   └── motion.css             # Depth sheets, gallery perspective, GSAP motion styles
│   ├── js/
│   │   ├── main.js                # Menu, reveal observer, lightbox dialog, inquiry form
│   │   ├── hero.js                # Three.js 3D sketchbook WebGL renderer
│   │   ├── scroll-motion.js       # GSAP / ScrollTrigger scroll timeline owner
│   │   └── pencil-cursor.js       # Interactive graphite canvas drawing module
│   ├── images/                    # Preserved original JPEGs, WebP derivatives, detail SVGs
│   ├── fonts/                     # Self-hosted Outfit, Inter, Caveat variable WOFF2 fonts
│   └── vendor/                    # Local pinned dependencies (Three.js 0.169.0, GSAP, ScrollTrigger)
└── scripts/                       # Comprehensive verification test suite
    ├── check.py                   # Page structure, link, metadata & hash validation
    ├── check-interactions.mjs     # Dialog, form validation, email draft & accessibility tests
    ├── check-cursor.mjs           # Pencil cursor lifecycle, memory, and bounds tests
    └── check-upgrade.py           # Asset & responsive media verification
```

---

## Page Inventory

| File Path | Description | Key Features |
| --- | --- | --- |
| `index.html` | Portfolio Homepage | Interactive 3D sketchbook stage, featured artworks, studio intro, package previews |
| `artwork.html` | Artwork Gallery | Asymmetric 4-work grid, accessible modal lightbox dialog with arrow navigation |
| `about.html` | Studio About Page | Design philosophy, studio tools diagram, labelled artwork crop detail |
| `commissions.html` | Packages & Pricing | Three commission packages (Sketch, Full Color, Premium Scene) and inquiry CTA links |
| `process.html` | Studio Process | Illustrated 4-step workflow path with SVG line animation |
| `faq.html` | Frequently Asked Questions | Native accessible summary/details accordion answering pricing, terms, and timeline |
| `contact.html` | Contact & Inquiries | Validated email draft generator with auto-preselection and manual copy backup |
| `artwork/fantasy-battle.html` | Artwork Detail Page | Complete Fantasy Battle artwork, story details, breadcrumbs, next/prev navigation |
| `artwork/character-illustration.html` | Artwork Detail Page | Complete Character Illustration artwork, story details, breadcrumbs, next/prev navigation |
| `artwork/fantasy-warrior.html` | Artwork Detail Page | Complete Fantasy Warrior artwork, story details, breadcrumbs, next/prev navigation |
| `artwork/anime-knight.html` | Artwork Detail Page | Complete Anime Knight artwork, story details, breadcrumbs, next/prev navigation |

---

## System Architecture & Design Principles

1. **Buildless Standard Compliance**: Zero `node_modules` or build step required for deployment. All assets and vendor libraries are checked in and referenced relatively.
2. **Progressive Enhancement**: Content is completely accessible without JavaScript. Standard standard `<summary>/<details>` HTML is used for accordions, standard links navigate between pages, and CSS handles core layouts. JavaScript adds optional interactivity (3D WebGL, scroll triggers, custom cursor, email draft composition).
3. **Resilient Failure Fallbacks**: If WebGL is unsupported or fails, the 3D hero stage degrades gracefully to a responsive 2D illustration layout without empty pinned spacing. If GSAP fails, an `IntersectionObserver` handles section reveals.
4. **Accessibility First (`a11y`)**:
   - Focus trap and focus restoration inside dialog modals.
   - Full keyboard navigation (`Escape`, `ArrowLeft`, `ArrowRight`, `Tab`).
   - High-contrast typography and native input preservation.
   - `prefers-reduced-motion` compliance across WebGL, GSAP, and Pencil drawing canvas.

---

## JavaScript Modules & APIs

### 1. `assets/js/main.js`
Applies site-wide progressive enhancements upon `DOMContentLoaded`.
- **`initMenu()`**: Handles responsive mobile drawer toggling (`aria-expanded`), backdrop escape key dismiss, and desktop viewport resets.
- **`initReveals()`**: Standard `IntersectionObserver` fallback for element fade/slide triggers when GSAP is disabled or unavailable.
- **`initLightbox()`**: Intercepts `data-lightbox` links, managing `<dialog id="art-lightbox">` modal display with index tracking, image counter updates, scroll locking, backdrop dismiss, and keyboard navigation.
- **`initInquiry()`**: Validates form input fields (`name`, `email`, `type`, `details`, `reference`), preselects commission query param `?type=`, formats encoded `mailto:` drafts, and provides a clipboard/manual text copy fallback.

### 2. `assets/js/hero.js`
Renders an interactive WebGL 3D sketchbook using vendored Three.js r169 (`assets/vendor/three.module.js`).
- **Scene Assembly**: Construct physical left/right book blocks, paper edge texturing, cloth bookmark, graphite line art overlay, desk surface, eraser, and pencil geometry.
- **Curved Page & Advanced Turn Physics**: Uses vertex deformation routines (`pageHeight`, `curvedSheet`, `turningPicture`) to animate 2-sided page rotation around the book spine spine hinge.
- **Lifting Artwork Sheet**: Animates a secondary artwork sheet rising as scroll progress advances into the final section phase.
- **Performance & Safety**:
  - Automatically pauses rendering when out of viewport or hidden (`IntersectionObserver` + `visibilitychange`).
  - Caps resolution density dynamically based on device pixel ratio and viewport dimensions.
  - Listens for context loss (`webglcontextlost`) and cleans up resources via `dispose()`.

### 3. `assets/js/scroll-motion.js`
Controls page motion timelines with pinned GSAP 3.13.0 and ScrollTrigger.
- **`gsap.matchMedia()`**: Dynamically configures animation timelines based on device conditions (`min-width: 768px`, `hover: hover`, `prefers-reduced-motion`).
- **Hero Pinning**: Pins `.hero-stage` for 140vh of scroll distance on desktop, publishing normalized progress `0..1` via custom `artofy:hero-progress` events to `hero.js`.
- **Depth Gallery & Parallax**: Applies 3D tilt effects (`[data-depth-sheet]`), element entrance staggers (`.package-grid`), and SVG path drawing trigger animations (`.process-path`).

### 4. `assets/js/pencil-cursor.js`
An ES module exporting `createPencilCursor({ window, document, config })` and `PENCIL_CONFIG`.
- **Canvas 2D Overlay**: Appends a transparent full-screen overlay canvas (`.pencil-trails`) and pencil tip cursor (`.pencil-pointer`).
- **Drawing Bounds & Protection**: Excludes protected interactive elements (`PROTECTED` selector list including buttons, inputs, links, headings, paragraphs, dialogs, artwork frames). Drawing is restricted to empty paper surfaces marked with `data-drawing-area`.
- **Stroke Lifecycle & Memory Limits**:
  - Strokes age individually: held for 2,500ms, then faded out over 400ms.
  - Enforces strict memory caps (`maxGroups: 40`, `maxTotalPoints: 2400`, `maxGroupMs: 240`).
  - Clears stale strokes on window scroll, resize, focus loss, selection, or modal open events.

---

## CSS Visual & Motion System

### `assets/css/site.css`
Contains design tokens, typography, layout grids, components, and media queries.
- **Color Tokens**: `--paper` (`#F7F3EB`), `--ink` (`#252321`), `--pink` (`#C74378`), `--muted` (`#6B665F`), `--rule` (`#D8D1C6`), `--sheet` (`#FFFDF7`).
- **Typography System**:
  - `--display`: `Outfit, Arial, sans-serif`
  - `--body`: `Inter, Arial, sans-serif`
  - `--note`: `Caveat, 'Segoe Print', cursive`
- **Responsive Components**: Site header navigation, commission package cards, artwork grid, detail page breadcrumbs, form controls, and accessible dialog styles.

### `assets/css/motion.css`
Enhances layout presentation with 3D transforms and motion triggers.
- **Gallery Depth**: Establishes 3D perspective (`perspective: 1200px`), interactive tilt transforms (`rotateX`, `rotateY`), tape embellishments, and layered paper drop shadows.
- **Process Line Drawing**: Configures CSS custom properties (`--path-length`) and stroke-dasharray properties for smooth animated process line reveals.

---

## Inquiry & Commission Workflow

The inquiry form operates completely client-side without requiring a server submission backend:

1. **Package Preselection**: Commission links from `commissions.html` pass query parameters (e.g. `contact.html?type=full-color`), which `main.js` pre-selects in the form field.
2. **Client-Side Validation**: Real-time checking validates required inputs, email formatting, allowable commission types (`sketch`, `full-color`, `premium-scene`, `unsure`), and optional HTTP/HTTPS reference links.
3. **Email Draft Generation**: Submitting constructs a pre-formatted email subject and body, then invokes `mailto:artofystudio@gmail.com`.
4. **Copy Fallback**: If the email client fails to open or is blocked, an alternative **Copy inquiry text** button places formatted text directly into the user's clipboard or displays a pre-selected selectable text area.

---

## Local Preview & Development

Because the site uses standard ES modules (`import`/`export`) and WebGL texture assets, view the site through an HTTP web server rather than the `file://` protocol.

From the repository root, execute:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html` in any web browser.

---

## Verification & Automated Test Suite

The codebase includes automated test scripts in the `scripts/` directory.

Execute the full verification suite with:

```sh
python3 scripts/check.py
node scripts/check-interactions.mjs
node scripts/check-cursor.mjs
python3 scripts/check-upgrade.py
node --check assets/js/main.js
node --check assets/js/hero.js
```

### `scripts/check.py`
Validates repository integrity using Python standard library:
- Confirms all 11 HTML pages exist and contain unique titles, headings, and meta descriptions.
- Verifies 376+ relative internal link references across all files.
- Checks cryptographic hashes of original portfolio JPEG artwork to guarantee zero accidental modification.
- Ensures font licenses and commission package specifications are preserved.

### `scripts/check-interactions.mjs`
Node.js test suite using DOM stubs:
- Tests inquiry form field validation, error focus, and ampersand/unicode mailto encoding.
- Verifies package allowlist query preselection behavior.
- Exercises the lightbox dialog focus trap, keyboard navigation (`ArrowLeft`, `ArrowRight`), and backdrop dismiss logic.

### `scripts/check-cursor.mjs`
Node.js test suite for the pencil drawing canvas:
- Validates fine hover / reduced-motion pointer checks.
- Confirms pointer tracking, segment stroke clearance, and line group hold/fade timings.
- Asserts that protected element selectors (`a`, `button`, `input`, headings, artwork frames) never activate drawing cursors.
- Tests bounded memory caps (`maxGroups`, `maxTotalPoints`) and destroy cleanup routines.

### `scripts/check-upgrade.py`
Checks responsive image configurations and motion assets:
- Verifies responsive Picture webp sources, detail crop images, and local vendor library paths.
- Ensures no-JS fallbacks remain visible.

---

## Asset Provenance & Licenses

- **Fonts**: Outfit, Inter, and Caveat variable fonts checked in locally under `assets/fonts/` under the SIL Open Font License (OFL).
- **Libraries**:
  - Three.js 0.169.0 (`assets/vendor/three.module.js`) - MIT License.
  - GSAP & ScrollTrigger 3.13.0 (`assets/vendor/gsap.min.js`, `ScrollTrigger.min.js`) - GreenSock License.
- **Artwork & Images**: Original artwork images preserved byte-for-byte in `assets/images/`. For detailed provenance records, see [`assets/ASSETS.md`](assets/ASSETS.md).
