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
  const desktopNavigation = window.matchMedia('(min-width: 821px)');
  const handleNavigationBreakpoint = event => { if (event.matches) closeNav(); };
  if (desktopNavigation.addEventListener) desktopNavigation.addEventListener('change', handleNavigationBreakpoint);
  else desktopNavigation.addListener(handleNavigationBreakpoint);
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

  // Contact form: validate locally, then submit to the existing Formspree endpoint.
  const form = document.getElementById('contact-form');
  if (!form) return;

  const modal = document.getElementById('success-modal');
  const modalPanel = modal?.querySelector('.modal-panel');
  const submitButton = form.querySelector('.submit-button');
  const buttonLabel = submitButton?.querySelector('.button-label');
  const status = form.querySelector('.form-status');
  const controls = {
    companyWebsite: document.getElementById('company-website'),
    name: document.getElementById('name'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    contactMethod: document.getElementById('contact-method'),
    message: document.getElementById('message'),
    consent: document.getElementById('consent')
  };
  const defaultButtonLabel = buttonLabel?.textContent || '';
  const formAvailableAt = Date.now();
  const minimumCompletionTime = 2000;
  const cooldownDuration = 60 * 1000;
  const duplicateWindow = 10 * 60 * 1000;
  const storageKeys = {
    lastSuccess: 'santora-contact-last-success-v1',
    lastFingerprint: 'santora-contact-last-fingerprint-v1'
  };
  let isSubmitting = false;
  let lastFocused = null;

  const messages = {
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    phone: 'Please enter a valid phone number.',
    'contact-method': 'Please choose how you prefer to be contacted.',
    interest: 'Please select what you are interested in.',
    'session-type': 'Please select a session format.',
    message: 'Your message is too short.',
    consent: 'Please confirm that you understand the privacy notice.'
  };

  const getControl = key => {
    if (key === 'interest') return form.querySelector('input[name="interest"]');
    if (key === 'session-type') return form.querySelector('input[name="session_type"]');
    return document.getElementById(key);
  };

  const setError = (key, message = '') => {
    const error = document.getElementById(`${key}-error`);
    if (error) error.textContent = message;
    const control = getControl(key);
    control?.closest('.field')?.classList.toggle('has-error', Boolean(message));
    control?.closest('fieldset')?.classList.toggle('has-error', Boolean(message));
    if (control) control.setAttribute('aria-invalid', String(Boolean(message)));
  };

  const setStatus = (message = '', type = '') => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', type === 'error');
    status.classList.toggle('is-success', type === 'success');
  };

  const normalizeEmail = value => {
    const trimmed = value.trim();
    const atIndex = trimmed.lastIndexOf('@');
    if (atIndex < 1) return trimmed;
    return `${trimmed.slice(0, atIndex)}@${trimmed.slice(atIndex + 1).toLowerCase()}`;
  };

  const validName = value => {
    const trimmed = value.trim();
    const letters = trimmed.match(/\p{L}/gu) || [];
    return trimmed.length >= 2 && trimmed.length <= 80 && letters.length >= 2 && !/[\u0000-\u001f\u007f]/u.test(trimmed);
  };

  const validEmail = value => {
    const normalized = normalizeEmail(value);
    if (normalized.length > 254 || /\s|[\u0000-\u001f\u007f]/u.test(normalized)) return false;

    const parts = normalized.split('@');
    if (parts.length !== 2) return false;
    const [localPart, domain] = parts;
    if (!localPart || localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) return false;
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)) return false;
    if (!domain || domain.length > 253 || domain.includes('..')) return false;

    const domainLabels = domain.split('.');
    if (domainLabels.length < 2 || domainLabels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return false;
    const suffix = domainLabels.at(-1);
    if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(suffix)) return false;

    const placeholders = new Set(['example@example.com', 'email@email.com', 'abc@abc.com']);
    return !placeholders.has(normalized.toLowerCase());
  };

  const validPhone = value => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    const phonePattern = /^[+\d().\-\s]+(?:\s*(?:x|ext\.?|extension)\s*\d{1,6})?$/i;
    const digitCount = (trimmed.match(/\d/g) || []).length;
    return trimmed.length <= 30 && digitCount >= 7 && digitCount <= 20 && phonePattern.test(trimmed);
  };

  const validMessage = value => {
    const trimmed = value.trim();
    if (!trimmed) return true;
    if (trimmed.length < 10 || trimmed.length > 800) return false;

    const meaningfulCharacters = trimmed.match(/[\p{L}\p{N}]/gu) || [];
    if (meaningfulCharacters.length < 3) return false;
    const compactText = meaningfulCharacters.join('').toLocaleLowerCase();
    return compactText.length < 30 || new Set(Array.from(compactText)).size > 2;
  };

  const createSubmissionData = () => {
    const submissionData = new FormData(form);
    submissionData.set('name', controls.name.value.trim());
    submissionData.set('email', normalizeEmail(controls.email.value));
    submissionData.set('phone', controls.phone.value.trim());
    submissionData.set('message', controls.message.value.trim());
    submissionData.set('_subject', 'New Santora Therapy Website Contact');
    return submissionData;
  };

  const validate = () => {
    let firstInvalid = null;
    let valid = true;
    const name = controls.name;
    const email = controls.email;
    const phone = controls.phone;
    const method = controls.contactMethod;
    const interest = form.querySelector('input[name="interest"]:checked');
    const session = form.querySelector('input[name="session_type"]:checked');
    const message = controls.message;
    const consent = controls.consent;

    const allowedMethods = new Set(['Email', 'Phone']);
    const allowedInterests = new Set(['Individual therapy', 'Couples counseling', 'Consultation', 'Other']);
    const allowedSessionTypes = new Set(['In-person', 'Online', 'Either']);

    const checks = [
      { key: 'name', ok: validName(name.value), control: name },
      { key: 'email', ok: validEmail(email.value.trim()), control: email },
      { key: 'phone', ok: validPhone(phone.value), control: phone },
      { key: 'contact-method', ok: allowedMethods.has(method.value), control: method },
      { key: 'interest', ok: Boolean(interest && allowedInterests.has(interest.value)), control: form.querySelector('input[name="interest"]') },
      { key: 'session-type', ok: Boolean(session && allowedSessionTypes.has(session.value)), control: form.querySelector('input[name="session_type"]') },
      { key: 'message', ok: validMessage(message.value), control: message },
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

  ['name', 'email', 'phone', 'contact-method', 'message'].forEach(id => {
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

  const readStoredNumber = key => {
    try {
      const value = Number.parseInt(localStorage.getItem(key), 10);
      return Number.isFinite(value) ? value : 0;
    } catch (error) {
      return 0;
    }
  };

  const readStoredFingerprint = () => {
    try {
      const record = JSON.parse(localStorage.getItem(storageKeys.lastFingerprint) || 'null');
      if (!record || typeof record.hash !== 'string' || !Number.isFinite(record.timestamp)) return null;
      if (Date.now() - record.timestamp > duplicateWindow) {
        localStorage.removeItem(storageKeys.lastFingerprint);
        return null;
      }
      return record;
    } catch (error) {
      return null;
    }
  };

  const writeSuccessfulSubmission = hash => {
    try {
      const timestamp = Date.now();
      localStorage.setItem(storageKeys.lastSuccess, String(timestamp));
      if (hash) localStorage.setItem(storageKeys.lastFingerprint, JSON.stringify({ hash, timestamp }));
    } catch (error) {
      // Storage may be unavailable; delivery success should not be changed by that.
    }
  };

  // This browser-only cooldown is abuse friction, not secure server-side rate limiting; it can be bypassed.
  const getCooldownSeconds = () => {
    const elapsed = Date.now() - readStoredNumber(storageKeys.lastSuccess);
    if (elapsed >= cooldownDuration) return 0;
    return Math.max(1, Math.ceil((cooldownDuration - elapsed) / 1000));
  };

  const createFingerprint = async () => {
    if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') return '';
    const selectedInterest = form.querySelector('input[name="interest"]:checked')?.value || '';
    const selectedSession = form.querySelector('input[name="session_type"]:checked')?.value || '';
    const normalizedContent = JSON.stringify([
      controls.name.value.trim().toLocaleLowerCase(),
      normalizeEmail(controls.email.value).toLocaleLowerCase(),
      controls.phone.value.trim(),
      controls.contactMethod.value,
      selectedInterest,
      selectedSession,
      'New Santora Therapy Website Contact',
      controls.message.value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
    ]);
    const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedContent));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const setSubmitting = submitting => {
    isSubmitting = submitting;
    if (!submitButton) return;
    submitButton.disabled = submitting;
    submitButton.classList.toggle('loading', submitting);
    submitButton.setAttribute('aria-busy', String(submitting));
    if (buttonLabel) buttonLabel.textContent = submitting ? 'Sending...' : defaultButtonLabel;
  };

  const clearValidation = () => {
    Object.keys(messages).forEach(key => setError(key));
  };

  const resetContactForm = () => {
    form.reset();
    clearValidation();
  };

  const expiredSuccessTimestamp = readStoredNumber(storageKeys.lastSuccess);
  if (expiredSuccessTimestamp && Date.now() - expiredSuccessTimestamp >= cooldownDuration) {
    try { localStorage.removeItem(storageKeys.lastSuccess); } catch (error) { /* Storage can be unavailable. */ }
  }
  readStoredFingerprint();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (isSubmitting) return;

    if (controls.companyWebsite.value.trim()) return;

    const result = validate();
    if (!result.valid) {
      setStatus('Please review the highlighted fields.', 'error');
      result.firstInvalid?.focus();
      return;
    }

    const remainingSeconds = getCooldownSeconds();
    if (remainingSeconds) {
      setStatus(`Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before sending another message.`, 'error');
      return;
    }

    if (Date.now() - formAvailableAt < minimumCompletionTime) {
      setStatus('Something went wrong. Please try again.', 'error');
      return;
    }

    setStatus();
    setSubmitting(true);

    try {
      const fingerprint = await createFingerprint();
      const previousSubmission = readStoredFingerprint();
      if (fingerprint && previousSubmission?.hash === fingerprint) {
        setStatus('This message was already sent. Please wait before sending it again.', 'error');
        return;
      }

      const response = await fetch(form.action, {
        method: 'POST',
        body: createSubmissionData(),
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Contact submission failed');

      writeSuccessfulSubmission(fingerprint);
      resetContactForm();
      setStatus("Message sent. I'll get back to you soon.", 'success');
    } catch (error) {
      setStatus('Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  });
})();
