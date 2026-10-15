/* One scroll owner, native scrolling, and reversible, scoped GSAP contexts. */
(() => {
  'use strict';
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return; // Static content + main.js observer fallback.
  gsap.registerPlugin(ScrollTrigger);
  let media;
  let refreshFrame = 0;
  let active = false;

  function refreshAfterLayout() {
    if (refreshFrame || !active) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      ScrollTrigger.refresh();
    });
  }

  function boot() {
    if (active) return;
    active = true;
    document.documentElement.classList.add('motion-ready');
    media = gsap.matchMedia();
    media.add({
      desktop: '(min-width: 768px)',
      fine: '(hover: hover) and (pointer: fine)',
      reduce: '(prefers-reduced-motion: reduce)'
    }, context => {
      const { desktop, fine, reduce } = context.conditions;
      const localCleanups = [];
      const host = document.getElementById('sketchbook-scene');
      const publish = progress => {
        if (!host) return;
        host.dataset.scrollProgress = String(progress);
        host.closest('.hero-stage')?.style.setProperty('--hero-progress', progress);
        const phase = document.querySelector('[data-hero-phase]');
        const label = progress < 0.25 ? '01 / Open the sketchbook' : progress < 0.65 ? '02 / A different world' : '03 / Beyond the page';
        if (phase && phase.textContent !== label) phase.textContent = label;
        window.dispatchEvent(new CustomEvent('artofy:hero-progress', { detail: { progress } }));
      };
      if (reduce) {
        document.querySelectorAll('.reveal').forEach(element => element.classList.remove('will-reveal'));
        publish(0);
        return () => publish(0);
      }

      // The wrapper stays stationary. Only its children and the Three.js scene move.
      const heroScroll = document.getElementById('hero-scroll');
      const stage = heroScroll?.querySelector('.hero-stage');
      let heroContext = null;
      const stopHero = () => {
        heroContext?.revert();
        heroContext = null;
        heroScroll?.classList.remove('has-scroll-scene');
        publish(0);
        refreshAfterLayout();
      };
      const startHero = () => {
        if (!desktop || !stage || !host?.classList.contains('scene-ready') || heroContext) return;
        heroScroll.classList.add('has-scroll-scene');
        heroContext = gsap.context(() => {
          const state = { progress: 0 };
          const timeline = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              id: 'artofy-hero', trigger: heroScroll, pin: stage,
              start: 'top top', end: () => '+=' + Math.round(window.innerHeight * 1.4),
              scrub: 0.25, anticipatePin: 1, invalidateOnRefresh: true,
              onRefresh: () => publish(state.progress)
            }
          });
          timeline.to(state, { progress: 1, duration: 1, onUpdate: () => publish(state.progress) }, 0);
          timeline.to('.hero-copy', { y: -14, duration: 1 }, 0);
          timeline.to('.scene-label', { y: -12, rotation: -3, duration: 1 }, 0);
        }, stage);
        refreshAfterLayout();
      };
      if (desktop) {
        startHero();
        window.addEventListener('artofy:hero-ready', startHero);
        window.addEventListener('artofy:hero-unavailable', stopHero);
        localCleanups.push(() => {
          window.removeEventListener('artofy:hero-ready', startHero);
          window.removeEventListener('artofy:hero-unavailable', stopHero);
          stopHero();
        });
      } else publish(0);

      document.querySelectorAll('[data-depth-sheet]').forEach((sheet, index) => {
        const angle = Number(sheet.dataset.restAngle) || 0;
        gsap.fromTo(sheet,
          { z: desktop ? -140 : -28, y: desktop ? 50 : 22, rotationX: desktop ? 6 : 2,
            rotationY: desktop ? (index % 2 ? -4 : 4) : 0, rotationZ: angle + (desktop ? 3 : 1), opacity: 0.45 },
          { z: 0, y: 0, rotationX: 0, rotationY: 0, rotationZ: desktop ? angle : angle * 0.35, opacity: 1,
            ease: 'none', scrollTrigger: { trigger: sheet, start: 'top 98%', end: 'top 55%', scrub: 0.5 } });
        if (fine && desktop) {
          const frame = sheet.querySelector('.paper-frame');
          if (!frame) return;
          let bounds = null;
          const enter = () => { bounds = frame.getBoundingClientRect(); };
          const move = event => {
            if (!bounds) return;
            const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
            const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
            frame.style.setProperty('--tilt-x', `${-y * 3}deg`);
            frame.style.setProperty('--tilt-y', `${x * 3}deg`);
          };
          const reset = () => {
            bounds = null;
            frame.style.removeProperty('--tilt-x'); frame.style.removeProperty('--tilt-y');
          };
          frame.addEventListener('pointerenter', enter, { passive: true });
          frame.addEventListener('pointermove', move, { passive: true });
          frame.addEventListener('pointerleave', reset, { passive: true });
          window.addEventListener('scroll', reset, { passive: true });
          localCleanups.push(() => {
            frame.removeEventListener('pointerenter', enter); frame.removeEventListener('pointermove', move);
            frame.removeEventListener('pointerleave', reset); window.removeEventListener('scroll', reset); reset();
          });
        }
      });

      document.querySelectorAll('[data-collage]').forEach(collage => {
        collage.querySelectorAll('[data-parallax]').forEach(layer => {
          const travel = Number(layer.dataset.parallax) * (desktop ? 32 : 9);
          gsap.fromTo(layer, { y: -travel }, { y: travel, ease: 'none',
            scrollTrigger: { trigger: collage, start: 'top bottom', end: 'bottom top', scrub: 0.65 } });
        });
      });
      document.querySelectorAll('.price-preview-grid, .package-grid').forEach(group => {
        const cards = [...group.children];
        gsap.from(cards, { y: desktop ? 35 : 20, rotationX: desktop ? 5 : 0, rotationZ: desktop ? 1.4 : 0,
          opacity: 0, duration: 0.65, stagger: 0.12, ease: 'power2.out',
          scrollTrigger: { trigger: group, start: 'top 92%', once: true } });
      });
      document.querySelectorAll('[data-detail-reveal], .process-step, .reveal:not(.art-sheet):not(.package-sheet):not(.closing)').forEach(element => {
        gsap.from(element, { y: desktop ? 28 : 16, opacity: 0, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 95%', once: true } });
      });
      document.querySelectorAll('.pencil-underline path').forEach(path => {
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: path.closest('h2'), start: 'top 85%', once: true } });
      });
      document.querySelectorAll('.process-path').forEach(path => {
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length },
          { strokeDashoffset: 0, ease: 'none',
            scrollTrigger: { trigger: path.closest('.timeline'), start: 'top 70%', end: 'bottom 70%', scrub: true } });
      });
      document.querySelectorAll('.closing').forEach(section => {
        gsap.from(section.querySelector('[data-closing-accent]'), { y: 12, rotation: -3, opacity: 0, duration: 0.65,
          scrollTrigger: { trigger: section, start: 'top 88%', once: true } });
        const pencil = section.querySelector('.closing-pencil');
        if (pencil) gsap.from(pencil, { y: -25, rotation: 7, opacity: 0, duration: 0.7,
          scrollTrigger: { trigger: section, start: 'top 88%', once: true } });
      });
      return () => localCleanups.forEach(cleanup => cleanup());
    });
    refreshAfterLayout();
  }

  function pause() {
    if (!active) return;
    active = false;
    media?.revert();
    media = null;
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    refreshFrame = 0;
    document.documentElement.classList.remove('motion-ready');
  }
  boot();
  window.addEventListener('pagehide', pause);
  window.addEventListener('pageshow', event => { if (event.persisted) { boot(); refreshAfterLayout(); } });
  document.fonts?.ready.then(refreshAfterLayout);
  window.addEventListener('load', refreshAfterLayout, { once: true });
  document.querySelectorAll('img').forEach(image => {
    if (!image.complete) {
      image.addEventListener('load', refreshAfterLayout, { once: true });
      image.addEventListener('error', refreshAfterLayout, { once: true });
    }
  });
})();
