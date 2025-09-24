// main.js — Navbar resize + Position indicator + Carousel (robust) + Modal (accessible)
// Assumes CSS vars: --header-h, --header-h-large, --header-h-compact
(() => {
  // =========================
  // Selectors / classnames / CSS vars
  // =========================
  const SEL = {
    header: '.site-header',
    sections: 'main .stripe[id]',
    navLinks: '.site-nav a[href^="#"]',

    // Carousel
    carousels: '.carousel',
    caroTrack: '.caro-track',
    caroSlide: '.caro-slide',
    caroPrev:  '.caro-prev',
    caroNext:  '.caro-next',
    caroViewport: '.caro-viewport',

    // Modal
    modalOpen:  '.open-modal[data-modal-target]',
    modalClose: '[data-modal-close]',
    modal:      '.modal'
  };
  const CLASS = {
    active: 'is-active',
    compact: 'is-compact',
    modalOpenBody: 'modal-open'
  };
  const VAR = {
    headerH: '--header-h',
    headerHLarge: '--header-h-large',
    headerHCompact: '--header-h-compact'
  };
  const $docEl = document.documentElement;

  const getCssPx = (varName, fallback) => {
    const raw = getComputedStyle($docEl).getPropertyValue(varName).trim();
    if (raw && raw.endsWith('px')) {
      const n = parseFloat(raw);
      if (!Number.isNaN(n) && n > 0) return n;
    }
    return fallback;
  };
  const setCssPx = (varName, valuePx) => $docEl.style.setProperty(varName, `${valuePx}px`);

  // =========================
  // Navbar resize + position indicator
  // =========================
  const header   = document.querySelector(SEL.header);
  const sections = Array.from(document.querySelectorAll(SEL.sections));
  const navLinks = Array.from(document.querySelectorAll(SEL.navLinks));

  const setActive = (id) => {
    const href = `#${id}`;
    navLinks.forEach(a => a.classList.toggle(CLASS.active, a.getAttribute('href') === href));
  };

  const syncHeaderState = () => {
    if (!header) return;
    const shouldCompact = window.scrollY > 0;
    header.classList.toggle(CLASS.compact, shouldCompact);

    const large   = getCssPx(VAR.headerHLarge, 88);
    const compact = getCssPx(VAR.headerHCompact, 56);
    const finalH  = shouldCompact ? compact : large;

    // Keep layout in sync (body padding, scroll-margin-top in CSS use this var)
    setCssPx(VAR.headerH, finalH);
  };

  const updateActiveLink = () => {
    if (!header || sections.length === 0 || navLinks.length === 0) return;

    const headerH = getCssPx(VAR.headerH, header.offsetHeight || 64);
    const doc = document.documentElement;

    // If truly at bottom, force the last nav item active
    const atBottom = window.innerHeight + window.scrollY >= (doc.scrollHeight - 2);
    if (atBottom) {
      setActive(sections[sections.length - 1].id);
      return;
    }

    // Probe line: 1px below the bottom of the fixed header
    const probeY = headerH + 1;

    // Section crossing the probe line
    let current = sections.find(sec => {
      const r = sec.getBoundingClientRect();
      return r.top <= probeY && r.bottom > probeY;
    });

    // Fallback: last section whose top is above the probe line
    if (!current) {
      let lastId = sections[0].id;
      for (const sec of sections) {
        if (sec.getBoundingClientRect().top <= probeY) lastId = sec.id;
      }
      current = { id: lastId };
    }
    setActive(current.id);
  };

  // Throttle scroll/resize via rAF
  let ticking = false;
  const onScrollOrResize = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      syncHeaderState();
      updateActiveLink();
      ticking = false;
    });
  };

  // Init nav modules
  onScrollOrResize();
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize);

  // Immediate visual feedback on nav clicks (CSS handles smooth scrolling)
  navLinks.forEach(a => {
    a.addEventListener('click', () => {
      const id = a.getAttribute('href').slice(1);
      if (id) setActive(id);
    });
  });

  // =========================
  // Carousel (robust width handling)
  // =========================
  (() => {
    const carousels = Array.from(document.querySelectorAll(SEL.carousels));
    carousels.forEach(root => {
      const track    = root.querySelector(SEL.caroTrack);
      const slides   = Array.from(root.querySelectorAll(SEL.caroSlide));
      const prevBtn  = root.querySelector(SEL.caroPrev);
      const nextBtn  = root.querySelector(SEL.caroNext);
      const viewport = root.querySelector(SEL.caroViewport);

      // Enforce assignment requirement: at least 3 slides
      if (!track || !viewport || slides.length < 3) return;

      let idx = 0;
      let slideW = 0;

      const currentViewportWidth = () => {
        // More reliable than clientWidth in some flex contexts
        const w = viewport.getBoundingClientRect().width;
        return w > 0 ? w : (viewport.clientWidth || root.getBoundingClientRect().width || 0);
      };

      const measure = () => {
        const w = currentViewportWidth();
        if (w === 0) return; // don't update until we have a real width
        slideW = w;
        track.style.transform = `translateX(${-idx * slideW}px)`;
      };

      const goTo = (n) => {
        if (slideW === 0) { measure(); }
        if (slideW === 0) return;
        idx = (n + slides.length) % slides.length; // wrap
        track.style.transform = `translateX(${-idx * slideW}px)`;
      };

      const next = () => goTo(idx + 1);
      const prev = () => goTo(idx - 1);

      // Buttons
      nextBtn && nextBtn.addEventListener('click', next);
      prevBtn && prevBtn.addEventListener('click', prev);

      // Keyboard support (when viewport focused)
      viewport.setAttribute('tabindex', viewport.getAttribute('tabindex') || '0');
      viewport.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
      });

      // Recalculate on any size change of the viewport (fonts, layout, resize)
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(() => measure());
        ro.observe(viewport);
      } else {
        let resizing = false;
        const onResize = () => {
          if (resizing) return;
          resizing = true;
          requestAnimationFrame(() => { measure(); resizing = false; });
        };
        window.addEventListener('resize', onResize);
      }

      // Re-measure after images load (if they affect sizing)
      const imgs = Array.from(root.querySelectorAll('img'));
      let pending = imgs.length;
      if (pending) {
        imgs.forEach(img => {
          if (img.complete) { if (--pending === 0) measure(); }
          else {
            img.addEventListener('load',  () => { if (--pending === 0) measure(); }, { once: true });
            img.addEventListener('error', () => { if (--pending === 0) measure(); }, { once: true });
          }
        });
      }

      // Initial measure
      measure();
    });
  })();

  // =========================
  // Modal (accessible)
  // =========================
  (() => {
    const openers = Array.from(document.querySelectorAll(SEL.modalOpen));
    if (openers.length === 0) return;

    let lastActiveOpener = null;

    const getFocusable = (root) =>
      Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));

    const openModal = (modal) => {
      if (!modal) return;
      lastActiveOpener = document.activeElement;

      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add(CLASS.modalOpenBody);

      const focusables = getFocusable(modal);
      (focusables[0] || modal).focus();

      const trap = (e) => {
        if (e.key !== 'Tab') return;
        const list = getFocusable(modal);
        if (list.length === 0) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      modal._trapHandler = trap;
      modal.addEventListener('keydown', trap);
    };

    const closeModal = (modal) => {
      if (!modal) return;
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove(CLASS.modalOpenBody);
      modal.removeEventListener('keydown', modal._trapHandler || (() => {}));
      modal._trapHandler = null;

      if (lastActiveOpener && document.body.contains(lastActiveOpener)) {
        lastActiveOpener.focus();
      }
    };

    // Wire openers
    openers.forEach(btn => {
      btn.addEventListener('click', () => {
        const sel = btn.getAttribute('data-modal-target');
        const modal = document.querySelector(sel);
        if (modal) openModal(modal);
      });
    });

    // Click to close via buttons or backdrop
    document.addEventListener('click', (e) => {
      const m = e.target.closest(SEL.modal);
      if (!m) return;
      if (e.target.matches(SEL.modalClose) || e.target.matches('.modal__backdrop')) {
        closeModal(m);
      }
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openModalEl = document.querySelector('.modal[aria-hidden="false"]');
      if (openModalEl) closeModal(openModalEl);
    });
  })();
})();
