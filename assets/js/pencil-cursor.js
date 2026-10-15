/** Optional graphite drawing on explicitly marked empty paper backgrounds. */
export const PENCIL_CONFIG = Object.freeze({
  holdMs: 2500,
  fadeMs: 400,
  idleMs: 110,
  maxGroupMs: 240,
  maxGroups: 40,
  maxPointsPerGroup: 80,
  maxTotalPoints: 2400,
  minPointDistance: 1.5,
  maxSegmentDistance: 90,
  segmentProbeStep: 6,
  maxDpr: 2
});

const PROTECTED = [
  '[data-no-draw]', 'a', 'button', 'input', 'textarea', 'select', 'option', 'label', 'form',
  'nav', 'header', 'footer', 'img', 'picture', 'video', 'audio', 'iframe', 'canvas', 'svg',
  'article', 'figure', '.paper-frame', '.hero-visual', '.scene', '.scene-fallback',
  '[role="button"]', '[role="link"]', '[role="dialog"]', '[contenteditable]',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dt', 'dd', 'summary', 'details',
  'blockquote', 'pre', 'code', 'table', 'ul', 'ol'
].join(',');

/** The factory accepts a window/document pair so lifecycle behavior can be tested. */
export function createPencilCursor({ window: hostWindow = globalThis.window,
  document: hostDocument = hostWindow?.document, config = PENCIL_CONFIG } = {}) {
  if (!hostWindow?.matchMedia || !hostDocument?.body) return null;
  const settings = { ...PENCIL_CONFIG, ...config };
  const finePointer = hostWindow.matchMedia('(pointer: fine) and (hover: hover)');
  const reducedMotion = hostWindow.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = [];
  const mediaListeners = [];
  let canvas = null;
  let context = null;
  let pencil = null;
  let stylesheet = null;
  let observer = null;
  let surface = null;
  let active = null;
  let groups = [];
  let frameId = null;
  let timerId = null;
  let enabled = false;
  let destroyed = false;
  let width = 0;
  let height = 0;
  const now = () => hostWindow.performance.now();

  function listen(target, type, callback, options) {
    const guarded = (...args) => {
      try { return callback(...args); } catch { failSafe(); }
    };
    target.addEventListener(type, guarded, options);
    listeners.push(() => target.removeEventListener(type, guarded, options));
  }
  function failSafe() {
    enabled = false;
    cancelWork();
    hidePencil();
    active = null;
    groups = [];
    if (canvas) canvas.hidden = true;
  }
  function listenMedia(query) {
    if (query.addEventListener) {
      query.addEventListener('change', reconcile);
      mediaListeners.push(() => query.removeEventListener('change', reconcile));
    } else if (query.addListener) {
      query.addListener(reconcile);
      mediaListeners.push(() => query.removeListener(reconcile));
    }
  }
  function hidePencil() {
    if (surface) surface.classList.remove('pencil-surface-active');
    surface = null;
    if (pencil) pencil.hidden = true;
  }
  function cancelWork() {
    if (frameId !== null) hostWindow.cancelAnimationFrame(frameId);
    if (timerId !== null) hostWindow.clearTimeout(timerId);
    frameId = null;
    timerId = null;
  }
  function reset() {
    cancelWork();
    active = null;
    groups = [];
    hidePencil();
    if (context) context.clearRect(0, 0, width, height);
  }
  function resize() {
    reset();
    if (!canvas || !context) return;
    width = hostWindow.innerWidth;
    height = hostWindow.innerHeight;
    const dpr = Math.min(settings.maxDpr, hostWindow.devicePixelRatio || 1);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function blockedContext() {
    const selection = hostWindow.getSelection?.();
    return hostDocument.hidden || Boolean(selection && !selection.isCollapsed) ||
      Boolean(hostDocument.activeElement?.matches?.('input,textarea,select,[contenteditable]')) ||
      Boolean(hostDocument.querySelector('dialog[open],[aria-modal="true"]'));
  }
  function eligible(element) {
    if (!element || typeof element.closest !== 'function' || element.closest(PROTECTED)) return null;
    const area = element.closest('[data-drawing-area]');
    if (!area) return null;
    // A structural div may itself contain a text node outside a semantic paragraph.
    if ([...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) return null;
    const cursor = hostWindow.getComputedStyle(element).cursor;
    if (cursor && !['auto', 'default', 'none'].includes(cursor)) return null;
    return area;
  }
  function prune() {
    while (groups.length > settings.maxGroups) groups.shift();
    let pointCount = groups.reduce((sum, group) => sum + group.points.length, 0) + (active?.points.length || 0);
    while (groups.length && pointCount > settings.maxTotalPoints) pointCount -= groups.shift().points.length;
  }
  function complete(at = now()) {
    if (!active) return;
    if (active.points.length > 1) groups.push({ ...active, completedAt: at });
    active = null;
    prune();
  }
  function begin(point, area, pressed, time) {
    active = { points: [point], area, pressed, startedAt: time, lastAt: time };
  }
  function segmentIsClear(from, to, area) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance > settings.maxSegmentDistance) return false;
    const steps = Math.ceil(distance / settings.segmentProbeStep);
    for (let i = 1; i < steps; i += 1) {
      const fraction = i / steps;
      const element = hostDocument.elementFromPoint(from.x + (to.x - from.x) * fraction,
        from.y + (to.y - from.y) * fraction);
      if (eligible(element) !== area) return false;
    }
    return true;
  }
  function smoothedCornerIsClear(point, area) {
    if (active.points.length < 2) return true;
    const control = active.points[active.points.length - 1];
    const previous = active.points[active.points.length - 2];
    const start = active.points.length === 2 ? previous :
      { x: (previous.x + control.x) / 2, y: (previous.y + control.y) / 2 };
    const end = { x: (control.x + point.x) / 2, y: (control.y + point.y) / 2 };
    const length = Math.hypot(start.x - control.x, start.y - control.y) + Math.hypot(end.x - control.x, end.y - control.y);
    const steps = Math.max(2, Math.ceil(length / settings.segmentProbeStep));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x;
      const y = (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y;
      if (eligible(hostDocument.elementFromPoint(x, y)) !== area) return false;
    }
    return true;
  }
  function requestPaint() {
    if (!enabled || frameId !== null || (!active && !groups.length)) return;
    if (timerId !== null) hostWindow.clearTimeout(timerId);
    timerId = null;
    frameId = hostWindow.requestAnimationFrame(paint);
  }
  function draw(group, alpha) {
    const points = group.points;
    if (points.length < 2 || alpha <= 0) return;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i += 1) {
      const midpoint = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
      context.quadraticCurveTo(points[i].x, points[i].y, midpoint.x, midpoint.y);
    }
    const end = points[points.length - 1];
    context.lineTo(end.x, end.y);
    context.strokeStyle = '#4f4943';
    context.globalAlpha = alpha * (group.pressed ? 0.40 : 0.19);
    context.lineWidth = group.pressed ? 1.15 : 0.7;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  }
  function paint(time) {
    try { paintFrame(time); } catch { failSafe(); }
  }
  function paintFrame(time) {
    frameId = null;
    if (!enabled) return;
    if (active && time - active.lastAt >= settings.idleMs) complete(active.lastAt);
    groups = groups.filter(group => time - group.completedAt < settings.holdMs + settings.fadeMs);
    context.clearRect(0, 0, width, height);
    let nextDeadline = active ? active.lastAt + settings.idleMs : Infinity;
    let fading = false;
    groups.forEach(group => {
      const age = time - group.completedAt;
      const fade = Math.max(0, Math.min(1, 1 - (age - settings.holdMs) / settings.fadeMs));
      draw(group, fade);
      if (age >= settings.holdMs) fading = true;
      else nextDeadline = Math.min(nextDeadline, group.completedAt + settings.holdMs);
    });
    if (active) draw(active, 1);
    context.globalAlpha = 1;
    // Stay idle throughout the hold period. Animate only the brief actual fade.
    if (fading) requestPaint();
    else if (Number.isFinite(nextDeadline)) {
      timerId = hostWindow.setTimeout(() => { timerId = null; requestPaint(); }, Math.max(1, nextDeadline - time));
    }
  }
  function onPointer(event) {
    if (!enabled) return;
    if ((event.pointerType && !['mouse', 'pen'].includes(event.pointerType)) || blockedContext()) {
      reset();
      return;
    }
    const target = event.target?.nodeType === 3 ? event.target.parentElement : event.target;
    const area = eligible(target);
    const time = now();
    if (!area || event.isPrimary === false || (event.buttons & ~1)) {
      if (event.type === 'pointerdown') { reset(); return; }
      complete();
      hidePencil();
      requestPaint();
      return;
    }
    if (surface !== target) {
      hidePencil();
      surface = target;
      surface.classList.add('pencil-surface-active');
    }
    pencil.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0)`;
    pencil.hidden = false;
    const point = { x: event.clientX, y: event.clientY };
    const pressed = Boolean(event.buttons & 1);
    if (!active || active.area !== area || active.pressed !== pressed || time - active.lastAt > settings.idleMs) {
      complete(active?.lastAt ?? time);
      begin(point, area, pressed, time);
    } else {
      const previous = active.points[active.points.length - 1];
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < settings.minPointDistance) return;
      if (!segmentIsClear(previous, point, area) || !smoothedCornerIsClear(point, area)) {
        complete(time);
        begin(point, area, pressed, time);
      } else {
        // Split long gestures so old marks expire independently of new movement.
        if (time - active.startedAt >= settings.maxGroupMs || active.points.length >= settings.maxPointsPerGroup) {
          complete(time);
          begin(previous, area, pressed, time);
        }
        active.points.push(point);
        active.lastAt = time;
      }
    }
    prune();
    requestPaint();
  }
  function onPointerUp() {
    if (!enabled) return;
    complete();
    requestPaint();
  }
  function onContextChange() {
    if (blockedContext()) reset();
  }
  function setup() {
    if (canvas) return true;
    const newCanvas = hostDocument.createElement('canvas');
    let newContext;
    try { newContext = newCanvas.getContext('2d'); } catch { return false; }
    if (!newContext) return false;
    // The native cursor is never hidden until this overlay is initialized.
    newCanvas.className = 'pencil-trails';
    newCanvas.setAttribute('aria-hidden', 'true');
    newCanvas.setAttribute('data-no-draw', '');
    const newPencil = hostDocument.createElement('span');
    newPencil.className = 'pencil-pointer';
    newPencil.hidden = true;
    newPencil.setAttribute('aria-hidden', 'true');
    newPencil.setAttribute('data-no-draw', '');
    // The graphite tip is SVG coordinate 0,0, exactly at the real pointer.
    newPencil.innerHTML = '<svg viewBox="-1 -28 29 29" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path d="M0 0 5-14 19-28 28-19 14-5Z" fill="#d9c4a2" stroke="#504a43" stroke-width=".65"/><path d="m5-14 14-14 9 9-14 14Z" fill="#625b54"/><path d="m8-12 14-14m-11 17 14-14" stroke="#b9b0a6" stroke-width="1"/><path d="m0 0 2.8-7.8 5 5Z" fill="#252321"/><path d="m19-28 3-1 7 7-1 3Z" fill="#b7a699"/></svg>';
    const newStyle = hostDocument.createElement('style');
    newStyle.textContent = '.pencil-trails{position:fixed;inset:0;width:100%;height:100%;pointer-events:none!important;z-index:60}.pencil-pointer{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none!important;z-index:10000}.pencil-pointer svg{position:absolute;left:-1px;top:-28px;width:29px;height:29px;max-width:none;overflow:visible;pointer-events:none!important}.pencil-surface-active{cursor:none!important;user-select:none;-webkit-user-select:none}.pencil-pointer[hidden]{display:none!important}@media(prefers-reduced-motion:reduce),(pointer:coarse),(hover:none){.pencil-trails,.pencil-pointer{display:none!important}.pencil-surface-active{cursor:auto!important}}';
    hostDocument.head.appendChild(newStyle);
    hostDocument.body.appendChild(newCanvas);
    hostDocument.body.appendChild(newPencil);
    canvas = newCanvas;
    context = newContext;
    pencil = newPencil;
    stylesheet = newStyle;
    resize();
    listen(hostDocument, 'pointermove', onPointer, { passive: true });
    listen(hostDocument, 'pointerdown', onPointer, { passive: true });
    listen(hostDocument, 'pointerup', onPointerUp, { passive: true });
    listen(hostDocument, 'pointercancel', reset, { passive: true });
    listen(hostDocument, 'pointerout', event => { if (!event.relatedTarget) reset(); }, { passive: true });
    listen(hostWindow, 'scroll', reset, { capture: true, passive: true });
    listen(hostWindow, 'resize', resize, { passive: true });
    listen(hostWindow, 'blur', reset);
    listen(hostWindow, 'pagehide', reset);
    listen(hostDocument, 'visibilitychange', onContextChange);
    listen(hostDocument, 'selectionchange', onContextChange);
    listen(hostDocument, 'focusin', onContextChange);
    listen(hostDocument, 'keydown', reset);
    if (hostWindow.MutationObserver) {
      observer = new hostWindow.MutationObserver(reset);
      observer.observe(hostDocument.body, { subtree: true, attributes: true, attributeFilter: ['open', 'aria-modal'] });
    }
    return true;
  }
  function reconcile() {
    if (destroyed) return;
    const shouldEnable = finePointer.matches && !reducedMotion.matches;
    if (shouldEnable && !canvas && !setup()) return;
    enabled = Boolean(shouldEnable && context);
    if (canvas) canvas.hidden = !enabled;
    if (!enabled) reset();
  }
  function destroy() {
    destroyed = true;
    enabled = false;
    reset();
    listeners.forEach(remove => remove());
    mediaListeners.forEach(remove => remove());
    observer?.disconnect();
    canvas?.remove();
    pencil?.remove();
    stylesheet?.remove();
  }

  listenMedia(finePointer);
  listenMedia(reducedMotion);
  reconcile();
  return { destroy, reset,
    // A read-only snapshot supports bounded-memory and lifetime regression checks.
    getState: () => ({ enabled, visible: Boolean(pencil && !pencil.hidden),
      completedGroups: groups.length, activePoints: active?.points.length || 0,
      totalPoints: groups.reduce((sum, group) => sum + group.points.length, 0) + (active?.points.length || 0),
      groupTimes: groups.map(group => group.completedAt), pendingFrame: frameId !== null, pendingTimer: timerId !== null }) };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  createPencilCursor({ window, document });
}
