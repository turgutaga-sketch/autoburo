const assert = require('node:assert/strict');
const path = require('node:path');

const listeners = new Map();
let intervalCheck = null;
let moneyRefreshes = 0;
let nativeRefreshes = 0;
let dispatchedEvents = 0;

class CustomEventMock {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

class MutationObserverMock {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
}

const moneyHost = {
  refreshMoney() {
    moneyRefreshes += 1;
  },
};

global.CustomEvent = CustomEventMock;
global.MutationObserver = MutationObserverMock;
global.requestAnimationFrame = (callback) => callback();
global.setInterval = (callback) => {
  intervalCheck = callback;
  return 1;
};
global.setTimeout = (callback) => {
  callback();
  return 1;
};
global.window = {
  addEventListener(type, callback) {
    listeners.set(`window:${type}`, callback);
  },
  dispatchEvent(event) {
    if (event.type === 'autoburo:money-data-changed') dispatchedEvents += 1;
    return true;
  },
};
global.document = {
  readyState: 'complete',
  hidden: false,
  body: {},
  documentElement: {},
  getElementById(id) {
    return id === 'autoburo-money-unified' ? moneyHost : null;
  },
  addEventListener(type, callback) {
    listeners.set(`document:${type}`, callback);
  },
  dispatchEvent(event) {
    if (event.type === 'autoburo:money-data-changed') dispatchedEvents += 1;
    return true;
  },
};
global.render = function render() {
  nativeRefreshes += 1;
};

global.S = {
  company: { name: 'Unverändert GmbH' },
  customers: [{ id: 'c1', name: 'Kunde Eins' }],
  vehicles: [{ id: 'v1', plate: 'B-AB 123' }],
  invoices: [{ id: 'r1', total: 200, status: 'open' }],
  settings: { nextInvoiceNumber: 77 },
  incomes: [{ id: 'old-in', amount: 25, method: 'bar', date: '2026-08-03', desc: 'Alt' }],
  expenses: [{ id: 'old-out', amount: 5, method: 'bank', date: '2026-08-03', desc: 'Alt' }],
};

const protectedBefore = JSON.stringify({
  company: S.company,
  customers: S.customers,
  vehicles: S.vehicles,
  invoices: S.invoices,
  settings: S.settings,
});

require(path.resolve(__dirname, '..', 'money-native-sync.js'));
const api = global.__AUTOBURO_MONEY_NATIVE_SYNC__;

assert.ok(api, 'Sync API was not exposed');
assert.equal(api.version, '1.0.0');
assert.equal(typeof intervalCheck, 'function', 'Polling was not registered');
assert.equal(moneyRefreshes, 0, 'Initial boot must not create a false refresh');
assert.equal(nativeRefreshes, 0, 'Initial boot must not redraw without a change');

// Native Einnahme -> Geld + Dashboard refresh.
S.incomes.push({
  id: 'income-200',
  amount: 200,
  method: 'bar',
  date: '2026-08-03',
  desc: 'Einnahme 200',
});
assert.equal(api.checkNow(), true);
assert.equal(moneyRefreshes, 1);
assert.equal(nativeRefreshes, 1);

// Native Ausgabe -> Geld + Dashboard refresh.
S.expenses.push({
  id: 'expense-200',
  amount: 200,
  method: 'bank',
  date: '2026-08-03',
  desc: 'Ausgabe 200',
});
assert.equal(api.checkNow(), true);
assert.equal(moneyRefreshes, 2);
assert.equal(nativeRefreshes, 2);

// Payment-method edits are synchronized too.
S.incomes.at(-1).method = 'karte';
assert.equal(api.checkNow(), true);
assert.equal(moneyRefreshes, 3);
assert.equal(nativeRefreshes, 3);

// No state change -> no duplicate refresh and no duplicate record.
assert.equal(api.checkNow(), false);
assert.equal(S.incomes.filter((item) => item.id === 'income-200').length, 1);
assert.equal(S.expenses.filter((item) => item.id === 'expense-200').length, 1);
assert.equal(S.incomes.length, 2);
assert.equal(S.expenses.length, 2);

// 200 in / 200 out remains independently visible, while the net is zero.
const newIncome = S.incomes.filter((item) => item.id === 'income-200').reduce((sum, item) => sum + item.amount, 0);
const newExpense = S.expenses.filter((item) => item.id === 'expense-200').reduce((sum, item) => sum + item.amount, 0);
assert.equal(newIncome, 200);
assert.equal(newExpense, 200);
assert.equal(newIncome - newExpense, 0);

// The observer is read-only and must never touch business master data.
const protectedAfter = JSON.stringify({
  company: S.company,
  customers: S.customers,
  vehicles: S.vehicles,
  invoices: S.invoices,
  settings: S.settings,
});
assert.equal(protectedAfter, protectedBefore);
assert.ok(dispatchedEvents >= 6, 'Window and document events must be announced');

console.log('Money native synchronization tests passed.');
