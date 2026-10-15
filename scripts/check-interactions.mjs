/**
 * Dependency-free behavior checks for the shipped browser script.
 * Run: node scripts/check-interactions.mjs
 *
 * These execute main.js against small DOM/event stubs built from the real HTML.
 * They check state, encoding, and keyboard behavior; native browser rendering,
 * native dialog inertness, and CSS layout still require visual browser checks.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = readFileSync(resolve(root, 'assets/js/main.js'), 'utf8');
const contactHTML = readFileSync(resolve(root, 'contact.html'), 'utf8');
const galleryHTML = readFileSync(resolve(root, 'artwork.html'), 'utf8');
const decode = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#(?:39|x27);/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const textOnly = value => decode(value.replace(/<[^>]*>/g, ''));
const attributes = source => Object.fromEntries([...source.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
  .map(([, name, double, single, bare]) => [name, decode(double ?? single ?? bare ?? '')]));

class Element {
  constructor(document, attrs = {}) {
    this.document = document;
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.value = attrs.value || '';
    this.textContent = '';
    this.hidden = Object.hasOwn(attrs, 'hidden');
    this.disabled = false;
    this.isConnected = true;
    this.listeners = new Map();
    this.validity = { typeMismatch: false, tooLong: false };
    this.style = { overflow: '', paddingRight: '', setProperty(name, value) { this[name] = value; } };
    const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force = !classes.has(name)) => force ? classes.add(name) : classes.delete(name)
    };
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  async emit(type, details = {}) {
    const event = {
      target: this, button: 0, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...details
    };
    await Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    return event;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  focus() { this.document.activeElement = this; }
  select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  getClientRects() { return this.hidden ? [] : [{}]; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

function environment({ search = '', reduced = true, clipboard, secure = true, failNavigation = false } = {}) {
  const document = {
    readyState: 'complete', activeElement: null, ids: new Map(), reveals: [], paths: [], links: [],
    getElementById(id) { return this.ids.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === '.reveal') return this.reveals;
      if (selector === '.process-path') return this.paths;
      if (selector === 'a[data-lightbox]') return this.links;
      return [];
    }
  };
  const register = element => {
    if (element.id) document.ids.set(element.id, element);
    return element;
  };
  document.documentElement = new Element(document);
  document.documentElement.clientWidth = 980;
  document.body = new Element(document);
  document.body.style.overflow = 'auto';
  document.body.style.paddingRight = '3px';
  const window = new Element(document);
  const motion = new Element(document);
  motion.matches = reduced;
  window.matchMedia = () => motion;
  window.innerWidth = 1000;
  window.isSecureContext = secure;
  window.getComputedStyle = element => ({ paddingRight: element.style.paddingRight || '0px' });
  let navigated = '';
  window.location = { search };
  Object.defineProperty(window.location, 'href', {
    get: () => navigated,
    set: value => {
      if (failNavigation) throw new Error('No email application configured');
      navigated = value;
    }
  });
  const navigator = clipboard === undefined ? {} : { clipboard };
  const context = { window, document, navigator, URL, URLSearchParams, console };
  const run = () => runInNewContext(script, context, { filename: 'assets/js/main.js' });
  return { document, window, motion, register, run, context };
}

function contactEnvironment(options = {}) {
  const env = environment(options);
  const formMatch = contactHTML.match(/<form\b([^>]*\bid="inquiry-form"[^>]*)>([\s\S]*?)<\/form>/);
  assert.ok(formMatch, 'The shipped contact page contains the inquiry form');
  const form = env.register(new Element(env.document, attributes(formMatch[1])));
  const fields = {};
  for (const match of formMatch[2].matchAll(/<(input|select|textarea)\b([^>]*)>(?:([\s\S]*?)<\/\1>)?/g)) {
    const [, tag, source, contents = ''] = match;
    const attrs = attributes(source);
    const field = env.register(new Element(env.document, attrs));
    if (tag === 'select') {
      field.options = [...contents.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(option => ({
        value: attributes(option[1]).value || '', textContent: textOnly(option[2])
      }));
      field.value = field.options[0]?.value || '';
      Object.defineProperty(field, 'selectedOptions', {
        get: () => field.options.filter(option => option.value === field.value)
      });
    }
    if (attrs.name) fields[attrs.name] = field;
  }
  for (const match of formMatch[2].matchAll(/<(p|div|button)\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    env.register(new Element(env.document, attributes(match[2])));
  }
  form.elements = { namedItem: name => fields[name] || null };
  for (const name of ['name', 'email', 'type', 'details', 'reference']) {
    assert.ok(fields[name], `HTML field name matches script contract: ${name}`);
    assert.ok(env.document.getElementById(`${name}-error`), `HTML has inline ${name} error`);
  }
  env.run();
  return { ...env, form, fields, status: env.document.getElementById('form-status'),
    copyPanel: env.document.getElementById('copy-panel'), copyArea: env.document.getElementById('inquiry-copy'),
    copyButton: env.document.getElementById('copy-inquiry') };
}

function fillValid(env) {
  Object.assign(env.fields.name, { value: 'Haseeb & Studio + ハジ' });
  Object.assign(env.fields.email, { value: 'haseeb+art@example.com' });
  Object.assign(env.fields.type, { value: 'premium-scene' });
  Object.assign(env.fields.details, { value: 'A & B + a moonlit knight.\n第二行 — keep the colors! <test>' });
  Object.assign(env.fields.reference, { value: 'https://example.com/reference?tag=a%2Bb&scene=夜' });
}

function galleryEnvironment({ nativeDialog = true } = {}) {
  const env = environment();
  for (const match of galleryHTML.matchAll(/<a\b([^>]*\bdata-lightbox\b[^>]*)>/g)) {
    const attrs = attributes(match[1]);
    const link = new Element(env.document, attrs);
    link.href = new URL(attrs.href, 'https://example.test/').href;
    link.dataset = { title: attrs['data-title'], description: attrs['data-description'] };
    env.document.links.push(link);
  }
  assert.equal(env.document.links.length, 4, 'The shipped gallery provides all four lightbox links');
  const dialogMatch = galleryHTML.match(/<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/);
  assert.ok(dialogMatch, 'The shipped gallery contains the native dialog');
  const dialog = env.register(new Element(env.document, attributes(dialogMatch[1])));
  const parts = {};
  for (const id of ['lightbox-image', 'lightbox-title', 'lightbox-description', 'lightbox-count']) {
    assert.ok(dialogMatch[2].includes(`id="${id}"`), `Dialog part exists: ${id}`);
    parts[id] = env.register(new Element(env.document, { id }));
  }
  for (const attribute of ['data-close-lightbox', 'data-previous-art', 'data-next-art']) {
    assert.ok(dialogMatch[2].includes(attribute), `Dialog control exists: ${attribute}`);
    parts[attribute] = new Element(env.document);
  }
  const controls = ['data-close-lightbox', 'data-previous-art', 'data-next-art'].map(name => parts[name]);
  dialog.querySelector = selector => parts[selector.slice(1, -1)] || null;
  dialog.querySelectorAll = () => controls.filter(control => !control.disabled);
  dialog.contains = element => element === dialog || controls.includes(element);
  dialog.getBoundingClientRect = () => ({ left: 100, right: 900, top: 50, bottom: 750 });
  dialog.open = false;
  if (nativeDialog) dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => {
    dialog.open = false;
    // Native close events run after close(); this synchronous dispatch is sufficient
    // for verifying the script's restoration listener and avoids timer-dependent tests.
    void dialog.emit('close');
  };
  env.run();
  return { ...env, dialog, parts, links: env.document.links, controls };
}

const tests = [];
const test = (name, action) => tests.push({ name, action });

test('contact query preselection accepts only shipped commission choices', () => {
  for (const type of ['sketch', 'full-color', 'premium-scene', 'unsure']) {
    assert.equal(contactEnvironment({ search: `?type=${type}` }).fields.type.value, type);
  }
  for (const type of ['', 'SKETCH', '__proto__', '<img src=x>', 'full-color\0']) {
    const env = contactEnvironment({ search: `?type=${encodeURIComponent(type)}` });
    assert.equal(env.fields.type.value, '', `Reject unrecognized query type: ${JSON.stringify(type)}`);
    assert.equal(env.window.location.href, '');
  }
});

test('validation focuses errors, preserves input, and clears errors as fields are corrected', async () => {
  const env = contactEnvironment();
  env.fields.name.value = '   ';
  env.fields.details.value = 'An unfinished idea + details';
  const before = Object.fromEntries(Object.entries(env.fields).map(([name, field]) => [name, field.value]));
  const event = await env.form.emit('submit');
  assert.equal(event.defaultPrevented, true);
  assert.equal(env.window.location.href, '', 'Invalid submissions never launch an email draft');
  assert.equal(env.document.activeElement, env.fields.name);
  for (const name of ['name', 'email', 'type']) {
    assert.equal(env.fields[name].getAttribute('aria-invalid'), 'true');
    assert.ok(env.document.getElementById(`${name}-error`).textContent);
    assert.equal(env.document.getElementById(`${name}-error`).hidden, false);
  }
  assert.equal(env.fields.details.getAttribute('aria-invalid'), 'false');
  assert.ok(env.document.getElementById('type-error').textContent.includes('Let’s discuss my idea'));
  for (const [name, value] of Object.entries(before)) assert.equal(env.fields[name].value, value);
  env.fields.name.value = 'A real name';
  await env.fields.name.emit('input');
  assert.equal(env.fields.name.getAttribute('aria-invalid'), 'false');
  assert.equal(env.document.getElementById('name-error').hidden, true);
  env.fields.email.value = 'invalid-address';
  env.fields.email.validity.typeMismatch = true;
  env.fields.type.value = 'sketch';
  env.fields.reference.value = 'javascript:alert(1)';
  await env.form.emit('submit');
  assert.equal(env.document.activeElement, env.fields.email);
  assert.equal(env.fields.reference.getAttribute('aria-invalid'), 'true');
  assert.equal(env.fields.reference.value, 'javascript:alert(1)', 'Invalid entries remain editable');
  env.fields.email.value = 'artist+test@example.com';
  env.fields.email.validity.typeMismatch = false;
  await env.fields.email.emit('input');
  env.fields.reference.value = '';
  await env.fields.reference.emit('input');
  await env.fields.type.emit('change');
  assert.equal(env.fields.email.getAttribute('aria-invalid'), 'false');
  assert.equal(env.fields.reference.getAttribute('aria-invalid'), 'false');
  assert.equal(env.fields.type.getAttribute('aria-invalid'), 'false');
  assert.ok(env.fields.details.getAttribute('aria-describedby').includes('details-hint'), 'Existing field help remains associated');
});

test('email draft encoding round-trips ampersands, pluses, newlines, unicode, and reference queries', async () => {
  const env = contactEnvironment();
  fillValid(env);
  await env.form.emit('submit');
  const draft = new URL(env.window.location.href);
  assert.equal(draft.protocol, 'mailto:');
  assert.equal(draft.pathname, 'artofystudio@gmail.com');
  assert.deepEqual([...draft.searchParams.keys()], ['subject', 'body']);
  assert.equal(draft.searchParams.get('subject'), 'Artofy Studio commission inquiry — Premium Scene — $150+');
  const body = draft.searchParams.get('body');
  for (const name of ['name', 'email', 'details', 'reference']) assert.ok(body.includes(env.fields[name].value));
  assert.match(env.window.location.href, /%26/);
  assert.match(env.window.location.href, /%2B/);
  assert.match(env.window.location.href, /%0A/);
  assert.equal(env.copyPanel.hidden, false);
  assert.ok(env.copyArea.value.includes(body));
  assert.match(env.status.textContent, /send it from your email application/i);
  assert.doesNotMatch(env.status.textContent, /(?:message|inquiry) (?:was |has been )?sent|successfully sent/i);
});

test('manually altered commission values cannot bypass the allowlist', async () => {
  const env = contactEnvironment();
  fillValid(env);
  env.fields.type.value = 'invented-package';
  await env.form.emit('submit');
  assert.equal(env.window.location.href, '');
  assert.equal(env.fields.type.getAttribute('aria-invalid'), 'true');
  assert.equal(env.document.activeElement, env.fields.type);
});

test('clipboard unavailable, denied, or insecure contexts expose selected manual-copy text', async () => {
  for (const options of [{}, { clipboard: { writeText: async () => { throw new Error('Permission denied'); } } },
    { clipboard: { writeText: async () => { throw new Error('Must not run'); } }, secure: false }]) {
    const env = contactEnvironment(options);
    fillValid(env);
    await env.copyButton.emit('click');
    assert.equal(env.copyPanel.hidden, false);
    assert.equal(env.copyArea.hidden, false);
    assert.equal(env.document.activeElement, env.copyArea);
    assert.equal(env.copyArea.selectionStart, 0);
    assert.equal(env.copyArea.selectionEnd, env.copyArea.value.length);
    assert.ok(env.copyArea.value.includes(env.fields.details.value));
    assert.match(env.status.textContent, /selected below/i);
    assert.equal(env.window.location.href, '', 'Copy does not launch an email application');
  }
});

test('successful copying uses the complete inquiry and gives honest next steps', async () => {
  let copied;
  const env = contactEnvironment({ clipboard: { writeText: async text => { copied = text; } } });
  fillValid(env);
  await env.copyButton.emit('click');
  assert.equal(copied, env.copyArea.value);
  assert.ok(copied.includes('To: artofystudio@gmail.com'));
  assert.ok(copied.includes(env.fields.details.value));
  assert.match(env.status.textContent, /text copied/i);
  assert.match(env.status.textContent, /send it from your email application/i);
});

test('a blocked mailto launch leaves the prepared inquiry available', async () => {
  const env = contactEnvironment({ failNavigation: true });
  fillValid(env);
  await env.form.emit('submit');
  assert.equal(env.copyPanel.hidden, false);
  assert.ok(env.copyArea.value.includes(env.fields.email.value));
  assert.match(env.status.textContent, /copy it into an email/i);
});

test('lightbox arrow navigation, focus containment, closing, and focus restoration', async () => {
  const env = galleryEnvironment();
  const { dialog, parts, links, document } = env;
  const opening = await links[0].emit('click');
  assert.equal(opening.defaultPrevented, true);
  assert.equal(dialog.open, true);
  assert.equal(parts['lightbox-image'].src, links[0].href);
  assert.equal(parts['lightbox-title'].textContent, 'Fantasy Battle');
  assert.equal(parts['lightbox-description'].textContent, links[0].dataset.description);
  assert.equal(document.activeElement, parts['data-close-lightbox']);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(document.body.style.paddingRight, '23px');
  await dialog.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(parts['lightbox-title'].textContent, 'Anime Knight', 'Previous wraps to the final artwork');
  assert.equal(parts['lightbox-count'].textContent, '4 / 4');
  await dialog.emit('keydown', { key: 'ArrowRight' });
  assert.equal(parts['lightbox-count'].textContent, '1 / 4');
  parts['data-next-art'].focus();
  assert.equal((await dialog.emit('keydown', { key: 'Tab' })).defaultPrevented, true);
  assert.equal(document.activeElement, parts['data-close-lightbox']);
  assert.equal((await dialog.emit('keydown', { key: 'Tab', shiftKey: true })).defaultPrevented, true);
  assert.equal(document.activeElement, parts['data-next-art']);
  const cancellation = await dialog.emit('cancel');
  assert.equal(cancellation.defaultPrevented, true);
  assert.equal(dialog.open, false);
  assert.equal(document.activeElement, links[0], 'Escape restores the original artwork trigger');
  assert.equal(document.body.style.overflow, 'auto');
  assert.equal(document.body.style.paddingRight, '3px');
  await links[2].emit('click');
  await parts['data-next-art'].emit('click');
  await parts['data-close-lightbox'].emit('click');
  assert.equal(document.activeElement, links[2], 'Changing artworks does not change the restoration target');
  assert.equal((await links[1].emit('click', { ctrlKey: true })).defaultPrevented, false);
  assert.equal(dialog.open, false, 'Modified clicks retain normal link behavior');
});

test('lightbox backdrop and no-native-dialog fallback preserve expected navigation', async () => {
  const env = galleryEnvironment();
  await env.links[1].emit('click');
  await env.dialog.emit('click', { clientX: 150, clientY: 100 });
  assert.equal(env.dialog.open, true, 'Clicking inside the dialog does not dismiss it');
  await env.dialog.emit('click', { clientX: 20, clientY: 20 });
  assert.equal(env.dialog.open, false);
  assert.equal(env.document.activeElement, env.links[1]);
  const fallback = galleryEnvironment({ nativeDialog: false });
  assert.equal((await fallback.links[0].emit('click')).defaultPrevented, false);
  assert.equal(fallback.dialog.open, false, 'Unsupported dialogs leave full-image anchors functional');
});

test('reduced motion and observer failure keep essential content visible', () => {
  for (const failure of [false, true]) {
    const env = environment({ reduced: !failure });
    const section = new Element(env.document, { class: 'reveal' });
    const path = new Element(env.document, { class: 'process-path' });
    env.document.reveals.push(section);
    env.document.paths.push(path);
    if (failure) {
      const BrokenObserver = class { constructor() { throw new Error('Observer unavailable'); } };
      env.window.IntersectionObserver = BrokenObserver;
      env.context.IntersectionObserver = BrokenObserver;
    }
    env.run();
    assert.equal(section.classList.contains('will-reveal'), false);
    assert.equal(section.classList.contains('is-visible'), true);
    assert.equal(path.classList.contains('is-drawn'), true);
    assert.equal(path.style.strokeDashoffset, '0');
  }
});

let passed = 0;
for (const { name, action } of tests) {
  try {
    await action();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`\n${passed} interaction checks passed. Native browser and layout verification remains separate.`);
