# Asset inventory and provenance

All paths below are relative to `assets/`. The portfolio contains **four genuine original artworks**. Responsive versions and labelled detail crops are alternate presentations of those same four works; they do not represent additional commissions, sketches, process evidence or work in progress.

## Original artwork

The original repository contained `artwork-01.jpg` through `artwork-04.jpg` and embedded JPEGs in `index.html`. Each semantic image below was matched to its immediately following original HTML title and description, then confirmed byte-for-byte against the embedded image and the repository JPEG. No mapping was inferred from file order. The JPEG originals retain their original dimensions, ICC color profiles, colors, composition and metadata without recompression.

| Original title | Preserved description | Semantic original | Dimensions | Original source |
| --- | --- | --- | --- | --- |
| Fantasy Battle | Multiple characters • Action scene | `images/fantasy-battle.jpg` | 1536 × 1536 | `artwork-01.jpg` |
| Character Illustration | Full-body • Custom character | `images/character-illustration.jpg` | 1156 × 1536 | `artwork-02.jpg` |
| Fantasy Warrior | Character design • Fantasy | `images/fantasy-warrior.jpg` | 1536 × 1536 | `artwork-03.jpg` |
| Anime Knight | Character illustration • Armor | `images/anime-knight.jpg` | 1209 × 1536 | `artwork-04.jpg` |

Original SHA-256 checksums, also asserted by `scripts/check.py`:

```text
fantasy-battle.jpg          a9fd091cfcd571b301037c8dc61489f52b14e6948ff981f6ac4506c9c9941228
character-illustration.jpg  49ac92dc556af4f19af1d780e80ff2cb775738f2124bdef1ec12ef4e73e291e5
fantasy-warrior.jpg         e5cc5158681dc954d792b010e323dbc6501820900b026a38a9a82ab5542651ce
anime-knight.jpg            fa036baba0daa616e78d25dd074db406105ebb53dc4bdd90d7b9c2d114a5d483
```

## Responsive full-composition images

WebP derivatives were made with Pillow using proportional Lanczos downsampling and quality 87. The original ICC profile is retained. No color grading, stretching, cropping, drawn additions or image generation was applied. The original JPEGs remain available on the detail pages and via full-size gallery links.

| Image | Dimensions | Bytes |
| --- | --- | ---: |
| `images/fantasy-battle-480.webp` | 480 × 480 | 36,266 |
| `images/fantasy-battle-800.webp` | 800 × 800 | 68,570 |
| `images/fantasy-battle-1024.webp` | 1024 × 1024 | 94,448 |
| `images/character-illustration-480.webp` | 480 × 638 | 63,366 |
| `images/character-illustration-800.webp` | 800 × 1063 | 116,544 |
| `images/fantasy-warrior-480.webp` | 480 × 480 | 30,682 |
| `images/fantasy-warrior-800.webp` | 800 × 800 | 60,946 |
| `images/anime-knight-480.webp` | 480 × 610 | 32,768 |
| `images/anime-knight-800.webp` | 800 × 1016 | 60,974 |

Use `srcset="assets/images/SLUG-480.webp 480w, assets/images/SLUG-800.webp 800w"` with a layout-appropriate `sizes` attribute. Full-size links must still point to the original `.jpg` or dedicated artwork detail page. The 1024-pixel Fantasy Battle variant is suitable for the 3D sketchbook texture, where the artwork is displayed at a much smaller size than the original.

## Clearly labelled artwork details

These images are crops of **finished original illustrations**. Label them “Detail from [original title]” wherever displayed, and link back to the complete original image or its detail page. None is a sketch or a work-in-progress image. Each crop is 800 × 600 pixels, saved at WebP quality 89 with its original ICC profile. Crop coordinates use `(left, top, right, bottom)` in source pixels.

| Detail image | Original | Source crop box | Content | Bytes |
| --- | --- | --- | --- | ---: |
| `images/anime-knight-armor-detail.webp` | Anime Knight | `(260, 580, 1208, 1291)` | Silver shoulder armor, crest, navy cloak and chest detail | 44,706 |
| `images/fantasy-warrior-face-detail.webp` | Fantasy Warrior | `(360, 300, 1260, 975)` | Traveler face and pipe, with the forest setting visible | 48,148 |
| `images/character-illustration-outfit-detail.webp` | Character Illustration | `(120, 530, 1156, 1307)` | Blue jacket, sleeve emblem, sword grip, belt and outfit | 72,540 |

## Supporting interface illustrations

| Vector | Canvas | Provenance and purpose |
| --- | --- | --- |
| `images/studio-tools.svg` | 400 × 280 | Original hand-authored SVG interface illustration of pencils, an eraser, ruler and paper, created for this website. |
| `images/paper-study.svg` | 400 × 280 | Original hand-authored SVG interface illustration of loose sheets, construction lines and a decorative note, created for this website. |

These are lightweight, mostly transparent cream/graphite/pink vector illustrations. They are decorative design assets, not portfolio artworks, photographs of the studio, client commissions, or evidence of the artist's process. Use empty alternatives when purely decorative, with adjacent visible context where needed. Both SVGs contain descriptive `<title>` and `<desc>` elements for standalone use.

The subtle paper texture and favicon are original SVG interface assets. Font provenance and their unmodified SIL OFL 1.1 licenses are recorded in `fonts/README.md` and `fonts/licenses/`. Three.js is self-hosted under `vendor/`, with its upstream license alongside the module.
