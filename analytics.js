/* WERK ONE · Privacy-safe product analytics
 * Collects only technical usage events. No customer, vehicle, invoice,
 * bank, document or free-text content is collected.
 */
(function () {
  'use strict';

  const cfg = window.WERKONE_CONFIG || window.AUTOBURO_CONFIG || {};
  const endpoint = cfg.supabaseUrl;
  const anonKey = cfg.supabaseKey;
  const enabled = cfg.analyticsEnabled !== false;
  const queueKey = 'werkone_analytics_queue_v1';
  const sessionKey = 'werkone_analytics_session_v1';

  if (!enabled || !endpoint || !anonKey) return;

  const forbiddenKeys = /name|email|phone|iban|bank|plate|vin|fahrgestell|customer|kunde|invoice|rechnung|document|message|note|text|address/i;

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getSessionId() {
    let id = sessionStorage.getItem(sessionKey);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(sessionKey, id);
    }
    return id;
  }

  function deviceType() {
    const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    if (width < 768) return 'mobile';
    if (width < 1100) return 'tablet';
    return 'desktop';
  }

  function safeMetadata(input) {
    const output = {};
    if (!input || typeof input !== 'object') return output;
    Object.keys(input).slice(0, 12).forEach(function (key) {
      if (forbiddenKeys.test(key)) return;
      const value = input[key];
      if (['string', 'number', 'boolean'].includes(typeof value)) {
        const stringValue = String(value);
        output[key] = stringValue.length > 80 ? stringValue.slice(0, 80) : value;
      }
    });
    return output;
  }

  function currentModule() {
    const hash = (location.hash || '').replace(/^#\/?/, '').split(/[/?]/)[0];
    if (hash) return hash.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50) || 'dashboard';
    const page = location.pathname.split('/').pop() || 'index.html';
    return page.replace(/\.html?$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50) || 'dashboard';
  }

  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(queueKey) || '[]'); }
    catch (_) { return []; }
  }

  function saveQueue(queue) {
    localStorage.setItem(queueKey, JSON.stringify(queue.slice(-200)));
  }

  async function send(event) {
    const response = await fetch(endpoint.replace(/\/$/, '') + '/rest/v1/product_events', {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(event),
      keepalive: true
    });
    if (!response.ok) throw new Error('analytics_http_' + response.status);
  }

  async function flushQueue() {
    if (!navigator.onLine) return;
    const queue = loadQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const event of queue) {
      try { await send(event); }
      catch (_) { remaining.push(event); }
    }
    saveQueue(remaining);
  }

  function track(eventName, metadata) {
    const cleanName = String(eventName || '').toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 80);
    if (!cleanName) return;

    const event = {
      event_name: cleanName,
      module_name: currentModule(),
      session_id: getSessionId(),
      device_type: deviceType(),
      success: metadata && typeof metadata.success === 'boolean' ? metadata.success : null,
      duration_ms: metadata && Number.isFinite(metadata.duration_ms) ? Math.max(0, Math.round(metadata.duration_ms)) : null,
      metadata: safeMetadata(metadata),
      occurred_at: new Date().toISOString()
    };

    send(event).catch(function () {
      const queue = loadQueue();
      queue.push(event);
      saveQueue(queue);
    });
  }

  window.WERKONE_ANALYTICS = Object.freeze({ track: track, flush: flushQueue });

  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-werkone-event]');
    if (!target) return;
    track(target.getAttribute('data-werkone-event'), {
      module: target.getAttribute('data-werkone-module') || currentModule()
    });
  }, { passive: true });

  let lastModule = '';
  function trackPage() {
    const module = currentModule();
    if (module === lastModule) return;
    lastModule = module;
    track('page_view', { module: module });
  }

  window.addEventListener('hashchange', trackPage);
  window.addEventListener('online', flushQueue);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') flushQueue();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPage, { once: true });
  } else {
    trackPage();
  }
  flushQueue();
})();
