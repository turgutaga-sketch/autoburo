/* AutoBüro · Sicherer Geldbereich
 * - Verwendet einen eigenen localStorage-Schlüssel.
 * - Bestehende Kunden-, Fahrzeug-, Rechnungs- und Firmendaten werden weder geändert noch migriert.
 */
(() => {
  'use strict';

  const MODULE_ID = 'autoburo-money-module';
  const STORAGE_KEY = 'autoburo_money_v1';
  const LEGACY_KEYS_FOR_BACKUP = ['nwasb_buero_v1', STORAGE_KEY];

  if (document.getElementById(MODULE_ID)) return;

  const euro = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });

  const todayIso = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const makeId = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const safeParse = (raw, fallback) => {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const emptyState = () => ({ version: 1, entries: [] });

  const normalizeState = (value) => {
    const state = value && typeof value === 'object' ? value : emptyState();
    const entries = Array.isArray(state.entries) ? state.entries : [];
    return {
      version: 1,
      entries: entries
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          id: String(entry.id || makeId()),
          type: entry.type === 'out' ? 'out' : 'in',
          method: entry.method === 'bank' ? 'bank' : 'cash',
          amount: Number.isFinite(Number(entry.amount)) ? Math.abs(Number(entry.amount)) : 0,
          note: String(entry.note || '').slice(0, 180),
          date: /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || '')) ? String(entry.date) : todayIso(),
          createdAt: String(entry.createdAt || new Date().toISOString()),
        }))
        .filter((entry) => entry.amount > 0),
    };
  };

  const loadState = () => normalizeState(safeParse(localStorage.getItem(STORAGE_KEY), emptyState()));

  const saveState = (state) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  };

  const host = document.createElement('div');
  host.id = MODULE_ID;
  host.setAttribute('data-autoburo-safe-module', 'geld');
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; }
      :host { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button, input, select { font: inherit; }
      button { cursor: pointer; }

      .geld-fab {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483000;
        border: 0;
        border-radius: 18px;
        padding: 13px 17px;
        background: linear-gradient(145deg, #0b1d33, #132e50);
        color: #fff;
        box-shadow: 0 15px 40px rgba(3, 18, 38, .28);
        display: inline-flex;
        align-items: center;
        gap: 9px;
        font-weight: 750;
        letter-spacing: .01em;
      }
      .geld-fab:hover { transform: translateY(-1px); }
      .geld-fab__icon { color: #d8b866; font-size: 18px; }

      .overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483001;
        background: rgba(3, 12, 24, .48);
        backdrop-filter: blur(9px);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
      }
      .overlay.open { display: flex; }

      .panel {
        width: min(940px, 100%);
        max-height: min(860px, calc(100vh - 36px));
        overflow: auto;
        background: #f6f8fb;
        border: 1px solid rgba(255,255,255,.9);
        border-radius: 28px;
        box-shadow: 0 28px 90px rgba(2, 15, 31, .35);
      }

      .head {
        position: sticky;
        top: 0;
        z-index: 4;
        padding: 20px 22px 16px;
        background: rgba(246, 248, 251, .94);
        backdrop-filter: blur(18px);
        border-bottom: 1px solid #e5eaf1;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }
      .eyebrow { color: #a17d24; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
      h2 { margin: 5px 0 3px; color: #0a1d33; font-size: clamp(24px, 4vw, 34px); line-height: 1.08; }
      .sub { margin: 0; color: #667285; font-size: 13px; }
      .close {
        border: 0;
        width: 40px;
        height: 40px;
        border-radius: 14px;
        background: #fff;
        color: #0b1d33;
        box-shadow: 0 5px 18px rgba(12, 31, 54, .08);
        font-size: 22px;
      }

      .body { padding: 20px 22px 24px; }
      .status-card {
        border-radius: 22px;
        padding: 18px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        border: 1px solid transparent;
      }
      .status-card.good { background: #eaf8f0; border-color: #bee7cf; color: #145c38; }
      .status-card.zero { background: #fff7e5; border-color: #f1db9d; color: #7a5700; }
      .status-card.bad { background: #fff0f0; border-color: #efc5c5; color: #8c1f1f; }
      .status-title { font-weight: 850; font-size: 18px; }
      .status-note { font-size: 12px; opacity: .8; margin-top: 3px; }
      .status-total { font-weight: 850; font-size: 24px; white-space: nowrap; }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }
      .summary {
        background: #fff;
        border: 1px solid #e3e8ef;
        border-radius: 20px;
        padding: 16px;
        box-shadow: 0 9px 26px rgba(13, 36, 62, .05);
      }
      .summary-label { color: #6d7888; font-size: 12px; font-weight: 750; }
      .summary-value { margin-top: 7px; color: #0a1d33; font-weight: 850; font-size: 24px; }
      .summary-detail { margin-top: 5px; color: #7f8a99; font-size: 11px; }

      .grid {
        display: grid;
        grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);
        gap: 16px;
      }
      .card {
        background: #fff;
        border: 1px solid #e3e8ef;
        border-radius: 22px;
        padding: 18px;
        box-shadow: 0 9px 26px rgba(13, 36, 62, .05);
      }
      .card h3 { margin: 0 0 14px; color: #0a1d33; font-size: 17px; }

      .segmented {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        background: #f0f3f7;
        padding: 5px;
        border-radius: 15px;
        margin-bottom: 12px;
      }
      .segmented button {
        border: 0;
        border-radius: 11px;
        padding: 10px 8px;
        background: transparent;
        color: #5f6b7a;
        font-weight: 750;
      }
      .segmented button.active { background: #0b1d33; color: #fff; box-shadow: 0 4px 12px rgba(11, 29, 51, .18); }

      .field { display: grid; gap: 6px; margin-top: 11px; }
      .field label { font-size: 12px; font-weight: 750; color: #596575; }
      .field input, .field select {
        width: 100%;
        border: 1px solid #dce2ea;
        background: #fbfcfe;
        color: #0b1d33;
        border-radius: 14px;
        padding: 12px 13px;
        outline: none;
      }
      .field input:focus, .field select:focus { border-color: #c4a54f; box-shadow: 0 0 0 3px rgba(196, 165, 79, .15); }
      .save {
        width: 100%;
        margin-top: 14px;
        border: 0;
        border-radius: 15px;
        padding: 13px;
        background: linear-gradient(145deg, #c7a84f, #a9872e);
        color: #fff;
        font-weight: 850;
      }
      .safe-note {
        margin-top: 12px;
        padding: 10px 12px;
        border-radius: 13px;
        background: #f2f5f8;
        color: #657180;
        font-size: 11px;
        line-height: 1.45;
      }

      .list-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
      .backup {
        border: 1px solid #dce2ea;
        border-radius: 12px;
        padding: 8px 10px;
        background: #fff;
        color: #0b1d33;
        font-size: 12px;
        font-weight: 750;
      }
      .entries { display: grid; gap: 9px; max-height: 370px; overflow: auto; padding-right: 2px; }
      .empty { color: #7d8794; text-align: center; padding: 32px 10px; font-size: 13px; }
      .entry {
        border: 1px solid #e7ebf0;
        border-radius: 15px;
        padding: 11px 12px;
        display: grid;
        grid-template-columns: auto 1fr auto auto;
        align-items: center;
        gap: 10px;
      }
      .entry-sign {
        width: 34px;
        height: 34px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        font-weight: 900;
      }
      .entry.in .entry-sign { background: #e9f7ef; color: #197346; }
      .entry.out .entry-sign { background: #fff0f0; color: #a12a2a; }
      .entry-note { color: #17283e; font-weight: 750; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .entry-meta { color: #7d8794; font-size: 11px; margin-top: 3px; }
      .entry-amount { font-weight: 850; white-space: nowrap; font-size: 13px; }
      .entry.in .entry-amount { color: #197346; }
      .entry.out .entry-amount { color: #a12a2a; }
      .delete {
        border: 0;
        width: 31px;
        height: 31px;
        border-radius: 10px;
        background: #f3f5f7;
        color: #7b8591;
      }

      .toast {
        position: fixed;
        left: 50%;
        bottom: 28px;
        transform: translateX(-50%) translateY(18px);
        opacity: 0;
        pointer-events: none;
        z-index: 2147483647;
        padding: 11px 15px;
        border-radius: 13px;
        background: #0b1d33;
        color: #fff;
        font-size: 13px;
        box-shadow: 0 14px 38px rgba(0,0,0,.25);
        transition: .2s ease;
      }
      .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

      @media (max-width: 720px) {
        .overlay { padding: 0; align-items: flex-end; }
        .panel { width: 100%; max-height: 94vh; border-radius: 26px 26px 0 0; }
        .head { padding: 17px 16px 14px; }
        .body { padding: 15px 16px 22px; }
        .summary-grid { grid-template-columns: 1fr; }
        .grid { grid-template-columns: 1fr; }
        .status-card { align-items: flex-start; flex-direction: column; }
        .entry { grid-template-columns: auto 1fr auto; }
        .delete { grid-column: 3; }
        .geld-fab { right: 13px; bottom: 13px; }
      }
    </style>

    <button class="geld-fab" type="button" aria-label="Geldbereich öffnen">
      <span class="geld-fab__icon">€</span><span>Geld</span>
    </button>

    <div class="overlay" role="dialog" aria-modal="true" aria-label="Geldbereich">
      <section class="panel">
        <header class="head">
          <div>
            <div class="eyebrow">AutoBüro</div>
            <h2>Geld</h2>
            <p class="sub">Bar und Bank einfach getrennt erfassen.</p>
          </div>
          <button class="close" type="button" aria-label="Schließen">×</button>
        </header>

        <main class="body">
          <section class="status-card zero">
            <div>
              <div class="status-title">Kein Geld erfasst</div>
              <div class="status-note">Der Status basiert nur auf diesem sicheren Geldbereich.</div>
            </div>
            <div class="status-total">0,00 €</div>
          </section>

          <section class="summary-grid">
            <article class="summary">
              <div class="summary-label">Bar / Kasse</div>
              <div class="summary-value" data-value="cash">0,00 €</div>
              <div class="summary-detail" data-detail="cash">0 Buchungen</div>
            </article>
            <article class="summary">
              <div class="summary-label">Bank / Überweisung</div>
              <div class="summary-value" data-value="bank">0,00 €</div>
              <div class="summary-detail" data-detail="bank">0 Buchungen</div>
            </article>
            <article class="summary">
              <div class="summary-label">Gesamt</div>
              <div class="summary-value" data-value="total">0,00 €</div>
              <div class="summary-detail" data-detail="total">Einnahmen − Ausgaben</div>
            </article>
          </section>

          <section class="grid">
            <article class="card">
              <h3>Neue Buchung</h3>
              <div class="segmented" data-group="type">
                <button type="button" class="active" data-value="in">Geld rein</button>
                <button type="button" data-value="out">Geld raus</button>
              </div>
              <div class="segmented" data-group="method">
                <button type="button" class="active" data-value="cash">Bar</button>
                <button type="button" data-value="bank">Bank</button>
              </div>

              <div class="field">
                <label for="geld-amount">Betrag</label>
                <input id="geld-amount" inputmode="decimal" autocomplete="off" placeholder="0,00 €">
              </div>
              <div class="field">
                <label for="geld-note">Beschreibung</label>
                <input id="geld-note" maxlength="180" autocomplete="off" placeholder="z. B. Kunde Müller / Rechnung 2026-15">
              </div>
              <div class="field">
                <label for="geld-date">Datum</label>
                <input id="geld-date" type="date">
              </div>
              <button class="save" type="button">Speichern</button>

              <div class="safe-note">
                🔒 Dieser Bereich speichert neue Geldbuchungen separat. Vorhandene Kunden-, Firmen-, Fahrzeug- und Rechnungsdaten werden nicht verändert.
              </div>
            </article>

            <article class="card">
              <div class="list-head">
                <h3 style="margin:0">Letzte Buchungen</h3>
                <button class="backup" type="button">Sicherung</button>
              </div>
              <div class="entries"></div>
            </article>
          </section>
        </main>
      </section>
    </div>

    <div class="toast" role="status" aria-live="polite"></div>
  `;

  document.body.appendChild(host);

  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const overlay = $('.overlay');
  const entriesEl = $('.entries');
  const amountEl = $('#geld-amount');
  const noteEl = $('#geld-note');
  const dateEl = $('#geld-date');
  const toastEl = $('.toast');
  let selectedType = 'in';
  let selectedMethod = 'cash';
  let toastTimer;

  dateEl.value = todayIso();

  const toast = (message) => {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  };

  const parseAmount = (input) => {
    const cleaned = String(input || '')
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const value = Number(cleaned);
    return Number.isFinite(value) ? Math.abs(value) : 0;
  };

  const compute = (entries) => {
    const balanceFor = (method) => entries
      .filter((entry) => entry.method === method)
      .reduce((sum, entry) => sum + (entry.type === 'in' ? entry.amount : -entry.amount), 0);
    const cash = balanceFor('cash');
    const bank = balanceFor('bank');
    return { cash, bank, total: cash + bank };
  };

  const statusFor = (total) => {
    if (total > 0) return { className: 'good', title: 'Geld vorhanden' };
    if (total < 0) return { className: 'bad', title: 'Minusbestand' };
    return { className: 'zero', title: 'Kein Geld erfasst' };
  };

  const render = () => {
    const state = loadState();
    const totals = compute(state.entries);
    const status = statusFor(totals.total);
    const statusCard = $('.status-card');

    statusCard.className = `status-card ${status.className}`;
    $('.status-title').textContent = status.title;
    $('.status-total').textContent = euro.format(totals.total);
    $('[data-value="cash"]').textContent = euro.format(totals.cash);
    $('[data-value="bank"]').textContent = euro.format(totals.bank);
    $('[data-value="total"]').textContent = euro.format(totals.total);

    const cashCount = state.entries.filter((entry) => entry.method === 'cash').length;
    const bankCount = state.entries.filter((entry) => entry.method === 'bank').length;
    $('[data-detail="cash"]').textContent = `${cashCount} Buchung${cashCount === 1 ? '' : 'en'}`;
    $('[data-detail="bank"]').textContent = `${bankCount} Buchung${bankCount === 1 ? '' : 'en'}`;

    entriesEl.replaceChildren();
    const sorted = [...state.entries].sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date));
      return byDate || String(b.createdAt).localeCompare(String(a.createdAt));
    });

    if (!sorted.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Noch keine Geldbuchung vorhanden.';
      entriesEl.appendChild(empty);
      return;
    }

    sorted.slice(0, 80).forEach((entry) => {
      const row = document.createElement('div');
      row.className = `entry ${entry.type}`;

      const sign = document.createElement('div');
      sign.className = 'entry-sign';
      sign.textContent = entry.type === 'in' ? '+' : '−';

      const main = document.createElement('div');
      const note = document.createElement('div');
      note.className = 'entry-note';
      note.textContent = entry.note || (entry.type === 'in' ? 'Einnahme' : 'Ausgabe');
      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      meta.textContent = `${entry.method === 'cash' ? 'Bar' : 'Bank'} · ${new Date(`${entry.date}T12:00:00`).toLocaleDateString('de-DE')}`;
      main.append(note, meta);

      const amount = document.createElement('div');
      amount.className = 'entry-amount';
      amount.textContent = `${entry.type === 'in' ? '+' : '−'}${euro.format(entry.amount)}`;

      const del = document.createElement('button');
      del.className = 'delete';
      del.type = 'button';
      del.setAttribute('aria-label', 'Buchung löschen');
      del.textContent = '×';
      del.addEventListener('click', () => {
        if (!confirm('Nur diese Geldbuchung wirklich löschen?')) return;
        const current = loadState();
        current.entries = current.entries.filter((item) => item.id !== entry.id);
        saveState(current);
        render();
        toast('Buchung gelöscht');
      });

      row.append(sign, main, amount, del);
      entriesEl.appendChild(row);
    });
  };

  const setSegment = (group, value) => {
    $$(`[data-group="${group}"] button`).forEach((button) => {
      button.classList.toggle('active', button.dataset.value === value);
    });
  };

  $$('[data-group="type"] button').forEach((button) => {
    button.addEventListener('click', () => {
      selectedType = button.dataset.value === 'out' ? 'out' : 'in';
      setSegment('type', selectedType);
    });
  });

  $$('[data-group="method"] button').forEach((button) => {
    button.addEventListener('click', () => {
      selectedMethod = button.dataset.value === 'bank' ? 'bank' : 'cash';
      setSegment('method', selectedMethod);
    });
  });

  $('.save').addEventListener('click', () => {
    const amount = parseAmount(amountEl.value);
    if (!(amount > 0)) {
      amountEl.focus();
      toast('Bitte einen gültigen Betrag eingeben');
      return;
    }

    const state = loadState();
    state.entries.push({
      id: makeId(),
      type: selectedType,
      method: selectedMethod,
      amount,
      note: noteEl.value.trim().slice(0, 180),
      date: dateEl.value || todayIso(),
      createdAt: new Date().toISOString(),
    });
    saveState(state);

    amountEl.value = '';
    noteEl.value = '';
    render();
    toast('Geldbuchung gespeichert');
    amountEl.focus();
  });

  $('.backup').addEventListener('click', () => {
    const data = {
      createdAt: new Date().toISOString(),
      source: 'AutoBüro Sicherung',
      data: Object.fromEntries(LEGACY_KEYS_FOR_BACKUP.map((key) => [key, localStorage.getItem(key)])),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoburo-sicherung-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Sicherung erstellt');
  });

  const open = () => {
    overlay.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    render();
    setTimeout(() => amountEl.focus(), 40);
  };

  const close = () => {
    overlay.classList.remove('open');
    document.documentElement.style.overflow = '';
  };

  $('.geld-fab').addEventListener('click', open);
  $('.close').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) close();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) render();
  });

  render();
})();
