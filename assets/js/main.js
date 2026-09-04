(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // First-visit botanical entrance. The inline head script decides whether it runs.
  const initSiteLoader = () => {
    const root = document.documentElement;
    if (!root.classList.contains('site-intro-pending')) return;

    const loader = document.querySelector('.site-loader');
    const siteShell = document.querySelector('.site-shell');
    const skipLink = document.querySelector('.skip-link');
    if (!loader) {
      root.classList.remove('site-intro-pending');
      return;
    }

    window.clearTimeout(window.__siteIntroFallback);
    const startedAt = performance.now();
    let isHiding = false;
    let releaseTimer;

    const canUseInert = 'inert' in HTMLElement.prototype;
    if (canUseInert) {
      if (siteShell) siteShell.inert = true;
      if (skipLink) skipLink.inert = true;
    }

    const finishSiteLoader = () => {
      window.clearTimeout(releaseTimer);
      window.clearTimeout(window.__siteIntroFallback);
      root.classList.remove('site-intro-pending', 'site-intro-revealing');
      if (canUseInert) {
        if (siteShell) siteShell.inert = false;
        if (skipLink) skipLink.inert = false;
      }
      loader.remove();
    };

    const hideSiteLoader = () => {
      if (isHiding) return;
      isHiding = true;
      const remainingIntroTime = Math.max(0, 1080 - (performance.now() - startedAt));

      window.setTimeout(() => {
        root.classList.remove('site-intro-pending');
        root.classList.add('site-intro-revealing');
        const onCurtainEnd = event => {
          if (event.target !== loader || event.animationName !== 'loaderCurtainOut') return;
          loader.removeEventListener('animationend', onCurtainEnd);
          finishSiteLoader();
        };
        loader.addEventListener('animationend', onCurtainEnd);
        releaseTimer = window.setTimeout(finishSiteLoader, 900);
      }, remainingIntroTime);
    };

    const waitForImportantResources = async () => {
      const waits = [];
      if (document.fonts?.ready) waits.push(document.fonts.ready);

      const priorityImage = document.querySelector('img[fetchpriority="high"]');
      if (priorityImage && !priorityImage.complete) {
        waits.push(new Promise(resolve => {
          priorityImage.addEventListener('load', resolve, { once: true });
          priorityImage.addEventListener('error', resolve, { once: true });
        }));
      }
      await Promise.all(waits);
    };

    Promise.race([
      waitForImportantResources(),
      new Promise(resolve => window.setTimeout(resolve, 1800))
    ]).then(hideSiteLoader, hideSiteLoader);

    window.__siteIntroFallback = window.setTimeout(finishSiteLoader, 4000);
  };

  initSiteLoader();

  const header = document.querySelector('[data-header]');
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');

  // Sticky header treatment
  const updateHeader = () => header?.classList.toggle('scrolled', window.scrollY > 16);
  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });

  // Mobile navigation
  const closeNav = () => {
    nav?.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
    navToggle?.setAttribute('aria-label', 'Open navigation');
    document.body.classList.remove('nav-open');
  };
  navToggle?.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    navToggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
    nav?.classList.toggle('open', !open);
    document.body.classList.toggle('nav-open', !open);
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) {
      closeNav();
      navToggle?.focus();
    }
  });

  // Scroll reveals with staggered entry for neighboring cards
  const reveals = [...document.querySelectorAll('.reveal')];
  if (reducedMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const siblings = [...entry.target.parentElement.children].filter(el => el.classList.contains('reveal'));
        const index = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = `${Math.min(index, 5) * 70}ms`;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px' });
    reveals.forEach(el => observer.observe(el));
  }

  // Accessible FAQ accordions
  document.querySelectorAll('[data-accordion] button').forEach(button => {
    button.addEventListener('click', () => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!isOpen));
      if (panel) panel.hidden = isOpen;
    });
  });

  // Footer year
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  // Contact form: local validation/demo only until a secure endpoint is configured.
  const form = document.getElementById('contact-form');
  if (!form) return;

  const modal = document.getElementById('success-modal');
  const modalPanel = modal?.querySelector('.modal-panel');
  const submitButton = form.querySelector('.submit-button');
  const status = form.querySelector('.form-status');
  let lastFocused = null;

  const messages = {
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    'contact-method': 'Please choose how you prefer to be contacted.',
    interest: 'Please select what you are interested in.',
    'session-type': 'Please select a session format.',
    consent: 'Please confirm that you understand the privacy notice.'
  };

  const setError = (key, message = '') => {
    const error = document.getElementById(`${key}-error`);
    if (error) error.textContent = message;
    const control = document.getElementById(key);
    control?.closest('.field')?.classList.toggle('has-error', Boolean(message));
    if (control) control.setAttribute('aria-invalid', String(Boolean(message)));
  };

  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validate = () => {
    let firstInvalid = null;
    let valid = true;
    const name = form.elements.name;
    const email = form.elements.email;
    const method = form.elements.contact_method;
    const interest = form.querySelector('input[name="interest"]:checked');
    const session = form.querySelector('input[name="session_type"]:checked');
    const consent = form.elements.consent;

    const checks = [
      { key: 'name', ok: name.value.trim().length > 1, control: name },
      { key: 'email', ok: validEmail(email.value.trim()), control: email },
      { key: 'contact-method', ok: Boolean(method.value), control: method },
      { key: 'interest', ok: Boolean(interest), control: form.querySelector('input[name="interest"]') },
      { key: 'session-type', ok: Boolean(session), control: form.querySelector('input[name="session_type"]') },
      { key: 'consent', ok: consent.checked, control: consent }
    ];

    checks.forEach(check => {
      setError(check.key, check.ok ? '' : messages[check.key]);
      if (!check.ok) {
        valid = false;
        firstInvalid ||= check.control;
      }
    });
    return { valid, firstInvalid };
  };

  ['name', 'email', 'contact-method'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => setError(id));
  });
  form.querySelectorAll('input[type="radio"], #consent').forEach(input => {
    input.addEventListener('change', () => {
      if (input.name === 'interest') setError('interest');
      if (input.name === 'session_type') setError('session-type');
      if (input.id === 'consent') setError('consent');
    });
  });

  const openModal = () => {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => modalPanel?.focus(), 50);
  };
  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    lastFocused?.focus();
  };
  modal?.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
  modal?.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Tab' && modalPanel) {
      const focusable = [...modalPanel.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  form.addEventListener('submit', event => {
    const usingPlaceholder = form.dataset.placeholderEndpoint === 'true';
    if (usingPlaceholder) event.preventDefault();
    const result = validate();
    if (!result.valid) {
      event.preventDefault();
      status.textContent = 'Please review the highlighted fields.';
      result.firstInvalid?.focus();
      return;
    }

    if (usingPlaceholder) {
      status.textContent = '';
      submitButton.disabled = true;
      submitButton.classList.add('loading');
      submitButton.querySelector('.button-label').textContent = 'Preparing inquiry…';

      // EmailJS integration point: replace this timer with emailjs.sendForm(...).
      window.setTimeout(() => {
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.querySelector('.button-label').textContent = 'Send general inquiry';
        form.reset();
        openModal();
      }, 700);
    }
  });
})();
