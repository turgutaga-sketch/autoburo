/* AutoBüro · Verbindung zur Datenbank */
window.AUTOBURO_CONFIG = {
  supabaseUrl: "https://vnlcniulwrtlvmchayln.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGNuaXVsd3J0bHZtY2hheWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc5MTQsImV4cCI6MjEwMDA0MzkxNH0.bsMZcNkyjjI2bP5eVf9lju44Utnrjhljz6F3cvYVC9U"
};

/* Einheitlicher Geldbereich: additiv, ohne Änderung bestehender Stammdaten. */
(() => {
  const loadNativeSync = () => {
    if (document.querySelector('script[data-autoburo-money-native-sync]')) return;
    const sync = document.createElement('script');
    sync.src = new URL('money-native-sync.js?v=1', document.baseURI).href;
    sync.defer = true;
    sync.dataset.autoburoMoneyNativeSync = 'true';
    document.head.appendChild(sync);
  };

  const existing = document.querySelector('script[data-autoburo-money-unified]');
  if (existing) {
    loadNativeSync();
    return;
  }

  const script = document.createElement('script');
  script.src = new URL('money-unified.js?v=1', document.baseURI).href;
  script.defer = true;
  script.dataset.autoburoMoneyUnified = 'true';
  script.addEventListener('load', loadNativeSync, { once: true });
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
