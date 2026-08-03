/* AutoBüro · Geld als integrierte Seite
 * Reine Darstellungs-/Navigationsschicht.
 * Keine Änderungen an Kunden-, Fahrzeug-, Rechnungs-, Firmen- oder Zahlungsdaten.
 */
(() => {
  'use strict';

  const INTEGRATION_ID = 'autoburo-money-page-integration';
  const MONEY_HOST_ID = 'autoburo-money-unified';
  const PAGE_ID = 'autoburo-geld-page-shell';
  const NAV_ID = 'autoburo-geld-nav';
  const STYLE_ID = 'autoburo-geld-page-style';
  const SHADOW_STYLE_ID = 'autoburo-geld-inline-shadow-style';

  if (globalThis.__AUTOBURO_MONEY_PAGE_INTEGRATION__) return;
  globalThis.__AUTOBURO_MONEY_PAGE_INTEGRATION__ = true;

  let lastBodyOverflow = '';
  let pageOpen = false;
  let navObserver = null;
  let resizeTimer = null;

  const normalizeText = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE');

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  const findControlByText = (label) => {
    const wanted = normalizeText(label);
    const controls = [...document.querySelectorAll('button, a, [role="button"]')];
    return controls.find((control) => {
      if (control.id === NAV_ID || control.closest(`#${PAGE_ID}`)) return false;
      const text = normalizeText(control.textContent);
      return isVisible(control) && (text === wanted || text.endsWith(` ${wanted}`));
    }) || null;
  };

  const findNavigationContext = () => {
    const anchor = findControlByText('Ausgaben')
      || findControlByText('Einnahmen')
      || findControlByText('Kasse')
      || findControlByText('Start');
    if (!anchor) return null;

    const nav = anchor.closest('nav') || anchor.parentElement;
    let header = anchor.closest('header');
    if (!header) {
      let current = nav;
      while (current && current !== document.body) {
        const rect = current.getBoundingClientRect();
        if (rect.top <= 220 && rect.height >= 44 && rect.height <= 180) header = current;
        current = current.parentElement;
      }
    }
    return { anchor, nav, header: header || nav };
  };

  const ensureDocumentStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PAGE_ID}{
        position:fixed;
        left:0;
        right:0;
        bottom:0;
        z-index:1200;
        display:none;
        overflow:auto;
        overscroll-behavior:contain;
        background:#f4f6f8;
        padding:36px clamp(18px,4vw,70px) 64px;
      }
      #${PAGE_ID}[data-open="true"]{display:block}
      #${PAGE_ID} > #${MONEY_HOST_ID}{display:block;width:min(1180px,100%);margin:0 auto}
      #${NAV_ID}{white-space:nowrap}
      #${NAV_ID}[aria-current="page"]{
        background:#101b31!important;
        color:#fff!important;
        border-color:#101b31!important;
        border-radius:999px!important;
      }
      #${NAV_ID} .autoburo-geld-nav-icon{font-weight:900;color:#caa84c;margin-right:7px}
      @media(max-width:760px){
        #${PAGE_ID}{padding:22px 14px 44px}
      }
    `;
    document.head.appendChild(style);
  };

  const ensurePageShell = () => {
    let shell = document.getElementById(PAGE_ID);
    if (shell) return shell;
    shell = document.createElement('section');
    shell.id = PAGE_ID;
    shell.dataset.open = 'false';
    shell.setAttribute('aria-label', 'Geld');
    shell.setAttribute('aria-hidden', 'true');
    document.body.appendChild(shell);
    return shell;
  };

  const adaptMoneyShadow = (host) => {
    const root = host?.shadowRoot;
    if (!root) return false;

    if (!root.getElementById(SHADOW_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = SHADOW_STYLE_ID;
      style.textContent = `
        :host{display:block!important;width:100%!important}
        .fab{display:none!important}
        .overlay{
          position:static!important;
          inset:auto!important;
          z-index:auto!important;
          display:none!important;
          align-items:stretch!important;
          justify-content:stretch!important;
          padding:0!important;
          background:transparent!important;
          backdrop-filter:none!important;
        }
        .overlay.open{display:block!important}
        .panel{
          width:100%!important;
          max-height:none!important;
          overflow:visible!important;
          background:transparent!important;
          border-radius:0!important;
          box-shadow:none!important;
        }
        .head{
          position:static!important;
          padding:0 2px 22px!important;
          background:transparent!important;
          backdrop-filter:none!important;
          border-bottom:0!important;
        }
        .head h2{font-size:38px!important}
        .close{display:none!important}
        .body{padding:0!important}
        .toast{position:fixed!important}
        @media(max-width:720px){
          .overlay{padding:0!important;align-items:stretch!important}
          .panel{width:100%!important;max-height:none!important;border-radius:0!important}
          .head{padding:0 2px 18px!important}
          .head h2{font-size:31px!important}
          .body{padding:0!important}
        }
      `;
      root.appendChild(style);
    }

    const overlay = root.querySelector('.overlay');
    if (overlay && !overlay.dataset.inlineGuard) {
      overlay.dataset.inlineGuard = 'true';
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) event.stopImmediatePropagation();
      }, true);
    }
    return true;
  };

  const clearNativeActiveState = () => {
    const context = findNavigationContext();
    const nav = context?.nav;
    if (!nav) return;
    [...nav.querySelectorAll('button, a, [role="button"]')].forEach((item) => {
      if (item.id === NAV_ID) return;
      item.removeAttribute('aria-current');
      item.classList.remove('active', 'is-active', 'selected');
    });
  };

  const refreshTopOffset = () => {
    const shell = document.getElementById(PAGE_ID);
    if (!shell) return;
    const context = findNavigationContext();
    const rect = context?.header?.getBoundingClientRect();
    const top = rect && rect.bottom > 0 && rect.bottom < innerHeight * 0.45
      ? Math.round(rect.bottom)
      : 72;
    shell.style.top = `${top}px`;
  };

  const renderCurrentMoney = (host) => {
    const root = host.shadowRoot;
    const overlay = root?.querySelector('.overlay');
    const fab = root?.querySelector('.fab');
    if (!overlay || !fab) return false;

    if (!overlay.classList.contains('open')) {
      lastBodyOverflow = document.body.style.overflow;
      fab.click();
    }
    document.body.style.overflow = lastBodyOverflow;
    overlay.classList.add('open');
    return true;
  };

  const openPage = () => {
    const host = document.getElementById(MONEY_HOST_ID);
    if (!host || !host.shadowRoot) return false;

    ensureDocumentStyle();
    const shell = ensurePageShell();
    adaptMoneyShadow(host);
    if (host.parentElement !== shell) shell.appendChild(host);
    if (!renderCurrentMoney(host)) return false;

    pageOpen = true;
    shell.dataset.open = 'true';
    shell.setAttribute('aria-hidden', 'false');
    clearNativeActiveState();
    const navButton = document.getElementById(NAV_ID);
    navButton?.setAttribute('aria-current', 'page');
    refreshTopOffset();
    shell.scrollTop = 0;
    window.dispatchEvent(new CustomEvent('autoburo:geld-page-opened'));
    return true;
  };

  const closePage = () => {
    const shell = document.getElementById(PAGE_ID);
    if (!shell || !pageOpen) return;
    pageOpen = false;
    shell.dataset.open = 'false';
    shell.setAttribute('aria-hidden', 'true');
    document.getElementById(NAV_ID)?.removeAttribute('aria-current');
    document.body.style.overflow = lastBodyOverflow;
    window.dispatchEvent(new CustomEvent('autoburo:geld-page-closed'));
  };

  const ensureNavButton = () => {
    if (document.getElementById(NAV_ID)) return true;
    const context = findNavigationContext();
    if (!context?.nav || !context.anchor) return false;

    const reference = findControlByText('Ausgaben') || context.anchor;
    const button = document.createElement('button');
    button.id = NAV_ID;
    button.type = 'button';
    button.className = reference.className || '';
    button.innerHTML = '<span class="autoburo-geld-nav-icon" aria-hidden="true">€</span><span>Geld</span>';
    button.setAttribute('aria-label', 'Geld');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPage();
    });

    reference.insertAdjacentElement('afterend', button);
    refreshTopOffset();
    return true;
  };

  const interceptExistingOpeners = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest(`#${NAV_ID}`)) return;

    const dashboardCard = target.closest('#autoburo-money-today');
    const moneyHost = target.closest(`#${MONEY_HOST_ID}`);
    if (dashboardCard && !moneyHost) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPage();
      return;
    }

    const control = target.closest('button, a, [role="button"]');
    if (!control || control.closest(`#${PAGE_ID}`)) return;
    const text = normalizeText(control.textContent);
    if (text === 'geld' || text.endsWith(' geld')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPage();
      return;
    }

    if (pageOpen) closePage();
  };

  const setup = () => {
    ensureDocumentStyle();
    ensurePageShell();
    ensureNavButton();

    const host = document.getElementById(MONEY_HOST_ID);
    if (host?.shadowRoot) adaptMoneyShadow(host);

    if (!navObserver) {
      navObserver = new MutationObserver(() => {
        ensureNavButton();
        const currentHost = document.getElementById(MONEY_HOST_ID);
        if (currentHost?.shadowRoot) adaptMoneyShadow(currentHost);
        if (pageOpen && currentHost && currentHost.parentElement !== document.getElementById(PAGE_ID)) {
          document.getElementById(PAGE_ID)?.appendChild(currentHost);
        }
      });
      navObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  };

  document.addEventListener('click', interceptExistingOpeners, true);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshTopOffset, 80);
  }, { passive: true });
  window.addEventListener('popstate', closePage);
  window.addEventListener('hashchange', closePage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  let attempts = 0;
  const bootTimer = setInterval(() => {
    attempts += 1;
    setup();
    if ((document.getElementById(MONEY_HOST_ID)?.shadowRoot && document.getElementById(NAV_ID)) || attempts >= 80) {
      clearInterval(bootTimer);
    }
  }, 125);
})();
