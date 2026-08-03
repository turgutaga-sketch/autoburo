/* AutoBüro · Geldbereich Sicherheits- und Synchronisations-Ergänzung
 * - Korrigiert deutsche und internationale Betragsformate vor dem Speichern.
 * - Spiegelt ausschließlich Einträge aus `autoburo_money_v1` in die bestehenden
 *   AutoBüro-Einnahmen/Ausgaben, damit Tagesbericht und vorhandener Speicherweg
 *   dieselben Buchungen verwenden.
 * - Berührt keine fremden Kunden-, Fahrzeug-, Rechnungs- oder Geld-Datensätze.
 */
(() => {
  'use strict';

  const MODULE_ID = 'autoburo-money-module';
  const STORAGE_KEY = 'autoburo_money_v1';
  const SOURCE = 'autoburo_money_v1';
  const MAX_BOOT_ATTEMPTS = 30;

  if (globalThis.__AUTOBURO_MONEY_FIX__) return;
  globalThis.__AUTOBURO_MONEY_FIX__ = true;

  const safeParse = (raw, fallback) => {
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const readLocal = () => {
    const value = safeParse(localStorage.getItem(STORAGE_KEY), { version: 1, entries: [] });
    return {
      version: 1,
      entries: Array.isArray(value.entries) ? value.entries.filter(Boolean) : [],
    };
  };

  const writeLocal = (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      entries: Array.isArray(state.entries) ? state.entries : [],
    }));
  };

  const refreshMoneyUi = () => {
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: localStorage.getItem(STORAGE_KEY),
        storageArea: localStorage,
      }));
    } catch {
      window.dispatchEvent(new Event('storage'));
    }
  };

  const normalizeAmountInput = (value) => {
    let text = String(value ?? '')
      .trim()
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/[^0-9,.-]/g, '');

    if (!text) return text;

    const sign = text.startsWith('-') ? '-' : '';
    text = text.replace(/-/g, '');

    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');

    if (comma >= 0 && dot >= 0) {
      if (comma > dot) {
        // 1.000,50 -> 1000,50
        text = text.replace(/\./g, '');
      } else {
        // 1,000.50 -> 1000,50
        text = text.replace(/,/g, '');
        const decimalDot = text.lastIndexOf('.');
        text = `${text.slice(0, decimalDot).replace(/\./g, '')},${text.slice(decimalDot + 1)}`;
      }
    } else if (dot >= 0) {
      const parts = text.split('.');
      const last = parts[parts.length - 1];

      if (parts.length === 2 && last.length !== 3) {
        // 100.50 -> 100,50
        text = `${parts[0]},${last}`;
      } else if (parts.length > 2 && last.length !== 3) {
        // 1.000.50 -> 1000,50
        parts.pop();
        text = `${parts.join('')},${last}`;
      } else {
        // 1.000 -> 1000
        text = parts.join('');
      }
    } else if (comma >= 0) {
      const parts = text.split(',');
      const last = parts[parts.length - 1];

      if (parts.length > 2 && last.length !== 3) {
        parts.pop();
        text = `${parts.join('')},${last}`;
      } else if (parts.length === 2 && last.length === 3) {
        // 1,000 -> 1000
        text = parts.join('');
      }
    }

    return `${sign}${text}`;
  };

  const getNativeState = () => {
    try {
      if (typeof S === 'undefined' || !S || typeof S !== 'object') return null;
      if (!Array.isArray(S.incomes)) S.incomes = [];
      if (!Array.isArray(S.expenses)) S.expenses = [];
      return S;
    } catch {
      return null;
    }
  };

  const nativeEntry = (entry) => ({
    id: String(entry.id),
    source: SOURCE,
    sourceId: String(entry.id),
    date: String(entry.date || ''),
    amount: Math.abs(Number(entry.amount) || 0),
    desc: String(entry.note || (entry.type === 'out' ? 'Ausgabe' : 'Einnahme')).slice(0, 180),
    method: entry.method === 'cash' ? 'bar' : 'bank',
    createdAt: String(entry.createdAt || new Date().toISOString()),
  });

  const persistNative = () => {
    try {
      if (typeof save !== 'function') return false;
      const result = save();
      if (result && typeof result.catch === 'function') {
        result.catch((error) => console.error('AutoBüro Geld-Synchronisierung:', error));
      }
      return true;
    } catch (error) {
      console.error('AutoBüro Geld-Synchronisierung:', error);
      return false;
    }
  };

  const syncLocalToNative = ({ allowRemoval = false } = {}) => {
    const native = getNativeState();
    if (!native) return false;

    const local = readLocal();
    const validEntries = local.entries.filter((entry) =>
      entry &&
      entry.id &&
      Number(entry.amount) > 0 &&
      (entry.type === 'in' || entry.type === 'out')
    );
    const localIds = new Set(validEntries.map((entry) => String(entry.id)));
    let changed = false;

    if (allowRemoval) {
      const oldIncomeLength = native.incomes.length;
      const oldExpenseLength = native.expenses.length;
      native.incomes = native.incomes.filter((entry) =>
        entry?.source !== SOURCE || localIds.has(String(entry.sourceId || entry.id))
      );
      native.expenses = native.expenses.filter((entry) =>
        entry?.source !== SOURCE || localIds.has(String(entry.sourceId || entry.id))
      );
      changed = changed ||
        oldIncomeLength !== native.incomes.length ||
        oldExpenseLength !== native.expenses.length;
    }

    const known = new Set(
      [...native.incomes, ...native.expenses]
        .filter((entry) => entry?.source === SOURCE)
        .map((entry) => String(entry.sourceId || entry.id))
    );

    validEntries.forEach((entry) => {
      const id = String(entry.id);
      if (known.has(id)) return;
      const target = entry.type === 'out' ? native.expenses : native.incomes;
      target.unshift(nativeEntry(entry));
      known.add(id);
      changed = true;
    });

    if (changed) persistNative();
    return true;
  };

  const hydrateLocalFromNative = () => {
    const native = getNativeState();
    if (!native) return false;

    const local = readLocal();
    const known = new Set(local.entries.map((entry) => String(entry.id)));
    let changed = false;

    [...native.incomes, ...native.expenses]
      .filter((entry) => entry?.source === SOURCE && entry?.sourceId)
      .forEach((entry) => {
        const id = String(entry.sourceId);
        if (known.has(id)) return;
        local.entries.push({
          id,
          type: native.expenses.includes(entry) ? 'out' : 'in',
          method: entry.method === 'bar' ? 'cash' : 'bank',
          amount: Math.abs(Number(entry.amount) || 0),
          note: String(entry.desc || ''),
          date: String(entry.date || ''),
          createdAt: String(entry.createdAt || new Date().toISOString()),
        });
        known.add(id);
        changed = true;
      });

    if (changed) {
      writeLocal(local);
      refreshMoneyUi();
    }
    return true;
  };

  const attach = () => {
    const host = document.getElementById(MODULE_ID);
    const root = host?.shadowRoot;
    if (!root || root.__AUTOBURO_MONEY_FIX_ATTACHED__) return false;
    root.__AUTOBURO_MONEY_FIX_ATTACHED__ = true;

    // Capture phase: normalize before the original save handler parses the value.
    root.addEventListener('click', (event) => {
      const button = event.target?.closest?.('.save');
      if (!button) return;
      const amount = root.querySelector('#geld-amount');
      if (amount) amount.value = normalizeAmountInput(amount.value);
    }, true);

    // Bubble phase: original handler has already updated localStorage.
    root.addEventListener('click', (event) => {
      const target = event.target?.closest?.('button');
      if (!target) return;

      if (target.matches('.save')) {
        setTimeout(() => syncLocalToNative(), 0);
      } else if (target.matches('.delete')) {
        setTimeout(() => syncLocalToNative({ allowRemoval: true }), 0);
      }
    });

    hydrateLocalFromNative();
    syncLocalToNative();
    return true;
  };

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const attached = attach();
    const hydrated = hydrateLocalFromNative();
    const synced = syncLocalToNative();
    if ((attached && hydrated && synced) || attempts >= MAX_BOOT_ATTEMPTS) {
      window.clearInterval(timer);
    }
  }, 500);

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) syncLocalToNative();
  });

  attach();
})();
