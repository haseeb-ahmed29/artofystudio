/* Shared progressive enhancements. Every page keeps its content and links in HTML. */
(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMediaChange = (query, listener) => {
    if (query.addEventListener) query.addEventListener('change', listener);
    else if (query.addListener) query.addListener(listener);
  };

  function initMenu() {
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.menu-toggle');
    const navigation = document.getElementById('primary-nav');
    if (!header || !toggle || !navigation) return;

    const desktop = window.matchMedia('(min-width: 960px)');
    const close = (restoreFocus = false) => {
      const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
      header.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus && wasOpen) toggle.focus();
    };

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      header.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    navigation.addEventListener('click', event => {
      if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.classList.contains('menu-open')) {
        event.preventDefault();
        close(true);
      }
    });
    onMediaChange(desktop, () => close());
    // A restored page should not retain an expanded menu from another viewport.
    window.addEventListener('pageshow', () => close());
  }

  function initReveals() {
    const sections = [...document.querySelectorAll('.reveal')];
    const paths = [...document.querySelectorAll('.process-path')];
    const showSection = element => {
      element.classList.add('is-visible');
      element.classList.remove('will-reveal');
    };
    const showPath = element => {
      element.classList.add('is-drawn');
      element.style.strokeDashoffset = '0';
    };
    const showAll = () => {
      sections.forEach(showSection);
      paths.forEach(showPath);
    };
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    let observer;
    try {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          if (entry.target.classList.contains('process-path')) showPath(entry.target);
          else showSection(entry.target);
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px 24px 0px' });
      sections.forEach(element => {
        element.classList.add('will-reveal');
        observer.observe(element);
      });
      paths.forEach(element => {
        if (typeof element.getTotalLength === 'function') {
          const length = element.getTotalLength();
          element.style.setProperty('--path-length', String(length));
          element.style.strokeDasharray = `${length} ${length}`;
          element.style.strokeDashoffset = String(length);
        }
        observer.observe(element);
      });
    } catch {
      if (observer) observer.disconnect();
      showAll();
    }
    onMediaChange(reducedMotion, event => {
      if (event.matches) {
        if (observer) observer.disconnect();
        showAll();
      }
    });
    // Content is always present when printing, including sections not yet scrolled to.
    window.addEventListener('beforeprint', showAll);
  }

  function initLightbox() {
    const links = [...document.querySelectorAll('a[data-lightbox]')];
    const dialog = document.getElementById('art-lightbox');
    if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;
    const image = document.getElementById('lightbox-image');
    const title = document.getElementById('lightbox-title');
    const description = document.getElementById('lightbox-description');
    const count = document.getElementById('lightbox-count');
    const closeButton = dialog.querySelector('[data-close-lightbox]');
    const previous = dialog.querySelector('[data-previous-art]');
    const next = dialog.querySelector('[data-next-art]');
    if (!image || !title || !description || !closeButton) return;

    let index = 0;
    let trigger = null;
    let previousOverflow = '';
    let previousPadding = '';
    let scrollLocked = false;
    const lockScroll = () => {
      if (scrollLocked) return;
      previousOverflow = document.body.style.overflow;
      previousPadding = document.body.style.paddingRight;
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      if (scrollbarWidth) {
        const padding = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
        document.body.style.paddingRight = `${padding + scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
      scrollLocked = true;
    };
    const unlockScroll = () => {
      if (!scrollLocked) return;
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      scrollLocked = false;
    };
    const showImage = requestedIndex => {
      index = (requestedIndex + links.length) % links.length;
      const link = links[index];
      const artworkTitle = link.dataset.title || link.querySelector('img')?.alt || 'Artwork';
      image.src = link.href;
      image.alt = link.querySelector('img')?.alt || `${artworkTitle} — complete artwork`;
      const originalImage = link.querySelector('img');
      if (originalImage?.width && originalImage?.height) {
        image.width = originalImage.width;
        image.height = originalImage.height;
      }
      title.textContent = artworkTitle;
      description.textContent = link.dataset.description || '';
      if (count) count.textContent = `${index + 1} / ${links.length}`;
      if (previous) previous.disabled = links.length < 2;
      if (next) next.disabled = links.length < 2;
    };
    const close = () => {
      if (dialog.open) dialog.close();
    };
    const focusableElements = () => [...dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter(element => !element.hidden && element.getClientRects().length);

    links.forEach((link, linkIndex) => {
      link.addEventListener('click', event => {
        // Preserve normal new-tab/download link behavior.
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        event.preventDefault();
        trigger = link;
        showImage(linkIndex);
        dialog.showModal();
        lockScroll();
        dialog.scrollTop = 0;
        closeButton.focus();
      });
    });
    closeButton.addEventListener('click', close);
    if (previous) previous.addEventListener('click', () => showImage(index - 1));
    if (next) next.addEventListener('click', () => showImage(index + 1));
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener('close', () => {
      unlockScroll();
      if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showImage(index + (event.key === 'ArrowLeft' ? -1 : 1));
      } else if (event.key === 'Tab') {
        const controls = focusableElements();
        if (!controls.length) {
          event.preventDefault();
          return;
        }
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    window.addEventListener('pagehide', () => {
      // Avoid restoring an inert page with an unlocked body from the back/forward cache.
      close();
      unlockScroll();
    });
  }

  function initInquiry() {
    const form = document.getElementById('inquiry-form');
    if (!form) return;
    const fieldNames = ['name', 'email', 'type', 'details', 'reference'];
    const fields = Object.fromEntries(fieldNames.map(name => [name, form.elements.namedItem(name)]));
    if (!fields.name || !fields.email || !fields.type || !fields.details) return;
    const knownTypes = new Set(['sketch', 'full-color', 'premium-scene', 'unsure']);
    const unsureLabel = [...fields.type.options].find(option => option.value === 'unsure')?.textContent.trim() || 'Let’s discuss my idea';
    const status = document.getElementById('form-status');
    const copyButton = document.getElementById('copy-inquiry');
    const copyPanel = document.getElementById('copy-panel');
    const copyArea = document.getElementById('inquiry-copy');
    const action = form.getAttribute('action') || '';
    const mailtoMatch = /^mailto:([^?\s]+)/i.exec(action);
    const recipient = mailtoMatch ? mailtoMatch[1] : 'artofystudio@gmail.com';
    let hasValidated = false;
    form.noValidate = true;

    const selectedType = new URLSearchParams(window.location.search).get('type');
    if (knownTypes.has(selectedType) && [...fields.type.options].some(option => option.value === selectedType)) {
      fields.type.value = selectedType;
    }
    const report = message => { if (status) status.textContent = message; };
    const errorFor = name => {
      const field = fields[name];
      if (!field) return '';
      const value = field.value.trim();
      if (name === 'name' && !value) return 'Please enter your name.';
      if (name === 'email') {
        if (!value) return 'Please enter your email address.';
        if (field.validity.typeMismatch || !/^[^\s@]+@[^\s@]+$/.test(value)) {
          return 'Please enter a valid email address.';
        }
      }
      if (name === 'type' && !knownTypes.has(value)) return `Please choose a commission type, or choose “${unsureLabel}”.`;
      if (name === 'details' && !value) return 'Please describe the artwork you have in mind.';
      if (name === 'reference' && value) {
        try {
          const reference = new URL(value);
          if (!['http:', 'https:'].includes(reference.protocol)) throw new Error('Unsupported link');
        } catch {
          return 'Please use a complete http:// or https:// reference link, or leave this optional field blank.';
        }
      }
      if (field.validity.tooLong) return 'Please shorten this entry to fit the field limit.';
      return '';
    };
    const setError = (name, message) => {
      const field = fields[name];
      if (!field) return;
      field.setAttribute('aria-invalid', String(Boolean(message)));
      const error = document.getElementById(`${name}-error`);
      if (error) {
        error.textContent = message;
        error.hidden = !message;
        const describedBy = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        describedBy.add(error.id);
        field.setAttribute('aria-describedby', [...describedBy].join(' '));
      }
    };
    const validate = () => {
      hasValidated = true;
      let firstInvalid = null;
      fieldNames.forEach(name => {
        const message = errorFor(name);
        setError(name, message);
        if (message && !firstInvalid) firstInvalid = fields[name];
      });
      if (firstInvalid) {
        report('Please check the highlighted fields. Your entries have been kept.');
        firstInvalid.focus();
        return false;
      }
      return true;
    };
    fieldNames.forEach(name => {
      const field = fields[name];
      if (!field) return;
      const update = () => {
        if (hasValidated || field.getAttribute('aria-invalid') === 'true') setError(name, errorFor(name));
      };
      field.addEventListener('input', update);
      field.addEventListener('change', update);
    });

    const buildInquiry = () => {
      const packageLabel = fields.type.selectedOptions[0]?.textContent.trim() || fields.type.value;
      const subject = `Artofy Studio commission inquiry — ${packageLabel}`;
      const body = [
        'Hello Artofy Studio,',
        '',
        `Name: ${fields.name.value.trim()}`,
        `Email: ${fields.email.value.trim()}`,
        `Commission type: ${packageLabel}`,
        '',
        'Project details:',
        fields.details.value.trim(),
        '',
        `Reference link: ${fields.reference?.value.trim() || 'None provided'}`
      ].join('\n');
      return { subject, body, text: `To: ${recipient}\nSubject: ${subject}\n\n${body}` };
    };
    const showCopy = inquiry => {
      if (copyArea) {
        copyArea.value = inquiry.text;
        copyArea.hidden = false;
      }
      if (copyPanel) copyPanel.hidden = false;
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!validate()) return;
      const inquiry = buildInquiry();
      showCopy(inquiry);
      report('Your email draft is ready. Send it from your email application. If it does not open, copy the inquiry text below.');
      const draft = `mailto:${recipient}?subject=${encodeURIComponent(inquiry.subject)}&body=${encodeURIComponent(inquiry.body)}`;
      try {
        window.location.href = draft;
      } catch {
        report(`Your inquiry is ready below. Copy it into an email to ${recipient} and send it from your email application.`);
      }
    });
    if (copyButton) copyButton.addEventListener('click', async () => {
      if (!validate()) return;
      const inquiry = buildInquiry();
      showCopy(inquiry);
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('Manual copy required');
        await navigator.clipboard.writeText(inquiry.text);
        report(`Inquiry text copied. Paste it into an email to ${recipient} and send it from your email application.`);
      } catch {
        if (copyArea) {
          copyArea.focus();
          copyArea.select();
          copyArea.setSelectionRange(0, copyArea.value.length);
        }
        report(`Your inquiry text is selected below. Copy it into an email to ${recipient} and send it from your email application.`);
      }
    });
    // The static page offers a direct email link when these enhancements fail.
    const draftButton = document.getElementById('draft-button');
    if (draftButton) draftButton.disabled = false;
    if (copyButton) copyButton.disabled = false;
  }

  function init() {
    initMenu();
    initReveals();
    initLightbox();
    initInquiry();
    document.documentElement.classList.add('js');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
