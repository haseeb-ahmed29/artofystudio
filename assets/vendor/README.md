# Three.js

This directory vendors the unmodified browser ES module from Three.js **r169**
(npm package version **0.169.0**), so the homepage has no runtime CDN dependency.

- Source: https://github.com/mrdoob/three.js/blob/r169/build/three.module.js
- License: MIT; see `THREE-LICENSE.txt` and the module's license header.
- Used only by `assets/js/hero.js` on the homepage.

The HTML artwork composition remains visible if the enhancement cannot load.
