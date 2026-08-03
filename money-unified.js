/* AutoBüro · Einheitlicher Geldbereich v2
 * Additiv: liest bestehende Einnahmen/Ausgaben und zeigt sie gemeinsam an.
 * Bestehende Kunden-, Fahrzeug-, Rechnungs- und Firmendaten werden nicht verändert.
 */
(() => {
  'use strict';

  const MODULE_ID = 'autoburo-money-unified';
  const DASHBOARD_ID = 'autoburo-money-today';
  const LEGACY_STORAGE_KEY = 'autoburo_money_v1';
  const SOURCE_V2 = 'autoburo_money_v2';
  const SOURCE_V1 = 'autoburo_money_v1';

  if (globalThis.__AUTOBURO_MONEY_UNIFIED__) return;
  globalThis.__AUTOBURO_MONEY_UNIFIED__ = true;

  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

  const todayIso = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const makeId = () => globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `geld_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const safeParse = (raw, fallback) => {
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const normalizeMethod = (method) => {
    if (method === 'bar' || method === 'cash') return 'cash';
    if (method === 'karte' || method === 'card' || method === 'kreditkarte') return 'card';
    return 'bank';
  };

  const nativeMethod = (method) => method === 'cash' ? 'bar' : method === 'card' ? 'karte' : 'bank';
  const methodLabel = (method) => method === 'cash' ? 'Bar' : method === 'card' ? 'Karte' : 'Bank';

  const parseAmount = (value) => {
    let text = String(value ?? '').trim().replace(/\s/g, '').replace(/€/g, '').replace(/[^0-9,.-]/g, '');
    if (!text) return 0;
    text = text.replace(/-/g, '');
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');

    if (comma >= 0 && dot >= 0) {
      text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else if (comma >= 0) {
      const parts = text.split(',');
      const last = parts.at(-1) || '';
      text = parts.length === 2 && last.length !== 3
        ? `${parts[0]}.${last}`
        : parts.length > 2 && last.length !== 3
          ? `${parts.slice(0, -1).join('')}.${last}`
          : parts.join('');
    } else if (dot >= 0) {
      const parts = text.split('.');
      const last = parts.at(-1) || '';
      text = parts.length === 2 && last.length !== 3
        ? `${parts[0]}.${last}`
        : parts.length > 2 && last.length !== 3
          ? `${parts.slice(0, -1).join('')}.${last}`
          : parts.join('');
    }

    const number = Number(text);
    return Number.isFinite(number) ? Math.abs(number) : 0;
  };

  const getState = () => {
    try {
      if (typeof S === 'undefined' || !S || typeof S !== 'object') return null;
      if (!Array.isArray(S.incomes)) S.incomes = [];
      if (!Array.isArray(S.expenses)) S.expenses = [];
      return S;
    } catch {
      return null;
    }
  };

  const persist = () => {
    try {
      if (typeof save !== 'function') return false;
      const result = save();
      if (result?.catch) result.catch((error) => console.error('AutoBüro Geld speichern:', error));
      return true;
    } catch (error) {
      console.error('AutoBüro Geld speichern:', error);
      return false;
    }
  };

  const allEntries = () => {
    const state = getState();
    if (!state) return [];
    const map = (entry, type) => ({
      id: String(entry?.id || `${type}_${Math.random()}`),
      nativeId: String(entry?.id || ''),
      type,
      method: normalizeMethod(entry?.method),
      amount: Math.abs(Number(entry?.amount) || 0),
      note: String(entry?.desc || entry?.note || (type === 'in' ? 'Einnahme' : 'Ausgabe')),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(entry?.date || '')) ? String(entry.date) : todayIso(),
      createdAt: String(entry?.createdAt || ''),
      deletable: entry?.source === SOURCE_V2 || entry?.source === SOURCE_V1,
    });
    return [
      ...state.incomes.map((entry) => map(entry, 'in')),
      ...state.expenses.map((entry) => map(entry, 'out')),
    ].filter((entry) => entry.amount > 0);
  };

  const migrateLegacyOnce = () => {
    const state = getState();
    if (!state) return false;
    const legacy = safeParse(localStorage.getItem(LEGACY_STORAGE_KEY), { entries: [] });
    const entries = Array.isArray(legacy.entries) ? legacy.entries : [];
    if (!entries.length) return true;

    const known = new Set([...state.incomes, ...state.expenses]
      .filter((entry) => entry?.source === SOURCE_V1 || entry?.source === SOURCE_V2)
      .map((entry) => String(entry?.sourceId || entry?.id || '')));
    let changed = false;

    entries.forEach((entry) => {
      const sourceId = String(entry?.id || '');
      if (!sourceId || known.has(sourceId) || !(Number(entry?.amount) > 0)) return;
      const target = entry.type === 'out' ? state.expenses : state.incomes;
      target.unshift({
        id: sourceId,
        source: SOURCE_V1,
        sourceId,
        date: String(entry.date || todayIso()),
        amount: Math.abs(Number(entry.amount) || 0),
        desc: String(entry.note || (entry.type === 'out' ? 'Ausgabe' : 'Einnahme')).slice(0, 180),
        method: nativeMethod(normalizeMethod(entry.method)),
        createdAt: String(entry.createdAt || new Date().toISOString()),
      });
      known.add(sourceId);
      changed = true;
    });

    if (changed) persist();
    return true;
  };

  const totalsFor = (entries) => {
    const summary = (method) => {
      const selected = method ? entries.filter((entry) => entry.method === method) : entries;
      const income = selected.filter((entry) => entry.type === 'in').reduce((sum, entry) => sum + entry.amount, 0);
      const expense = selected.filter((entry) => entry.type === 'out').reduce((sum, entry) => sum + entry.amount, 0);
      return { income, expense, balance: income - expense };
    };
    return { cash: summary('cash'), bank: summary('bank'), card: summary('card'), total: summary(null) };
  };

  const createModule = () => {
    if (document.getElementById(MODULE_ID)) return;
    const host = document.createElement('div');
    host.id = MODULE_ID;
    host.setAttribute('data-autoburo-safe-module', 'geld-v2');
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
      <style>
        :host,*{box-sizing:border-box}:host{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input{font:inherit}button{cursor:pointer}
        .fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:0;border-radius:18px;padding:13px 17px;background:linear-gradient(145deg,#0b1d33,#132e50);color:#fff;box-shadow:0 15px 40px rgba(3,18,38,.28);font-weight:800;display:flex;gap:9px;align-items:center}.fab span:first-child{color:#d8b866;font-size:18px}
        .overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(3,12,24,.48);backdrop-filter:blur(9px);display:none;align-items:center;justify-content:center;padding:18px}.overlay.open{display:flex}.panel{width:min(1120px,100%);max-height:min(900px,calc(100vh - 36px));overflow:auto;background:#f6f8fb;border-radius:28px;box-shadow:0 28px 90px rgba(2,15,31,.35)}
        .head{position:sticky;top:0;z-index:3;padding:20px 22px 16px;background:rgba(246,248,251,.95);backdrop-filter:blur(18px);border-bottom:1px solid #e5eaf1;display:flex;justify-content:space-between;gap:16px}.eyebrow{color:#a17d24;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.12em}h2{margin:5px 0 3px;color:#0a1d33;font-size:32px}.sub{margin:0;color:#667285;font-size:13px}.close{border:0;width:40px;height:40px;border-radius:14px;background:#fff;color:#0b1d33;font-size:22px;box-shadow:0 5px 18px rgba(12,31,54,.08)}
        .body{padding:20px 22px 24px}.status{border-radius:22px;padding:18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid}.status.good{background:#eaf8f0;border-color:#bee7cf;color:#145c38}.status.zero{background:#fff7e5;border-color:#f1db9d;color:#7a5700}.status.bad{background:#fff0f0;border-color:#efc5c5;color:#8c1f1f}.status-title{font-weight:900;font-size:18px}.status-note{font-size:12px;opacity:.8;margin-top:3px}.status-total{font-weight:900;font-size:25px;white-space:nowrap}
        .summaries{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px}.summary{background:#fff;border:1px solid #e3e8ef;border-radius:20px;padding:16px;box-shadow:0 9px 26px rgba(13,36,62,.05)}.summary-label{color:#6d7888;font-size:12px;font-weight:800}.summary-balance{margin:7px 0 10px;color:#0a1d33;font-weight:900;font-size:23px}.detail{display:grid;gap:5px;border-top:1px solid #edf0f4;padding-top:9px;font-size:11px}.detail div{display:flex;justify-content:space-between;gap:8px;color:#718096}.detail strong{color:#22344b}.detail .income strong{color:#197346}.detail .expense strong{color:#a12a2a}
        .grid{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:16px}.card{background:#fff;border:1px solid #e3e8ef;border-radius:22px;padding:18px;box-shadow:0 9px 26px rgba(13,36,62,.05)}.card h3{margin:0 0 14px;color:#0a1d33;font-size:17px}.segmented{display:grid;gap:7px;background:#f0f3f7;padding:5px;border-radius:15px;margin-bottom:12px}.segmented.two{grid-template-columns:1fr 1fr}.segmented.three{grid-template-columns:1fr 1fr 1fr}.segmented button{border:0;border-radius:11px;padding:10px 6px;background:transparent;color:#5f6b7a;font-weight:800}.segmented button.active{background:#0b1d33;color:#fff;box-shadow:0 4px 12px rgba(11,29,51,.18)}
        .field{display:grid;gap:6px;margin-top:11px}.field label{font-size:12px;font-weight:800;color:#596575}.field input{width:100%;border:1px solid #dce2ea;background:#fbfcfe;color:#0b1d33;border-radius:14px;padding:12px 13px;outline:none}.save{width:100%;margin-top:14px;border:0;border-radius:15px;padding:13px;background:linear-gradient(145deg,#c7a84f,#a9872e);color:#fff;font-weight:900}.safe{margin-top:12px;padding:10px 12px;border-radius:13px;background:#f2f5f8;color:#657180;font-size:11px;line-height:1.45}
        .list-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.filter{display:flex;gap:6px;flex-wrap:wrap}.filter button{border:1px solid #dce2ea;border-radius:10px;padding:7px 9px;background:#fff;color:#536173;font-size:11px;font-weight:800}.filter button.active{background:#0b1d33;color:#fff;border-color:#0b1d33}.entries{display:grid;gap:9px;max-height:410px;overflow:auto;padding-right:2px}.empty{color:#7d8794;text-align:center;padding:32px 10px;font-size:13px}
        .entry{border:1px solid #e7ebf0;border-radius:15px;padding:11px 12px;display:grid;grid-template-columns:auto 1fr auto auto;align-items:center;gap:10px}.sign{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:900}.entry.in .sign{background:#e9f7ef;color:#197346}.entry.out .sign{background:#fff0f0;color:#a12a2a}.entry-note{color:#17283e;font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.entry-meta{color:#7d8794;font-size:11px;margin-top:3px}.entry-amount{font-weight:900;white-space:nowrap;font-size:13px}.entry.in .entry-amount{color:#197346}.entry.out .entry-amount{color:#a12a2a}.delete{border:0;width:31px;height:31px;border-radius:10px;background:#f3f5f7;color:#7b8591}.lock{width:31px;text-align:center;color:#9aa4b1;font-size:14px}
        .toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(18px);opacity:0;pointer-events:none;z-index:2147483647;padding:11px 15px;border-radius:13px;background:#0b1d33;color:#fff;font-size:13px;box-shadow:0 14px 38px rgba(0,0,0,.25);transition:.2s ease}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
        @media(max-width:900px){.summaries{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.overlay{padding:0;align-items:flex-end}.panel{width:100%;max-height:94vh;border-radius:26px 26px 0 0}.body{padding:15px 16px 22px}.head{padding:17px 16px 14px}.summaries{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.status{align-items:flex-start;flex-direction:column}.entry{grid-template-columns:auto 1fr auto}.delete,.lock{grid-column:3}.fab{right:13px;bottom:13px}}
      </style>
      <button class="fab" type="button"><span>€</span><span>Geld</span></button>
      <div class="overlay" role="dialog" aria-modal="true" aria-label="Geldbereich"><section class="panel"><header class="head"><div><div class="eyebrow">AutoBüro</div><h2>Geld</h2><p class="sub">Bar, Bank und Karte – alle Einnahmen und Ausgaben gemeinsam.</p></div><button class="close" type="button">×</button></header><main class="body"><section class="status zero"><div><div class="status-title">Kein Geld erfasst</div><div class="status-note">Einnahmen und Ausgaben werden getrennt ausgewiesen.</div></div><div class="status-total">0,00 €</div></section><section class="summaries"></section><section class="grid"><article class="card"><h3>Neue Buchung</h3><div class="segmented two" data-group="type"><button class="active" data-value="in">Geld rein</button><button data-value="out">Geld raus</button></div><div class="segmented three" data-group="method"><button class="active" data-value="cash">Bar</button><button data-value="bank">Bank</button><button data-value="card">Karte</button></div><div class="field"><label for="geld2-amount">Betrag</label><input id="geld2-amount" inputmode="decimal" autocomplete="off" placeholder="0,00 €"></div><div class="field"><label for="geld2-note">Beschreibung</label><input id="geld2-note" maxlength="180" autocomplete="off" placeholder="z. B. Kunde Müller / Rechnung 2026-15"></div><div class="field"><label for="geld2-date">Datum</label><input id="geld2-date" type="date"></div><button class="save" type="button">Speichern</button><div class="safe">🔒 Bestehende Einnahmen/Ausgaben werden nur gelesen und gemeinsam angezeigt. Löschen ist hier ausschließlich für Buchungen möglich, die im Geldbereich angelegt wurden.</div></article><article class="card"><div class="list-head"><h3 style="margin:0">Letzte Buchungen</h3><div class="filter"><button class="active" data-filter="all">Alle</button><button data-filter="cash">Bar</button><button data-filter="bank">Bank</button><button data-filter="card">Karte</button></div></div><div class="entries"></div></article></section></main></section></div><div class="toast" role="status" aria-live="polite"></div>`;

    document.body.appendChild(host);
    const $ = (selector) => root.querySelector(selector);
    const $$ = (selector) => [...root.querySelectorAll(selector)];
    const overlay = $('.overlay');
    const summaries = $('.summaries');
    const entriesEl = $('.entries');
    const amountEl = $('#geld2-amount');
    const noteEl = $('#geld2-note');
    const dateEl = $('#geld2-date');
    const toastEl = $('.toast');
    let selectedType = 'in';
    let selectedMethod = 'cash';
    let selectedFilter = 'all';
    let toastTimer;
    dateEl.value = todayIso();

    const toast = (message) => {
      toastEl.textContent = message;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
    };

    const cardHtml = (label, data) => `<article class="summary"><div class="summary-label">${label}</div><div class="summary-balance">${euro.format(data.balance)}</div><div class="detail"><div class="income"><span>Einnahmen</span><strong>${euro.format(data.income)}</strong></div><div class="expense"><span>Ausgaben</span><strong>${euro.format(data.expense)}</strong></div><div><span>Saldo</span><strong>${euro.format(data.balance)}</strong></div></div></article>`;

    const render = () => {
      const entries = allEntries();
      const totals = totalsFor(entries);
      const total = totals.total.balance;
      const status = total > 0 ? ['good', 'Geld vorhanden'] : total < 0 ? ['bad', 'Minusbestand'] : entries.length ? ['zero', 'Geldbewegung vorhanden'] : ['zero', 'Kein Geld erfasst'];
      $('.status').className = `status ${status[0]}`;
      $('.status-title').textContent = status[1];
      $('.status-total').textContent = euro.format(total);
      summaries.innerHTML = [cardHtml('Bar / Kasse', totals.cash), cardHtml('Bank / Überweisung', totals.bank), cardHtml('Karte / Kreditkarte', totals.card), cardHtml('Gesamt', totals.total)].join('');

      const filtered = selectedFilter === 'all' ? entries : entries.filter((entry) => entry.method === selectedFilter);
      const sorted = [...filtered].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
      entriesEl.replaceChildren();
      if (!sorted.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'Noch keine passende Geldbuchung vorhanden.';
        entriesEl.appendChild(empty);
      }

      sorted.slice(0, 120).forEach((entry) => {
        const row = document.createElement('div');
        row.className = `entry ${entry.type}`;
        const sign = document.createElement('div');
        sign.className = 'sign';
        sign.textContent = entry.type === 'in' ? '+' : '−';
        const main = document.createElement('div');
        const note = document.createElement('div');
        note.className = 'entry-note';
        note.textContent = entry.note;
        const meta = document.createElement('div');
        meta.className = 'entry-meta';
        meta.textContent = `${methodLabel(entry.method)} · ${new Date(`${entry.date}T12:00:00`).toLocaleDateString('de-DE')} · ${entry.deletable ? 'Geld' : 'Einnahmen/Ausgaben'}`;
        main.append(note, meta);
        const amount = document.createElement('div');
        amount.className = 'entry-amount';
        amount.textContent = `${entry.type === 'in' ? '+' : '−'}${euro.format(entry.amount)}`;
        let action;
        if (entry.deletable) {
          action = document.createElement('button');
          action.className = 'delete';
          action.type = 'button';
          action.textContent = '×';
          action.addEventListener('click', () => {
            if (!confirm('Nur diese Geldbuchung wirklich löschen?')) return;
            const state = getState();
            if (!state) return;
            const collection = entry.type === 'out' ? state.expenses : state.incomes;
            const index = collection.findIndex((item) => String(item?.id || '') === entry.nativeId);
            if (index >= 0) collection.splice(index, 1);
            persist();
            try { if (typeof window.render === 'function') window.render(); } catch {}
            render();
            renderDashboardCard();
            toast('Buchung gelöscht');
          });
        } else {
          action = document.createElement('div');
          action.className = 'lock';
          action.title = 'Im ursprünglichen Einnahmen/Ausgaben-Bereich verwaltet';
          action.textContent = '🔒';
        }
        row.append(sign, main, amount, action);
        entriesEl.appendChild(row);
      });
    };

    $$('[data-group="type"] button').forEach((button) => button.addEventListener('click', () => {
      selectedType = button.dataset.value === 'out' ? 'out' : 'in';
      $$('[data-group="type"] button').forEach((item) => item.classList.toggle('active', item === button));
    }));
    $$('[data-group="method"] button').forEach((button) => button.addEventListener('click', () => {
      selectedMethod = ['cash', 'bank', 'card'].includes(button.dataset.value) ? button.dataset.value : 'cash';
      $$('[data-group="method"] button').forEach((item) => item.classList.toggle('active', item === button));
    }));
    $$('[data-filter]').forEach((button) => button.addEventListener('click', () => {
      selectedFilter = button.dataset.filter || 'all';
      $$('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
      render();
    }));

    $('.save').addEventListener('click', () => {
      const amount = parseAmount(amountEl.value);
      if (!(amount > 0)) { amountEl.focus(); toast('Bitte einen gültigen Betrag eingeben'); return; }
      const state = getState();
      if (!state) { toast('Daten werden noch geladen – bitte kurz erneut versuchen'); return; }
      const id = makeId();
      const entry = { id, source: SOURCE_V2, sourceId: id, date: dateEl.value || todayIso(), amount, desc: noteEl.value.trim().slice(0, 180) || (selectedType === 'out' ? 'Ausgabe' : 'Einnahme'), method: nativeMethod(selectedMethod), createdAt: new Date().toISOString() };
      (selectedType === 'out' ? state.expenses : state.incomes).unshift(entry);
      persist();
      amountEl.value = '';
      noteEl.value = '';
      try { if (typeof window.render === 'function') window.render(); } catch {}
      render();
      renderDashboardCard();
      toast('Geldbuchung gespeichert');
      amountEl.focus();
    });

    const open = () => { overlay.classList.add('open'); document.documentElement.style.overflow = 'hidden'; render(); setTimeout(() => amountEl.focus(), 40); };
    const close = () => { overlay.classList.remove('open'); document.documentElement.style.overflow = ''; };
    $('.fab').addEventListener('click', open);
    $('.close').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && overlay.classList.contains('open')) close(); });
    host.openMoney = open;
    host.refreshMoney = render;
    render();
  };

  const findDashboardContainer = () => {
    const active = document.querySelector('[data-page].active,[data-view].active,.nav-item.active,.sidebar .active,nav .active');
    const activeText = `${active?.dataset?.page || ''} ${active?.dataset?.view || ''} ${active?.textContent || ''} ${location.hash}`.toLowerCase();
    if (activeText && !/(dashboard|übersicht|uebersicht|start|home|ana)/.test(activeText)) return null;
    const candidates = [document.querySelector('#content'), document.querySelector('.main-content'), document.querySelector('main'), document.querySelector('.content'), document.querySelector('#app')].filter(Boolean);
    return candidates.find((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.offsetWidth > 320;
    }) || null;
  };

  const renderDashboardCard = () => {
    const totals = totalsFor(allEntries().filter((entry) => entry.date === todayIso())).total;
    let host = document.getElementById(DASHBOARD_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = DASHBOARD_ID;
      host.setAttribute('data-autoburo-safe-module', 'geld-heute');
      host.attachShadow({ mode: 'open' });
    }
    const container = findDashboardContainer();
    if (!container) { host.remove(); return; }
    if (!host.isConnected || host.parentElement !== container) container.prepend(host);
    host.shadowRoot.innerHTML = `<style>:host{display:block;margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}button{width:100%;border:1px solid #e2e7ee;border-radius:20px;background:linear-gradient(145deg,#fff,#f7f9fc);box-shadow:0 9px 28px rgba(13,36,62,.07);padding:15px 17px;display:grid;grid-template-columns:auto repeat(3,minmax(0,1fr));align-items:center;gap:16px;text-align:left;cursor:pointer;color:#0a1d33}.title{min-width:125px}.eyebrow{color:#a17d24;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.12em}.name{margin-top:3px;font-size:18px;font-weight:900}.metric{border-left:1px solid #e8ecf1;padding-left:16px}.label{color:#738094;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.value{margin-top:4px;font-size:18px;font-weight:900;white-space:nowrap}.income .value{color:#197346}.expense .value{color:#a12a2a}.balance .value{color:${totals.balance < 0 ? '#a12a2a' : '#0a1d33'}}@media(max-width:720px){button{grid-template-columns:1fr 1fr;gap:12px}.title{grid-column:1/-1}.metric{border-left:0;border-top:1px solid #e8ecf1;padding:10px 0 0}.balance{grid-column:1/-1}}</style><button type="button"><div class="title"><div class="eyebrow">AutoBüro</div><div class="name">Geld heute</div></div><div class="metric income"><div class="label">Einnahmen</div><div class="value">${euro.format(totals.income)}</div></div><div class="metric expense"><div class="label">Ausgaben</div><div class="value">${euro.format(totals.expense)}</div></div><div class="metric balance"><div class="label">Saldo</div><div class="value">${euro.format(totals.balance)}</div></div></button>`;
    host.shadowRoot.querySelector('button')?.addEventListener('click', () => document.getElementById(MODULE_ID)?.openMoney?.());
  };

  const removeOldModule = () => document.getElementById('autoburo-money-module')?.remove();
  let attempts = 0;
  const boot = () => {
    attempts += 1;
    if (!document.body) return false;
    removeOldModule();
    const ready = Boolean(getState());
    if (ready) migrateLegacyOnce();
    createModule();
    renderDashboardCard();
    return ready;
  };

  const timer = setInterval(() => { if (boot() || attempts >= 40) clearInterval(timer); }, 300);
  const observer = new MutationObserver(() => {
    removeOldModule();
    renderDashboardCard();
    document.getElementById(MODULE_ID)?.refreshMoney?.();
  });
  const observe = () => { if (document.body) observer.observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot(); observe(); }, { once: true });
  else { boot(); observe(); }
  window.addEventListener('storage', () => { document.getElementById(MODULE_ID)?.refreshMoney?.(); renderDashboardCard(); });
})();
