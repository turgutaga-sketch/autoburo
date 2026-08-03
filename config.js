/* AutoBüro · Verbindung zur Datenbank */
window.AUTOBURO_CONFIG = {
  supabaseUrl: "https://vnlcniulwrtlvmchayln.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGNuaXVsd3J0bHZtY2hheWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc5MTQsImV4cCI6MjEwMDA0MzkxNH0.bsMZcNkyjjI2bP5eVf9lju44Utnrjhljz6F3cvYVC9U"
};

/* Sicherer Geldbereich: lädt separat und verändert keine bestehenden Datensätze. */
(() => {
  const loadSummaryFix = () => {
    if (document.querySelector('script[data-autoburo-money-summary-fix]')) return;
    const summaryFix = document.createElement('script');
    summaryFix.src = new URL('money-summary-fix.js?v=1', document.baseURI).href;
    summaryFix.defer = true;
    summaryFix.dataset.autoburoMoneySummaryFix = 'true';
    document.head.appendChild(summaryFix);
  };

  const loadFix = () => {
    const existingFix = document.querySelector('script[data-autoburo-money-fix]');
    if (existingFix) {
      loadSummaryFix();
      return;
    }

    const fix = document.createElement('script');
    fix.src = new URL('money-fix.js?v=2', document.baseURI).href;
    fix.defer = true;
    fix.dataset.autoburoMoneyFix = 'true';
    fix.addEventListener('load', loadSummaryFix, { once: true });
    document.head.appendChild(fix);
  };

  const existing = document.querySelector('script[data-autoburo-money-module]');
  if (existing) {
    loadFix();
    return;
  }

  const script = document.createElement('script');
  script.src = new URL('money-section.js?v=3', document.baseURI).href;
  script.defer = true;
  script.dataset.autoburoMoneyModule = 'true';
  script.addEventListener('load', loadFix, { once: true });
  document.head.appendChild(script);
})();
