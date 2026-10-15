# Artofy Studio

A complete, buildless anime artist portfolio with eleven real HTML pages. The redesign follows **The Living Artist’s Sketchbook**: warm paper, graphite, restrained pink, layered artwork sheets, handwritten annotations, and a locally rendered Three.js sketchbook.

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
- `assets/js/hero.js`: homepage-only Three.js enhancement. Original artwork uses an unlit, non-tone-mapped texture to preserve its colors. Resolution is capped, motion is disabled for reduced motion, and rendering pauses offscreen or in a hidden tab.
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
node --check assets/js/main.js
node --check assets/js/hero.js
```

See [VERIFICATION.md](VERIFICATION.md) for the visual/browser checks and their scope. The Python check uses only the standard library. The Node interaction checks use `node:test`-style assertions and a VM with DOM stubs; they exercise the shipped script, and complement the actual browser checks.

## Content still needed from the studio

The original FAQ contained placeholders for NSFW/commercial policy, deposit/payment terms, and refund/cancellation rules. They are omitted from published answers. The existing “Personal use” and “Commercial options” package inclusions remain, but no new licensing terms have been invented. Provide approved policies before adding those FAQ entries.

The original social links were `#` placeholders. Add genuine destination URLs before displaying social links. Configure a real submission backend only if direct form delivery is wanted; the current email-draft workflow is complete and explicit.
