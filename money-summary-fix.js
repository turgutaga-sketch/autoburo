/* AutoBüro · Geld-Summen im oberen Bereich
 * Zeigt für Bar, Bank und Gesamt jeweils Einnahmen, Ausgaben und Saldo.
 * Aktualisiert außerdem die bestehende AutoBüro-Oberfläche nach Geldbuchungen.
 */
(() => {
  'use strict';

  const MODULE_ID = 'autoburo-money-module';
  const STORAGE_KEY = 'autoburo_money_v1';
  const FLAG = '__AUTOBURO_MONEY_SUMMARY_FIX__';
  const euro = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  if (globalThis[FLAG]) return;
  globalThis[FLAG] = true;

  const readEntries = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"entries":[]}');
      return Array.isArray(parsed?.entries) ? parsed.entries : [];
    } catch {
      return [];
    }
  };

  const totalsFor = (entries, method) => {
    const selected = method === 'total'
      ? entries
      : entries.filter((entry) => entry?.method === method);

    return selected.reduce((totals, entry) => {
      const amount = Math.abs(Number(entry?.amount) || 0);
      if (!(amount > 0)) return totals;
      if (entry?.type === 'out') totals.out += amount;
      else totals.in += amount;
      totals.balance = totals.in - totals.out;
      return totals;
    }, { in: 0, out: 0, balance: 0 });
  };

  const refreshNativeUi = () => {
    try {
      if (typeof window.render === 'function') window.render();
    } catch (error) {
      console.error('AutoBüro üst toplam yenileme:', error);
    }
  };

  const scheduleRefresh = () => {
    [0, 80, 300].forEach((delay) => {
      window.setTimeout(() => {
        updateSummary();
        refreshNativeUi();
      }, delay);
    });
  };

  const ensureStyles = (root) => {
    if (root.querySelector('style[data-money-summary-fix]')) return;
    const style = document.createElement('style');
    style.dataset.moneySummaryFix = 'true';
    style.textContent = `
      .money-summary-breakdown {
        display: grid;
        gap: 7px;
        margin-top: 12px;
        padding-top: 11px;
        border-top: 1px solid #edf0f4;
      }
      .money-summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
        color: #6d7888;
      }
      .money-summary-row strong {
        color: #17283e;
        font-size: 13px;
        white-space: nowrap;
      }
      .money-summary-row.in strong { color: #197346; }
      .money-summary-row.out strong { color: #a12a2a; }
      .money-summary-balance-note {
        margin-top: 5px;
        color: #7f8a99;
        font-size: 11px;
        font-weight: 700;
      }
    `;
    root.appendChild(style);
  };

  const ensureBreakdown = (root, key) => {
    const value = root.querySelector(`[data-value="${key}"]`);
    const card = value?.closest?.('.summary');
    if (!card) return null;

    let box = card.querySelector(`.money-summary-breakdown[data-summary="${key}"]`);
    if (!box) {
      box = document.createElement('div');
      box.className = 'money-summary-breakdown';
      box.dataset.summary = key;
      box.innerHTML = `
        <div class="money-summary-row in">
          <span>Einnahmen</span><strong data-summary-in>0,00 €</strong>
        </div>
        <div class="money-summary-row out">
          <span>Ausgaben</span><strong data-summary-out>0,00 €</strong>
        </div>
        <div class="money-summary-balance-note">Oben: Einnahmen − Ausgaben = Saldo</div>
      `;
      card.appendChild(box);
    }
    return box;
  };

  function updateSummary() {
    const host = document.getElementById(MODULE_ID);
    const root = host?.shadowRoot;
    if (!root) return false;

    ensureStyles(root);
    const entries = readEntries();

    ['cash', 'bank', 'total'].forEach((key) => {
      const totals = totalsFor(entries, key);
      const box = ensureBreakdown(root, key);
      const balance = root.querySelector(`[data-value="${key}"]`);
      if (balance) balance.textContent = euro.format(totals.balance);
      if (box) {
        const income = box.querySelector('[data-summary-in]');
        const expense = box.querySelector('[data-summary-out]');
        if (income) income.textContent = `+${euro.format(totals.in)}`;
        if (expense) expense.textContent = `−${euro.format(totals.out)}`;
      }
    });

    const total = totalsFor(entries, 'total');
    const statusTotal = root.querySelector('.status-total');
    if (statusTotal) statusTotal.textContent = euro.format(total.balance);
    return true;
  }

  const attach = () => {
    const host = document.getElementById(MODULE_ID);
    const root = host?.shadowRoot;
    if (!root) return false;

    updateSummary();
    if (root.__AUTOBURO_MONEY_SUMMARY_ATTACHED__) return true;
    root.__AUTOBURO_MONEY_SUMMARY_ATTACHED__ = true;

    root.addEventListener('click', (event) => {
      const button = event.target?.closest?.('button');
      if (!button) return;
      if (button.matches('.save, .delete, .geld-fab')) scheduleRefresh();
    });

    const entries = root.querySelector('.entries');
    if (entries) {
      new MutationObserver(() => updateSummary())
        .observe(entries, { childList: true });
    }

    return true;
  };

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (attach() || attempts >= 40) window.clearInterval(timer);
  }, 250);

  window.addEventListener('storage', (event) => {
    if (!event.key || event.key === STORAGE_KEY) scheduleRefresh();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh();
  });

  attach();
})();
