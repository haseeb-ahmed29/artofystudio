# Artofy Studio

A complete, buildless anime artist portfolio with eleven real HTML pages. The redesign follows **The Living Artist’s Sketchbook**: warm paper, graphite, restrained pink, layered artwork sheets, handwritten annotations, and a locally rendered Three.js sketchbook.

## Motion and image upgrade

The homepage now has ten image placements: four complete works, three labelled details of finished illustrations, two original SVG interface illustrations, and the hero image. Twelve optimized WebPs and two SVGs are added. The four original JPEGs remain unchanged. See [asset provenance](assets/ASSETS.md).

`assets/js/scroll-motion.js` uses locally pinned GSAP/ScrollTrigger 3.13.0 and `gsap.matchMedia()`. A stable desktop hero stage pins for 140vh of additional native scroll travel. One reversible timeline drives a camera approach, a curved two-sided page around the spine, and a lifting artwork sheet. `assets/css/motion.css` adds gallery depth, collage parallax, package entrances, pencil underlines, and a progressive process path. The existing observer is retained as a dependency-failure fallback.

`assets/js/pencil-cursor.js` owns the fine-pointer pencil and transparent Canvas 2D overlay. Its exported `PENCIL_CONFIG` exposes sensitivity, memory caps, a 2,500ms hold, and a 400ms fade. Each completed group ages independently. Text, controls, forms, artwork, and modals keep native interaction. Empty drawing surfaces temporarily suppress selection so doodles can start there; entering text restores normal text selection. No pointer capture, click prevention, smooth-scroll library, or touch-scroll replacement is used.

Below 768px, long pinning and hover tilt are removed. Reduced motion disables turns, parallax, drawing, and entrances. Failed 3D never creates a long empty pin. The existing GitHub Pages configuration (`main`, `/`) is preserved; the live project is [Artofy Studio](https://haseeb-ahmed29.github.io/artofystudio/index.html).

## Preview locally

From this repository, run:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/index.html`. On systems with Python named `python3`, use `python3 -m http.server 8000` instead. No package installation or build step is required. Use an HTTP server rather than opening `file://` URLs so the homepage ES module and textures can load.

The repository root is ready for ordinary static hosting, including GitHub Pages. All page navigation, fonts, scripts, and assets use relative paths, including the nested artwork pages. No additional hosting service or deployment account is required.

## Page inventory

| URL | Content |
| --- | --- |
| `index.html` | Interactive 3D sketchbook, selected artwork, introduction, commission preview |
| `artwork.html` | Four-work asymmetric gallery and accessible full-image dialog |
| `about.html` | Studio approach, original artwork, and a clearly labelled detail crop |
| `commissions.html` | All three existing packages, prices, inclusions, and inquiry links |
| `process.html` | Send Request → Discuss → Creation → Delivery |
| `faq.html` | The complete, verified existing timing answer and contact invitation |
| `contact.html` | Validated email-draft inquiry and copy/manual-copy alternative |
| `artwork/fantasy-battle.html` | Complete Fantasy Battle artwork and original caption |
| `artwork/character-illustration.html` | Complete Character Illustration artwork and original caption |
| `artwork/fantasy-warrior.html` | Complete Fantasy Warrior artwork and original caption |
| `artwork/anime-knight.html` | Complete Anime Knight artwork and original caption |

Each detail page includes breadcrumbs, previous/next artwork, return-to-gallery navigation, and a commission action. Every page has static navigation, a unique title, meta description, and main heading.

## Files and dependencies

- `assets/css/site.css`: shared responsive visual system and reduced-motion styles.
- `assets/js/main.js`: mobile menu, progressive section reveals, gallery dialog, and inquiry form.
- `assets/js/hero.js`: homepage-only Three.js scene with compact complete-art textures, a physical two-sided page turn, and a lifting sheet. Textures use unlit, non-tone-mapped materials. One renderer caps resolution, pauses offscreen/when hidden, and respects reduced motion.
- `assets/images/`: four original JPEGs, preserved byte for byte. The original embedded images and root `artwork-01.jpg` through `artwork-04.jpg` were identical; their verified semantic filenames replace both sources without recompression.
- `assets/fonts/`: self-hosted Outfit, Inter, and Caveat Latin variable fonts with OFL licenses and provenance.
- `assets/vendor/`: pinned Three.js 0.169.0 / r169 and its MIT license. No CDN is required at runtime.

Portfolio works retain their original titles, descriptions, composition, colors, and full-image proportions. Decorative SVGs and the 3D line study are interface illustrations, not additional portfolio work or evidence of an actual work in progress. Artwork shown beside package descriptions is not assigned to a particular package.

## Inquiry behavior

There is no submission backend. **Open Email Draft** constructs an encoded draft to `artofystudio@gmail.com`; the visitor must review and send it from their email application. Nothing is reported as sent by the website. **Copy inquiry text** offers a manual-copy textarea if clipboard access is unavailable. Inputs stay intact after validation errors.

The three commission links preselect allowlisted `type` values: `sketch`, `full-color`, and `premium-scene`. Selection remains editable. Invalid query values are ignored.

Without JavaScript, the complete site content, navigation, full-image/detail links, native FAQ accordion, contact details, and static sketchbook remain available. The enhanced form actions stay disabled and a visible direct-email instruction provides the alternative.

## Verification

```sh
python scripts/check.py
node scripts/check-interactions.mjs
node scripts/check-cursor.mjs
python scripts/check-upgrade.py
node --check assets/js/main.js
node --check assets/js/hero.js
```

See [VERIFICATION.md](VERIFICATION.md) for the visual/browser checks and their scope. The Python check uses only the standard library. The Node interaction checks use `node:test`-style assertions and a VM with DOM stubs; they exercise the shipped script, and complement the actual browser checks.

## Content still needed from the studio

The original FAQ contained placeholders for NSFW/commercial policy, deposit/payment terms, and refund/cancellation rules. They are omitted from published answers. The existing “Personal use” and “Commercial options” package inclusions remain, but no new licensing terms have been invented. Provide approved policies before adding those FAQ entries.

The original social links were `#` placeholders. Add genuine destination URLs before displaying social links. Configure a real submission backend only if direct form delivery is wanted; the current email-draft workflow is complete and explicit.
