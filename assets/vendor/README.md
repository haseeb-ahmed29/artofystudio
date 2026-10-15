# Vendored browser dependencies

All files load from this repository. No runtime CDN requests are required.

## Three.js

This directory vendors the unmodified browser ES module from Three.js **r169**
(npm package version **0.169.0**), so the homepage has no runtime CDN dependency.

- Source: https://github.com/mrdoob/three.js/blob/r169/build/three.module.js
- License: MIT; see `THREE-LICENSE.txt` and the module's license header.
- Used only by `assets/js/hero.js` on the homepage.

The HTML artwork composition remains visible if the enhancement cannot load.

## GSAP and ScrollTrigger

`gsap.min.js` and `ScrollTrigger.min.js` are the unmodified UMD browser builds
from the official **gsap@3.13.0** npm package. The homepage scroll module loads
core first, then registers ScrollTrigger. The Three.js module receives normalized
progress through a DOM event; GSAP never starts a second WebGL render loop.

- Distribution: https://registry.npmjs.org/gsap/-/gsap-3.13.0.tgz
- Source tag: https://github.com/greensock/GSAP/tree/3.13.0
- Official installation: https://gsap.com/docs/v3/Installation/
- License: GSAP Standard "No Charge" License, not MIT. See `GSAP-LICENSE.txt`
  for the preserved package notice and canonical license URL. The official npm
  distribution does not contain a standalone full-text license file.

Desktop motion is optional. Mobile, reduced motion, and failed enhancements
retain the static artwork and ordinary HTML navigation.
