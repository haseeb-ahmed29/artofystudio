# Verification record

Verified locally on 15 October 2026.

## Automated checks

- Eleven required HTML pages exist with unique titles, descriptions, and h1 headings, static navigation, and active navigation states.
- All 264 referenced local page, anchor, stylesheet, script, image, font, and module targets resolve.
- SHA-256 checks confirm all four semantic artwork assets are identical to the original embedded/local JPEGs.
- Original gallery captions, every package price/inclusion, email address, and telephone number are preserved.
- Self-hosted WOFF2 signatures and font licenses are checked.
- JavaScript syntax checks pass for the shared interactions and homepage scene.
- Ten interaction test groups pass: package allowlisting; field validation and input retention; exact mailto encoding of ampersands, plus signs, newlines and Unicode; altered package rejection; clipboard absence/denial/insecure-context fallback; clipboard success; blocked mailto launch; lightbox keyboard/focus behavior; dialog fallback; reduced-motion/observer fallback.

## Actual browser checks

All eleven URLs were opened at desktop (1440×1000), tablet (768×1024), and mobile (390×844) viewport settings. Their rendered layouts were inspected through screenshots and DOM measurements. Document scroll width matched the available viewport width on all 33 combinations. Loaded images had no broken sources. Desktop and mobile scrolling checks covered the gallery, process timeline, commission sheets, and inquiry form. A mobile headline overflow found during inspection was corrected, including the hidden fallback geometry that contributed to scroll width.

The live browser checks also covered:

- Hero actions and the rendered 3D sketchbook, complete-art texture, and static fallback.
- Shared navigation, mobile menu opening/link navigation, direct URL loads, refresh, and browser back/forward behavior.
- Gallery lightbox opening, next button, arrow-key navigation, Escape closing, focus restoration, and body scroll unlock.
- Native FAQ expansion using the keyboard, with visible focus.
- All three package links and contact preselection; invalid query fallback and editable selection.
- Empty-form field errors, recovery without losing values, and copying a populated inquiry containing special characters.
- Normal-page browser logs contained no errors or warnings.

## Failure and motion checks

A temporary QA server outside the repository served unmodified pages with scripts blocked by CSP, and separate fault-injected variants for a failing Three.js module, a missing hero texture, and a renderer constructor failure. In each case the real static artwork and both hero links remained available without overflow. These are controlled source-failure tests, rather than claims of testing every physical GPU/device. No QA routes or injected failures are shipped.

With scripts blocked, mobile static navigation was visible, original artwork loaded, contact information remained usable, and enhanced form buttons stayed disabled. The published fallback instruction also works when the shared script cannot load.

Reduced-motion behavior is covered by the interaction tests, scene checks, and CSS/source review: completed reveal/path states, no entrance animation, no pointer tilt or continuous scene motion, and normal scrolling. The scene also caps pixel density and cancels rendering offscreen/when hidden. The modal uses the browser’s native dialog for background inertness, with an additional keyboard containment handler.

## Practical limits

No email was sent. Mailto recipient, subject, and body construction were tested; opening an external email application depends on the visitor’s configured client. The visible copy/manual-copy option handles visitors without one. Clipboard permission varies by browser. No submission backend or placeholder social destinations are included.

The three unfinished policy answers remain omitted until the studio supplies approved wording; details are listed in README.md.
