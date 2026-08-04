/* AutoBüro · Verbindung zur Datenbank */
window.AUTOBURO_CONFIG = {
  supabaseUrl: "https://vnlcniulwrtlvmchayln.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGNuaXVsd3J0bHZtY2hheWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc5MTQsImV4cCI6MjEwMDA0MzkxNH0.bsMZcNkyjjI2bP5eVf9lju44Utnrjhljz6F3cvYVC9U"
};

/* Start-Sicherung: der vorhandene volle Browserstand wird niemals durch einen leeren Start ersetzt. */
(() => {
  const stateKey = 'nwasb_buero_v1';
  const backupKey = 'nwasb_buero_autosafe_backup_v1';
  const collections = ['docs','customers','vehicles','incomes','expenses','appointments','debts','files','parts','suppliers'];
  const score = (state) => state && typeof state === 'object'
    ? collections.reduce((sum, key) => sum + (Array.isArray(state[key]) ? state[key].length : 0), 0)
    : 0;
  try {
    const raw = localStorage.getItem(stateKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    const currentScore = score(data);
    if (currentScore <= 0) return;
    const snapshot = { savedAt: new Date().toISOString(), origin: location.origin, score: currentScore, data };
    window.__AUTOBURO_PREFLIGHT_BACKUP__ = { ...snapshot, raw };
    try {
      const old = JSON.parse(localStorage.getItem(backupKey) || 'null');
      if (!old || currentScore >= Number(old.score || 0)) {
        localStorage.setItem(backupKey, JSON.stringify(snapshot));
      }
    } catch {
      localStorage.setItem(backupKey, JSON.stringify(snapshot));
    }
  } catch (error) {
    console.warn('AutoBüro Start-Sicherung konnte nicht dauerhaft gespeichert werden.', error);
  }
})();

/* Einheitlicher Geldbereich: additiv, ohne Änderung bestehender Stammdaten. */
(() => {
  if (document.querySelector('script[data-autoburo-money-unified]')) return;
  const script = document.createElement('script');
  script.src = new URL('money-unified.js?v=1', document.baseURI).href;
  script.defer = true;
  script.dataset.autoburoMoneyUnified = 'true';
  document.head.appendChild(script);
})();

/* Geld als normale AutoBüro-Seite: ausschließlich Darstellung und Navigation. */
(() => {
  if (document.querySelector('script[data-autoburo-money-page]')) return;
  const script = document.createElement('script');
  script.src = new URL('money-page-integration.js?v=1', document.baseURI).href;
  script.defer = true;
  script.dataset.autoburoMoneyPage = 'true';
  document.head.appendChild(script);
})();

/* Sicherer Web-Direktzugang: Cloud-Konto öffnet ohne zweite PIN-Abfrage. */
(() => {
  if (document.querySelector('script[data-autoburo-web-direct-safe]')) return;
  const script = document.createElement('script');
  script.src = new URL('web-direct-access-safe.js?v=1', document.baseURI).href;
  script.async = false;
  script.dataset.autoburoWebDirectSafe = 'true';
  document.head.appendChild(script);
})();
