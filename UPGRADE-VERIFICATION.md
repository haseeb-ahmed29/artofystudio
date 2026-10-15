# Sketchbook motion upgrade verification

Verified locally on 15 October 2026. The earlier implementation record remains in VERIFICATION.md.

## Delivered changes

- All eleven pages load the shared scroll and pencil modules using repository-compatible relative paths. `index.html` includes all four complete original artworks, three clearly labelled crops, two original SVG tool/paper illustrations and the hero image: ten placements total.
- Twelve locally generated WebPs provide responsive artwork sizes, compact hero textures and three detail crops. SHA-256 checks confirm all original JPEGs are untouched. Sources, dimensions, crop coordinates and licenses are in assets/ASSETS.md and assets/vendor/README.md.
- `hero.js` extends the existing Three.js scene with a camera approach, a curved physical page with a spine pivot, separate front/back original artwork, a revealed character illustration and a lifting knight sheet. `scroll-motion.js` owns normalized progress; the renderer composes that progress with subtle pointer movement. The stable stage is pinned for 140vh of additional travel only when the scene is ready, the viewport is at least 768px, and reduced motion is off.
- `pencil-cursor.js` provides connected light movement trails and darker drag strokes on designated empty paper. Its tip uses viewport coordinates. Completed groups hold for 2,500ms and fade for 400ms independently. Memory is bounded and rendering sleeps between pointer updates/fades. Text, links, artwork, form controls and modals are excluded; scroll, selection, resize, blur and navigation reset stale points.
- `motion.css`, all eleven HTML files, the shared reveal fallback in `main.js`, repository documentation, vendor files and four verification scripts complete the upgrade. No framework migration, smooth-scroll replacement, new backend or policy changes were introduced.

## Automated verification

All checks pass:

```sh
python scripts/check.py
python scripts/check-upgrade.py
node scripts/check-interactions.mjs
node scripts/check-cursor.mjs
node --check assets/js/hero.js
node --check assets/js/scroll-motion.js
node --check assets/js/pencil-cursor.js
```

The static checks cover eleven complete pages, unique metadata, all local links/assets, nineteen responsive sources, ten homepage placements, original artwork hashes and package/contact content. Ten interaction groups exercise the actual shared script in a VM. Nine cursor groups cover connected movement, exclusions, independent expiry, bounded memory, cleanup, native-cursor restoration and unexpected canvas failure. These source-level tests complement the browser checks; they are not browser performance scores.

## Browser verification

All eleven page URLs were opened under the `/artofystudio/` project prefix at 375, 390, 768, 1440 and 1920px viewport settings: 55 combinations. DOM measurements found no horizontal overflow or broken loaded images, and screenshots were inspected. Normal-page logs contained no warnings or errors before intentional fault tests.

Live checks confirmed scroll-controlled page turning and reversing, the revealed artwork and lifting sheet, the visible tip and connected graphite drag, homepage lightbox arrows/Escape/focus restoration, scroll unlock, mobile menu navigation, keyboard FAQ expansion, commission preselection, validation/input recovery and inquiry copying. Resizing and back/forward restoration retained one pin, one WebGL canvas and one cursor overlay.

Temporary server fixtures outside the repository checked blocked JavaScript, failed Three.js import, missing hero textures, renderer initialization failure, failed GSAP files and simulated reduced motion. Those variants retained navigation, original fallback imagery and actions without an empty long pin. The reduced-motion variant substituted the media query in served source/CSS; the operating-system preference itself was not changed. No fixture code is shipped.

The environment's connected Chromium browser was used. Firefox and Safari were not tested. No email was sent; external mail-client launch depends on the visitor's configuration, and the copy/manual-copy route remains available. No unmeasured performance score is claimed.

## Publishing

Before changes, the authenticated GitHub API confirmed the existing Pages publishing source as `main` from `/`, with a successful prior build. The task preserves that configuration. Commit/deployment identifiers and the final live check are recorded in the delivery report after push.
