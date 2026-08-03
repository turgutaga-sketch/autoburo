/* AutoBüro · Geld ↔ Einnahmen/Ausgaben ↔ Dashboard Synchronisation
 * Read-only observer: S.incomes and S.expenses remain the single source of truth.
 * No customer, vehicle, invoice, company, setting or document data is changed.
 */
(() => {
  'use strict';

  const API_KEY = '__AUTOBURO_MONEY_NATIVE_SYNC__';
  const EVENT_NAME = 'autoburo:money-data-changed';
  const POLL_MS = 250;

  if (globalThis[API_KEY]) return;

  let lastSignature = '';
  let scheduled = false;
  let initialized = false;
  let observer = null;

  const getState = () => {
    try {
      if (typeof S === 'undefined' || !S || typeof S !== 'object') return null;
      if (!Array.isArray(S.incomes) || !Array.isArray(S.expenses)) return null;
      return S;
    } catch {
      return null;
    }
  };

  const recordSignature = (entry, index) => [
    String(entry?.id ?? `index:${index}`),
    Number(entry?.amount) || 0,
    String(entry?.method ?? ''),
    String(entry?.date ?? ''),
    String(entry?.desc ?? entry?.note ?? ''),
    String(entry?.createdAt ?? ''),
    String(entry?.source ?? ''),
    String(entry?.sourceId ?? ''),
  ];

  const buildSignature = () => {
    const state = getState();
    if (!state) return '';
    return JSON.stringify([
      state.incomes.map(recordSignature),
      state.expenses.map(recordSignature),
    ]);
  };

  const resolveGlobalFunction = (name) => {
    try {
      const direct = globalThis[name];
      if (typeof direct === 'function') return direct;
    } catch {
      // Continue with a global lexical lookup below.
    }

    try {
      const candidate = (0, eval)(`typeof ${name} === 'function' ? ${name} : null`);
      return typeof candidate === 'function' ? candidate : null;
    } catch {
      return null;
    }
  };

  const callFunction = (fn) => {
    if (typeof fn !== 'function' || fn.length > 0) return false;
    try {
      fn();
      return true;
    } catch (error) {
      console.warn('AutoBüro Geld-Sync: Ansicht konnte nicht aktualisiert werden.', error);
      return false;
    }
  };

  const refreshMoneyView = () => {
    try {
      const host = document.getElementById('autoburo-money-unified');
      return callFunction(host?.refreshMoney);
    } catch {
      return false;
    }
  };

  const refreshNativeView = () => {
    // Prefer one central renderer. These calls only redraw the interface;
    // they never write to S.incomes or S.expenses.
    const centralCandidates = [
      'renderCurrentPage',
      'renderApp',
      'renderAll',
      'render',
    ];

    for (const name of centralCandidates) {
      if (callFunction(resolveGlobalFunction(name))) return true;
    }

    // Fallback for applications exposing separate zero-argument renderers.
    const specificCandidates = [
      'renderDashboard',
      'updateDashboard',
      'refreshDashboard',
      'renderHome',
      'renderIncomes',
      'renderExpenses',
    ];
    const called = new Set();
    let refreshed = false;

    specificCandidates.forEach((name) => {
      const fn = resolveGlobalFunction(name);
      if (!fn || called.has(fn)) return;
      called.add(fn);
      refreshed = callFunction(fn) || refreshed;
    });

    return refreshed;
  };

  const announceChange = (reason) => {
    const detail = Object.freeze({
      origin: 'money-native-sync',
      reason,
      timestamp: new Date().toISOString(),
    });

    try {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    } catch {
      // Older WebViews may not support CustomEvent construction.
    }

    try {
      document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    } catch {
      // The direct refresh calls above still keep both views synchronized.
    }
  };

  const synchronize = (reason = 'check', force = false) => {
    scheduled = false;
    const signature = buildSignature();
    if (!signature) return false;

    if (!initialized) {
      initialized = true;
      lastSignature = signature;
      if (!force) return false;
    } else if (!force && signature === lastSignature) {
      return false;
    }

    lastSignature = signature;
    refreshMoneyView();
    refreshNativeView();
    announceChange(reason);
    return true;
  };

  const scheduleSynchronize = (reason = 'scheduled', force = false) => {
    if (scheduled && !force) return;
    scheduled = true;
    const run = () => synchronize(reason, force);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  };

  const startObserver = () => {
    if (observer || typeof MutationObserver !== 'function') return;
    const root = document.body || document.documentElement;
    if (!root) return;
    observer = new MutationObserver(() => scheduleSynchronize('dom'));
    observer.observe(root, { childList: true, subtree: true });
  };

  const api = Object.freeze({
    version: '1.0.0',
    refreshNow: () => synchronize('manual', true),
    checkNow: () => synchronize('manual-check', false),
    getSignature: () => lastSignature,
  });
  Object.defineProperty(globalThis, API_KEY, {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const boot = () => {
    synchronize('boot');
    startObserver();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  setInterval(() => synchronize('poll'), POLL_MS);
  window.addEventListener('focus', () => scheduleSynchronize('focus', true));
  window.addEventListener('storage', () => scheduleSynchronize('storage', true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleSynchronize('visibility', true);
  });
})();
