/* FitFoxx Athletics — theme.js (no dependencies) */
(() => {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const theme = window.FoxxTheme || { routes: {}, strings: {} };
  const isDesktop = () => window.matchMedia('(min-width: 990px)').matches;

  /* ---------- Reveal on scroll ---------- */
  const initReveal = (root = document) => {
    const items = $$('.reveal:not(.is-visible)', root);
    if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    items.forEach((el) => io.observe(el));
  };

  /* ---------- Announcement rotator ---------- */
  const initAnnouncement = () => {
    $$('[data-announcement]').forEach((bar) => {
      const slides = $$('[data-announcement-slide]', bar);
      if (slides.length < 2) return;
      let i = 0;
      const ms = (parseInt(bar.dataset.interval, 10) || 5) * 1000;
      let timer = setInterval(next, ms);
      function next() {
        slides[i].classList.remove('is-active');
        i = (i + 1) % slides.length;
        slides[i].classList.add('is-active');
      }
      bar.addEventListener('mouseenter', () => clearInterval(timer));
      bar.addEventListener('mouseleave', () => { clearInterval(timer); timer = setInterval(next, ms); });
    });
  };

  /* ---------- Header: scroll state, mobile menu, search ---------- */
  const initHeader = () => {
    const header = $('[data-header]');
    if (!header) return;
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const menu = $('[data-mobile-menu]');
    const openBtn = $('[data-menu-open]');
    const setMenu = (open) => {
      if (!menu) return;
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      openBtn && openBtn.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('is-locked', open);
      if (open) { const f = $('input, a, button', menu.querySelector('.mobile-menu__panel')); f && f.focus({ preventScroll: true }); }
      else openBtn && openBtn.focus({ preventScroll: true });
    };
    openBtn && openBtn.addEventListener('click', () => setMenu(true));
    $$('[data-menu-close]', menu || document).forEach((b) => b.addEventListener('click', () => setMenu(false)));

    const panel = $('[data-search-panel]');
    const searchOpen = $('[data-search-open]');
    const input = panel && $('[data-predictive-input]', panel);
    const setSearch = (open) => {
      if (!panel) return;
      panel.hidden = !open;
      searchOpen && searchOpen.setAttribute('aria-expanded', String(open));
      if (open) setTimeout(() => input && input.focus(), 30);
    };
    searchOpen && searchOpen.addEventListener('click', (e) => { e.preventDefault(); setSearch(panel.hidden); });
    $$('[data-search-close]').forEach((b) => b.addEventListener('click', () => setSearch(false)));

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (menu && menu.classList.contains('is-open')) setMenu(false);
      if (panel && !panel.hidden) setSearch(false);
      const nav = document.activeElement && document.activeElement.closest('.nav__item');
      if (nav) document.activeElement.blur();
    });

    if (input) initPredictive(input, $('[data-predictive-results]', panel));
  };

  /* ---------- Predictive search (Shopify Ajax API) ---------- */
  const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initPredictive = (input, results) => {
    if (!results || !theme.routes.predictiveSearch) return;
    let t; let ctrl;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      t = setTimeout(async () => {
        if (ctrl) ctrl.abort();
        ctrl = new AbortController();
        try {
          const url = `${theme.routes.predictiveSearch}.json?q=${encodeURIComponent(q)}&resources[type]=product&resources[limit]=6&resources[options][unavailable_products]=last`;
          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok) throw new Error(res.status);
          const data = await res.json();
          const products = (data.resources && data.resources.results && data.resources.results.products) || [];
          const allUrl = `${theme.routes.search}?q=${encodeURIComponent(q)}&options[prefix]=last`;
          if (!products.length) {
            results.innerHTML = `<p class="predictive__empty">${escapeHtml(theme.strings.noResults)}</p>`;
            return;
          }
          const items = products.map((p) => {
            const img = p.featured_image && p.featured_image.url
              ? `<img class="predictive__img" src="${escapeHtml(p.featured_image.url)}${p.featured_image.url.includes('?') ? '&' : '?'}width=160" alt="" loading="lazy" width="64" height="80">`
              : '<span class="predictive__img"></span>';
            return `<li><a class="predictive__item" href="${escapeHtml(p.url)}">${img}<span><span class="predictive__title">${escapeHtml(p.title)}</span><span class="predictive__price">${escapeHtml(p.price ? formatPrice(p.price) : '')}</span></span></a></li>`;
          }).join('');
          results.innerHTML = `<ul class="predictive__list" role="list">${items}</ul><a class="link-arrow predictive__all" href="${escapeHtml(allUrl)}">${escapeHtml(theme.strings.viewAll)} &rarr;</a>`;
        } catch (err) {
          if (err.name !== 'AbortError') results.innerHTML = '';
        }
      }, 220);
    });
  };
  // Predictive API returns price as a decimal string in the shop currency.
  const formatPrice = (price) => {
    try {
      const currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
      return new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency }).format(Number(price));
    } catch (e) { return price; }
  };

  /* ---------- Quantity steppers ---------- */
  const initQty = (root = document) => {
    $$('[data-qty]', root).forEach((wrap) => {
      const input = $('input', wrap);
      const min = parseInt(input.min, 10) || 0;
      const step = (d) => {
        const v = Math.max(min, (parseInt(input.value, 10) || 0) + d);
        input.value = v;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };
      $('[data-qty-minus]', wrap).addEventListener('click', () => step(-1));
      $('[data-qty-plus]', wrap).addEventListener('click', () => step(1));
    });
  };

  /* ---------- Product page ---------- */
  const initProduct = (section) => {
    const picker = $('[data-variant-picker]', section);
    const form = $('[data-product-form]', section);
    const idInput = form && $('[data-variant-id]', form);
    const addBtn = form && $('[data-add-button]', form);
    const sticky = $('[data-sticky-atc]', section);
    const stickyBtn = sticky && $('[data-sticky-button]', sticky);
    const gallery = $('[data-gallery]', section);
    const errorBox = form && $('[data-form-error]', form);

    const setButtons = (variant) => {
      const label = !variant ? theme.strings.unavailable : variant.available ? theme.strings.addToCart : theme.strings.soldOut;
      [addBtn, stickyBtn].forEach((btn) => {
        if (!btn) return;
        btn.disabled = !variant || !variant.available;
        const l = $('[data-add-label]', btn); if (l) l.textContent = label;
      });
    };

    if (picker) {
      const jsonEl = $('[data-variants-json]', picker);
      const variants = jsonEl ? JSON.parse(jsonEl.textContent) : [];
      const fieldsets = $$('fieldset[data-option-index]', picker);
      const selected = () => fieldsets.map((fs) => { const c = $('input:checked', fs); return c ? c.value : null; });

      const updateAvailability = (sel) => {
        fieldsets.forEach((fs, idx) => {
          $$('input', fs).forEach((inp) => {
            const label = inp.nextElementSibling;
            const ok = variants.some((v) => v.available && v.options[idx] === inp.value && v.options.every((o, j) => j === idx || o === sel[j]));
            label && label.classList.toggle('is-unavailable', !ok);
          });
        });
      };

      const onChange = () => {
        const sel = selected();
        fieldsets.forEach((fs, idx) => { const s = $('[data-option-selected]', fs); if (s) s.textContent = sel[idx] || ''; });
        const variant = variants.find((v) => v.options.every((o, j) => o === sel[j]));
        updateAvailability(sel);
        setButtons(variant);
        if (errorBox) errorBox.hidden = true;
        if (!variant) return;
        idInput.value = variant.id;
        $$('[data-price]', section).forEach((el) => { el.textContent = variant.price; });
        $$('[data-compare-price]', section).forEach((el) => { el.textContent = variant.compare || ''; el.hidden = !variant.compare; });
        $$('[data-price-wrapper]', section).forEach((el) => el.classList.toggle('price--sale', !!variant.compare));
        if (sticky) {
          const sp = $('[data-sticky-price]', sticky); if (sp) sp.textContent = variant.price;
          const sv = $('[data-sticky-variant]', sticky); if (sv) sv.textContent = variant.options.join(' / ');
        }
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
        if (variant.media && gallery) {
          const item = $(`[data-media-id="${variant.media}"]`, gallery);
          if (item) {
            if (isDesktop()) { gallery.prepend(item); }
            else { gallery.scrollTo({ left: item.offsetLeft - gallery.offsetLeft, behavior: 'smooth' }); }
          }
        }
      };
      picker.addEventListener('change', onChange);
      updateAvailability(selected());
    }

    // Ajax add to cart, then go to the cart page (falls back to native POST without JS).
    if (form) {
      form.addEventListener('submit', async (e) => {
        if (!window.fetch) return;
        e.preventDefault();
        const btns = [addBtn, stickyBtn].filter(Boolean);
        btns.forEach((b) => { b.disabled = true; b.setAttribute('aria-busy', 'true'); const l = $('[data-add-label]', b); if (l) l.textContent = theme.strings.adding; });
        try {
          const res = await fetch(`${theme.routes.cartAdd}.js`, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: new FormData(form)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.description || data.message || 'Error');
          window.location.href = theme.routes.cart;
        } catch (err) {
          if (errorBox) { errorBox.textContent = err.message; errorBox.hidden = false; }
          btns.forEach((b) => { b.disabled = false; b.removeAttribute('aria-busy'); const l = $('[data-add-label]', b); if (l) l.textContent = theme.strings.addToCart; });
        }
      });
    }

    // Mobile gallery counter
    const counter = $('[data-gallery-current]', section);
    if (gallery && counter) {
      gallery.addEventListener('scroll', () => {
        const idx = Math.round(gallery.scrollLeft / gallery.clientWidth);
        counter.textContent = String(Math.min(idx + 1, gallery.children.length));
      }, { passive: true });
    }

    // Sticky add to cart: visible once the main button scrolls out of view
    if (sticky && addBtn && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sticky.classList.toggle('is-visible', show);
        sticky.setAttribute('aria-hidden', String(!show));
        if (stickyBtn) stickyBtn.tabIndex = show ? 0 : -1;
      });
      io.observe(addBtn);
    }

    // Size guide dialog
    const dialog = $('[data-size-guide]', section);
    if (dialog && typeof dialog.showModal === 'function') {
      $$('[data-size-guide-open]', section).forEach((b) => b.addEventListener('click', () => dialog.showModal()));
      $$('[data-modal-close]', dialog).forEach((b) => b.addEventListener('click', () => dialog.close()));
      dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    } else {
      $$('[data-size-guide-open]', section).forEach((b) => { b.hidden = true; });
    }
  };

  /* ---------- Product recommendations ---------- */
  const initRecommendations = () => {
    $$('[data-recommendations]').forEach(async (el) => {
      if (el.querySelector('.product-grid')) return;
      try {
        const res = await fetch(el.dataset.url);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const fresh = doc.querySelector('[data-recommendations]');
        if (fresh && fresh.innerHTML.trim()) { el.innerHTML = fresh.innerHTML; initReveal(el); }
      } catch (e) { /* recommendations are optional */ }
    });
  };

  /* ---------- Collection filters & sorting ---------- */
  const submitFacets = (form) => {
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => { if (String(v).trim() !== '') params.append(k, v); });
    const qs = params.toString();
    window.location.href = form.getAttribute('action') + (qs ? `?${qs}` : '');
  };
  const initFacets = () => {
    $$('[data-sort-select]').forEach((select) => {
      select.addEventListener('change', () => {
        const form = document.getElementById(select.dataset.form);
        if (!form) return;
        let hidden = form.querySelector('input[name="sort_by"]');
        if (!hidden) { hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'sort_by'; form.appendChild(hidden); }
        hidden.value = select.value;
        submitFacets(form);
      });
    });
    $$('[data-facets-form]').forEach((form) => {
      let t;
      form.addEventListener('change', (e) => {
        if (!isDesktop()) return;
        clearTimeout(t);
        t = setTimeout(() => submitFacets(form), e.target.matches('[data-price-input]') ? 700 : 80);
      });
      form.addEventListener('submit', (e) => { e.preventDefault(); submitFacets(form); });
    });
    const drawer = $('[data-facets-drawer]');
    if (!drawer) return;
    const set = (open) => { drawer.classList.toggle('is-open', open); document.body.classList.toggle('is-locked', open); };
    $$('[data-facets-open]').forEach((b) => b.addEventListener('click', () => set(true)));
    $$('[data-facets-close]', drawer).forEach((b) => b.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) set(false); });
  };

  /* ---------- Cart page ---------- */
  const initCart = () => {
    const form = $('[data-cart-form]');
    if (!form) return;
    let t;
    form.addEventListener('change', (e) => {
      if (!e.target.matches('[data-cart-qty]')) return;
      clearTimeout(t);
      t = setTimeout(() => {
        form.classList.add('is-updating');
        const updateBtn = $('[data-cart-update]', form);
        if (form.requestSubmit && updateBtn) form.requestSubmit(updateBtn); else updateBtn ? updateBtn.click() : form.submit();
      }, 500);
    });
  };

  /* ---------- Copy promo code ---------- */
  const initCopy = () => {
    $$('[data-copy]').forEach((btn) => {
      if (!navigator.clipboard) { btn.hidden = true; return; }
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          const label = $('[data-copy-label]', btn);
          const prev = label ? label.textContent : '';
          btn.classList.add('is-copied');
          if (label) label.textContent = theme.strings.copied;
          setTimeout(() => { btn.classList.remove('is-copied'); if (label) label.textContent = prev; }, 1800);
        } catch (e) { /* clipboard blocked */ }
      });
    });
  };

  /* ---------- Customer pages ---------- */
  const initCustomer = () => {
    const recover = $('[data-recover-panel]');
    const login = $('[data-login-panel]');
    if (recover && login) {
      const show = (r) => { recover.hidden = !r; login.hidden = r; };
      if (window.location.hash === '#recover') show(true);
      $$('[data-recover-toggle]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); show(recover.hidden); }));
    }
    $$('select[data-default]').forEach((s) => { if (s.dataset.default) s.value = s.dataset.default; });
    $$('form[data-confirm]').forEach((f) => f.addEventListener('submit', (e) => { if (!window.confirm(f.dataset.confirm)) e.preventDefault(); }));
  };

  /* ---------- Boot ---------- */
  const boot = () => {
    document.documentElement.classList.add('foxx-ready');
    initReveal();
    initAnnouncement();
    initHeader();
    initQty();
    $$('[data-product-section]').forEach(initProduct);
    initRecommendations();
    initFacets();
    initCart();
    initCopy();
    initCustomer();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Theme editor support
  document.addEventListener('shopify:section:load', (e) => {
    initReveal(e.target);
    initQty(e.target);
    $$('[data-product-section]', e.target).forEach(initProduct);
    if (e.target.querySelector('[data-announcement]')) initAnnouncement();
    if (e.target.querySelector('[data-header]')) initHeader();
    if (e.target.querySelector('[data-recommendations]')) initRecommendations();
    if (e.target.querySelector('[data-copy]')) initCopy();
  });
})();
