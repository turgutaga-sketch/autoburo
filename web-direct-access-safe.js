/* AutoBüro · Sicherer Web-Direktzugang
 * Additive Schutzschicht für den bestehenden Account-/PIN-Start.
 * Schreibt oder löscht keine Kunden-, Fahrzeug- oder Rechnungsdatensätze.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'nwasb_buero_v1';
  const BACKUP_KEY = 'nwasb_buero_autosafe_backup_v1';
  const MODULE_FLAG = '__AUTOBURO_WEB_DIRECT_SAFE__';
  const COLLECTIONS = [
    'docs', 'customers', 'vehicles', 'incomes', 'expenses',
    'appointments', 'debts', 'files', 'parts', 'suppliers'
  ];

  if (globalThis[MODULE_FLAG]) return;
  globalThis[MODULE_FLAG] = true;

  let tenantWrapped = false;
  let tenantGate = null;
  let observer = null;
  let bootTimer = null;
  let opening = false;
  let recoveredAtBoot = false;

  const clone = (value) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  };

  const parseJson = (raw) => {
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  };

  const scoreState = (state) => {
    if (!state || typeof state !== 'object') return 0;
    return COLLECTIONS.reduce((total, key) => {
      return total + (Array.isArray(state[key]) ? state[key].length : 0);
    }, 0);
  };

  const normalizeState = (state) => {
    if (!state || typeof state !== 'object') return state;
    try {
      if (typeof defState === 'function') {
        const defaults = defState();
        Object.keys(defaults).forEach((key) => {
          if (state[key] === undefined) state[key] = clone(defaults[key]);
        });
        if (!state.settings || typeof state.settings !== 'object') state.settings = {};
        Object.keys(defaults.settings || {}).forEach((key) => {
          if (state.settings[key] === undefined) state.settings[key] = clone(defaults.settings[key]);
        });
      }
    } catch (error) {
      console.warn('AutoBüro Schutz: Standardfelder konnten nicht ergänzt werden.', error);
    }
    COLLECTIONS.forEach((key) => {
      if (!Array.isArray(state[key])) state[key] = [];
    });
    return state;
  };

  const readCurrentState = () => {
    try {
      if (typeof S !== 'undefined' && S && typeof S === 'object') return clone(S);
    } catch {
      // Globaler Zustand ist noch nicht bereit.
    }
    return parseJson(localStorage.getItem(STORAGE_KEY));
  };

  const readBackupState = () => {
    const memory = globalThis.__AUTOBURO_PREFLIGHT_BACKUP__;
    if (memory && typeof memory === 'object') {
      const fromMemory = memory.data || parseJson(memory.raw || '');
      if (scoreState(fromMemory) > 0) return clone(fromMemory);
    }
    const stored = parseJson(localStorage.getItem(BACKUP_KEY));
    if (stored && scoreState(stored.data) > 0) return clone(stored.data);
    return null;
  };

  const writeStateSafely = (state) => {
    const copy = normalizeState(clone(state));
    if (!copy || scoreState(copy) <= 0) return false;
    try {
      S = copy;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
      return true;
    } catch (error) {
      console.error('AutoBüro Schutz: Sicherungsstand konnte nicht wiederhergestellt werden.', error);
      return false;
    }
  };

  const recoverIfEmpty = () => {
    const current = readCurrentState();
    if (scoreState(current) > 0) return false;
    const backup = readBackupState();
    if (scoreState(backup) <= 0) return false;
    const restored = writeStateSafely(backup);
    if (restored) {
      recoveredAtBoot = true;
      console.info('AutoBüro Schutz: Voller lokaler Stand wurde aus der Sicherung wiederhergestellt.');
    }
    return restored;
  };

  const installSafeCounter = () => {
    try {
      countOf = function safeCountOf(state) {
        return scoreState(state);
      };
    } catch {
      // countOf ist möglicherweise noch nicht definiert; der nächste Poll versucht es erneut.
    }
  };

  const installTenantGuard = () => {
    if (tenantWrapped || typeof tenantOpen !== 'function') return false;
    const originalTenantOpen = tenantOpen;

    tenantOpen = function guardedTenantOpen(...args) {
      if (tenantGate) return tenantGate;
      tenantGate = (async () => {
        const before = readCurrentState();
        const backup = readBackupState();
        const strongestBefore = scoreState(before) >= scoreState(backup) ? before : backup;
        let result;

        try {
          try {
            result = await originalTenantOpen.apply(this, args);
          } catch (error) {
            if (String(error && error.message) === 'session' && typeof accRefresh === 'function') {
              const refreshed = await accRefresh();
              if (refreshed) result = await originalTenantOpen.apply(this, args);
              else throw error;
            } else {
              throw error;
            }
          }

          const after = readCurrentState();
          if (scoreState(after) === 0 && scoreState(strongestBefore) > 0) {
            writeStateSafely(strongestBefore);
            recoveredAtBoot = true;
          }

          const finalState = readCurrentState();
          if (scoreState(finalState) > 0 && typeof tenantPush === 'function') {
            try {
              await Promise.resolve(tenantPush(true));
            } catch (pushError) {
              console.warn('AutoBüro Schutz: Cloud-Sicherung wird später erneut versucht.', pushError);
            }
          }
          return result;
        } finally {
          tenantGate = null;
        }
      })();
      return tenantGate;
    };

    tenantWrapped = true;
    return true;
  };

  const cloudAccountAvailable = () => {
    try {
      return !!(typeof ACC !== 'undefined' && ACC && (ACC.token || ACC.refresh || ACC.uid));
    } catch {
      return false;
    }
  };

  const chooseDirectUser = () => {
    const state = readCurrentState();
    const users = Array.isArray(state && state.settings && state.settings.users)
      ? state.settings.users
      : [];
    const user = users.find((item) => item && item.role === 'chef') || users[0];
    if (user) {
      return {
        uid: String(user.id || 'cloud-chef'),
        name: String(user.name || 'Chef'),
        role: String(user.role || 'chef')
      };
    }
    let email = '';
    try {
      email = String((ACC && ACC.email) || 'Chef');
    } catch {
      email = 'Chef';
    }
    return { uid: 'cloud-chef', name: email || 'Chef', role: 'chef' };
  };

  const enterDashboard = () => {
    const user = chooseDirectUser();
    try {
      AUTH = user;
      sessionStorage.setItem('nb_auth', JSON.stringify(user));
    } catch (error) {
      console.warn('AutoBüro Schutz: Sitzung konnte nicht gespeichert werden.', error);
    }

    document.getElementById('acc')?.remove();
    document.getElementById('lock')?.remove();

    try {
      const target = typeof defaultPage === 'function' ? defaultPage() : 'start';
      if (typeof go === 'function') go(target);
      else if (typeof render === 'function') render();
    } catch (error) {
      console.error('AutoBüro Schutz: Dashboard konnte nicht geöffnet werden.', error);
    }
  };

  const openCloudAccountDirectly = async () => {
    if (opening || !cloudAccountAvailable()) return false;
    if (typeof tenantOpen !== 'function') return false;
    opening = true;

    try {
      recoverIfEmpty();
      installSafeCounter();
      installTenantGuard();
      await tenantOpen();

      if (!cloudAccountAvailable()) {
        document.getElementById('lock')?.remove();
        if (typeof showAcc === 'function') showAcc();
        return false;
      }

      recoverIfEmpty();
      enterDashboard();
      return true;
    } catch (error) {
      console.warn('AutoBüro Schutz: Cloud-Zugang ist noch nicht bereit.', error);
      if (!cloudAccountAvailable()) {
        document.getElementById('lock')?.remove();
        if (typeof showAcc === 'function') showAcc();
      }
      return false;
    } finally {
      opening = false;
    }
  };

  const observeLoginLayers = () => {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(() => {
      if (cloudAccountAvailable() && (document.getElementById('lock') || document.getElementById('acc'))) {
        clearTimeout(bootTimer);
        bootTimer = setTimeout(openCloudAccountDirectly, 50);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  const ready = () => {
    return typeof S !== 'undefined'
      && typeof tenantOpen === 'function'
      && typeof render === 'function';
  };

  const boot = () => {
    recoverIfEmpty();
    observeLoginLayers();

    let attempts = 0;
    const poll = setInterval(() => {
      attempts += 1;
      recoverIfEmpty();
      installSafeCounter();
      installTenantGuard();

      if (ready()) {
        clearInterval(poll);
        if (cloudAccountAvailable()) openCloudAccountDirectly();
      } else if (attempts >= 240) {
        clearInterval(poll);
        console.warn('AutoBüro Schutz: Startmodule wurden nicht rechtzeitig gefunden.');
      }
    }, 50);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
