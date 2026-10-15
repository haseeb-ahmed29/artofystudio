/** Dependency-free cursor lifecycle/geometry/timing checks; no browser is controlled. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'assets/js/pencil-cursor.js'), 'utf8');
const { createPencilCursor, PENCIL_CONFIG } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ callback, options });
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.callback !== callback));
  }
  emit(type, details = {}) {
    const event = { type, target: this, buttons: 0, pointerType: 'mouse', isPrimary: true,
      clientX: 10, clientY: 10, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const { callback } of this.listeners.get(type) || []) callback(event);
    return event;
  }
}
class Element extends Events {
  constructor(tag = 'div', parent = null) {
    super();
    this.tag = tag;
    this.parentElement = parent;
    this.childNodes = [];
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.hidden = false;
    this.cursor = 'auto';
    this.protected = false;
    const classes = new Set();
    this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) };
  }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (selector === '[data-drawing-area]') {
        if (Object.hasOwn(node.attributes, 'data-drawing-area')) return node;
      } else if (node.protected || Object.hasOwn(node.attributes, 'data-no-draw') ||
        selector.split(',').includes(node.tag)) return node;
    }
    return null;
  }
  matches(selector) { return selector.split(',').includes(this.tag) || Object.hasOwn(this.attributes, 'contenteditable'); }
}

function makeEnvironment({ fine = true, reduced = false, canvasWorks = true, config } = {}) {
  let time = 0;
  let nextId = 0;
  const scheduled = new Map();
  const paints = [];
  let frameCount = 0;
  let path = [];
  const context = {
    clearRect() { paints.length = 0; }, setTransform(...values) { this.transform = values; },
    beginPath() { path = []; }, moveTo(x, y) { path.push(['move', x, y]); },
    lineTo(x, y) { path.push(['line', x, y]); },
    quadraticCurveTo(...values) { path.push(['curve', ...values]); },
    stroke() { paints.push({ path: [...path], alpha: this.globalAlpha, width: this.lineWidth }); }
  };
  const document = new Events();
  document.body = new Element('body');
  document.head = new Element('head');
  document.activeElement = document.body;
  document.hidden = false;
  document.modal = false;
  document.querySelector = () => document.modal ? {} : null;
  document.createElement = tag => {
    const element = new Element(tag);
    if (tag === 'canvas') element.getContext = () => canvasWorks ? context : null;
    return element;
  };
  const paper = new Element('section', document.body);
  paper.setAttribute('data-drawing-area', '');
  document.elementFromPoint = () => paper;
  const window = new Events();
  window.performance = { now: () => time };
  window.innerWidth = 1000;
  window.innerHeight = 700;
  window.devicePixelRatio = 3;
  const fineQuery = new Events();
  fineQuery.matches = fine;
  const motionQuery = new Events();
  motionQuery.matches = reduced;
  window.matchMedia = query => query.includes('reduced-motion') ? motionQuery : fineQuery;
  window.selection = { isCollapsed: true };
  window.getSelection = () => window.selection;
  window.getComputedStyle = element => ({ cursor: element.cursor });
  window.requestAnimationFrame = callback => {
    const id = ++nextId;
    scheduled.set(id, { at: time + 16, callback, frame: true });
    return id;
  };
  window.cancelAnimationFrame = id => scheduled.delete(id);
  window.setTimeout = (callback, delay) => {
    const id = ++nextId;
    scheduled.set(id, { at: time + delay, callback, frame: false });
    return id;
  };
  window.clearTimeout = id => scheduled.delete(id);
  let mutationCallback;
  window.MutationObserver = class {
    constructor(callback) { mutationCallback = callback; }
    observe() {}
    disconnect() { mutationCallback = null; }
  };
  const controller = createPencilCursor({ window, document, config });
  const advance = duration => {
    const end = time + duration;
    let count = 0;
    while (true) {
      const next = [...scheduled.entries()].filter(([, task]) => task.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      if (++count > 2000) throw new Error('Unexpected permanent animation loop');
      const [id, task] = next;
      scheduled.delete(id);
      time = task.at;
      if (task.frame) frameCount += 1;
      task.callback(time);
    }
    time = end;
  };
  const move = (x, y, details = {}) => document.emit('pointermove', { target: paper, clientX: x, clientY: y, ...details });
  const stroke = (x, y, pressed = false) => {
    move(x, y, { buttons: pressed ? 1 : 0 });
    advance(10);
    move(x + 10, y, { buttons: pressed ? 1 : 0 });
    advance(10);
    document.emit('pointerup', { target: paper });
  };
  return { document, window, paper, context, paints, controller, fineQuery, motionQuery, advance, move, stroke,
    get time() { return time; }, get frameCount() { return frameCount; },
    get scheduledCount() { return scheduled.size; }, mutate: () => mutationCallback?.() };
}

const tests = [];
const test = (name, action) => tests.push({ name, action });

test('fine hover and motion preferences gate initialization and restore the native cursor', () => {
  const env = makeEnvironment({ fine: false });
  assert.equal(env.document.body.children.length, 0);
  assert.equal(env.controller.getState().enabled, false);
  assert.equal(env.move(10, 10).defaultPrevented, false);
  env.fineQuery.matches = true;
  env.fineQuery.emit('change');
  assert.equal(env.controller.getState().enabled, true);
  assert.equal(env.document.body.children.length, 2);
  env.move(10, 10);
  assert.equal(env.paper.classList.contains('pencil-surface-active'), true);
  env.motionQuery.matches = true;
  env.motionQuery.emit('change');
  assert.equal(env.controller.getState().enabled, false);
  assert.equal(env.paper.classList.contains('pencil-surface-active'), false);
  assert.equal(env.controller.getState().visible, false);
  assert.equal(env.scheduledCount, 0);
  const failed = makeEnvironment({ canvasWorks: false });
  failed.move(10, 10);
  assert.equal(failed.document.body.children.length, 0);
  assert.equal(failed.document.head.children.length, 0);
  assert.equal(failed.paper.classList.contains('pencil-surface-active'), false);
});

test('the pencil tip follows viewport coordinates and movement/drag produce distinct connected strokes', () => {
  const env = makeEnvironment();
  const event = env.move(10, 20);
  env.advance(10);
  env.move(20, 22);
  env.advance(16);
  const pencil = env.document.body.children.find(element => element.tag === 'span');
  const canvas = env.document.body.children.find(element => element.tag === 'canvas');
  assert.equal(pencil.style.transform, 'translate3d(20px,22px,0)');
  assert.equal(pencil.attributes['aria-hidden'], 'true');
  assert.equal(canvas.attributes['aria-hidden'], 'true');
  assert.equal(canvas.width, 2000, 'Device pixel ratio is capped');
  assert.equal(event.defaultPrevented, false);
  assert.ok(env.paints.some(paint => paint.width === 0.7 && paint.alpha === 0.19));
  assert.ok(env.paints[0].path.some(command => command[0] === 'line'));
  env.document.emit('pointerdown', { target: env.paper, clientX: 20, clientY: 22, buttons: 1 });
  env.move(30, 25, { buttons: 1 });
  env.advance(16);
  assert.ok(env.paints.some(paint => paint.width === 1.15 && paint.alpha === 0.40));
  for (const type of ['pointermove', 'pointerdown', 'pointerup']) {
    assert.ok(env.document.listeners.get(type).every(listener => listener.options.passive), `${type} is passive`);
  }
  const style = env.document.head.children[0].textContent;
  assert.match(style, /pointer-events:none!important/);
  assert.match(pencil.innerHTML, /M0 0/);
});

test('text, controls, art, no-draw areas, resize cursors, selection, forms, and modals retain native interaction', () => {
  const env = makeEnvironment();
  for (const tag of ['a', 'button', 'form', 'input', 'textarea', 'nav', 'img', 'svg', 'canvas', 'article', 'p', 'h1']) {
    const target = new Element(tag, env.paper);
    env.move(10, 10);
    const event = env.move(20, 20, { target });
    assert.equal(env.controller.getState().visible, false, `Hide pencil over ${tag}`);
    assert.equal(env.controller.getState().activePoints, 0);
    assert.equal(event.defaultPrevented, false);
    assert.equal(target.classList.contains('pencil-surface-active'), false);
  }
  for (const mutate of [
    target => target.setAttribute('data-no-draw', ''),
    target => { target.childNodes = [{ nodeType: 3, textContent: 'Real text content' }]; },
    target => { target.cursor = 'nwse-resize'; },
    target => { target.cursor = 'pointer'; },
    target => { target.protected = true; }
  ]) {
    const target = new Element('div', env.paper);
    mutate(target);
    env.move(20, 20, { target });
    assert.equal(env.controller.getState().visible, false);
  }
  env.window.selection.isCollapsed = false;
  env.move(20, 20);
  assert.equal(env.controller.getState().visible, false);
  env.window.selection.isCollapsed = true;
  env.document.activeElement = new Element('input');
  env.move(20, 20);
  assert.equal(env.controller.getState().visible, false);
  env.document.activeElement = env.document.body;
  env.document.modal = true;
  env.move(20, 20);
  assert.equal(env.controller.getState().visible, false);
  env.document.modal = false;
  env.move(20, 20, { pointerType: 'touch' });
  assert.equal(env.controller.getState().visible, false);
});

test('connecting segments cannot bridge protected artwork/text between eligible endpoints', () => {
  const env = makeEnvironment();
  const text = new Element('p', env.paper);
  env.document.elementFromPoint = x => x >= 40 && x <= 60 ? text : env.paper;
  env.move(10, 20);
  env.move(20, 20);
  env.move(80, 20);
  const state = env.controller.getState();
  assert.equal(state.completedGroups, 1);
  assert.equal(state.activePoints, 1, 'A fresh group starts beyond the protected region');
  assert.equal(state.totalPoints, 3, 'No cross-content connection is recorded');
  const corner = makeEnvironment();
  const cornerText = new Element('p', corner.paper);
  corner.document.elementFromPoint = (x, y) => x >= 37 && x <= 43 && y >= 13 && y <= 18 ? cornerText : corner.paper;
  corner.move(10, 10);
  corner.move(50, 10);
  corner.move(50, 50);
  assert.equal(corner.controller.getState().completedGroups, 1);
  assert.equal(corner.controller.getState().activePoints, 1, 'Smoothing cannot cut a corner through protected text');
});

test('completed groups hold for 2500ms, fade independently for 400ms, then stop all scheduled work', () => {
  assert.equal(PENCIL_CONFIG.holdMs, 2500);
  assert.equal(PENCIL_CONFIG.fadeMs, 400);
  const env = makeEnvironment();
  env.stroke(10, 10);
  const firstFinished = env.time;
  env.advance(480);
  const framesDuringHold = env.frameCount;
  env.advance(500);
  assert.equal(env.frameCount, framesDuringHold, 'No perpetual RAF runs while unchanged marks hold');
  env.stroke(100, 100);
  const secondFinished = env.time;
  assert.deepEqual(env.controller.getState().groupTimes, [firstFinished, secondFinished]);
  env.advance(firstFinished + 2700 - env.time);
  const first = env.paints.find(paint => paint.path[0][1] === 10);
  const second = env.paints.find(paint => paint.path[0][1] === 100);
  assert.ok(first.alpha > 0 && first.alpha < 0.19, 'Older stroke is fading');
  assert.equal(second.alpha, 0.19, 'Newer stroke retains full strength independently');
  env.advance(firstFinished + 2920 - env.time);
  assert.deepEqual(env.controller.getState().groupTimes, [secondFinished]);
  env.advance(secondFinished + 2940 - env.time);
  assert.equal(env.controller.getState().completedGroups, 0);
  assert.equal(env.controller.getState().activePoints, 0);
  assert.equal(env.scheduledCount, 0);
  assert.equal(env.controller.getState().pendingFrame, false);
  assert.equal(env.controller.getState().pendingTimer, false);
  assert.ok(env.frameCount < 70, `Fades use bounded animation work (${env.frameCount} frames)`);
});

test('long and repeated gestures obey group and total-point memory caps', () => {
  const env = makeEnvironment({ config: { maxGroups: 3, maxPointsPerGroup: 5, maxTotalPoints: 12 } });
  for (let i = 0; i < 12; i += 1) env.stroke(10 + i, 20);
  assert.ok(env.controller.getState().completedGroups <= 3);
  for (let i = 0; i < 200; i += 1) {
    env.move(40 + i * 2, 60, { buttons: 1 });
    env.advance(1);
    const state = env.controller.getState();
    assert.ok(state.completedGroups <= 3);
    assert.ok(state.activePoints <= 5);
    assert.ok(state.totalPoints <= 12);
  }
});

test('scroll, resize, focus loss, pointer exit, selection, visibility, keyboard, and modal changes clear stale trails', () => {
  const resets = [
    env => env.window.emit('scroll'), env => env.window.emit('resize'), env => env.window.emit('blur'),
    env => env.window.emit('pagehide'), env => env.document.emit('pointercancel'),
    env => env.document.emit('pointerout', { relatedTarget: null }), env => env.document.emit('keydown'),
    env => { env.window.selection.isCollapsed = false; env.document.emit('selectionchange'); },
    env => { env.document.hidden = true; env.document.emit('visibilitychange'); },
    env => { env.document.modal = true; env.mutate(); }
  ];
  for (const trigger of resets) {
    const env = makeEnvironment();
    env.stroke(10, 10);
    trigger(env);
    const state = env.controller.getState();
    assert.equal(state.visible, false);
    assert.equal(state.totalPoints, 0);
    assert.equal(env.paper.classList.contains('pencil-surface-active'), false);
    assert.equal(env.scheduledCount, 0);
  }
});

test('destroy removes overlays/listeners and never leaves the native cursor hidden', () => {
  const env = makeEnvironment();
  env.stroke(10, 10);
  env.controller.destroy();
  assert.equal(env.document.body.children.length, 0);
  assert.equal(env.document.head.children.length, 0);
  assert.equal(env.paper.classList.contains('pencil-surface-active'), false);
  assert.equal(env.scheduledCount, 0);
  assert.ok([...env.document.listeners.values()].every(items => !items.length));
  assert.ok([...env.window.listeners.values()].every(items => !items.length));
});

test('an unexpected canvas paint failure immediately restores the native cursor', () => {
  const env = makeEnvironment();
  env.context.stroke = () => { throw new Error('Canvas unavailable'); };
  env.stroke(10, 10);
  env.advance(20);
  assert.equal(env.controller.getState().enabled, false);
  assert.equal(env.paper.classList.contains('pencil-surface-active'), false);
  assert.equal(env.controller.getState().visible, false);
});

for (const { name, action } of tests) {
  try { action(); console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`\n${tests.length} pencil cursor checks passed. Native appearance still requires visual browser verification.`);
