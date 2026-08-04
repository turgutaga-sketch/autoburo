/* AutoBüro · Verbindung zur Datenbank */
window.AUTOBURO_CONFIG = {
  supabaseUrl: "https://vnlcniulwrtlvmchayln.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGNuaXVsd3J0bHZtY2hheWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc5MTQsImV4cCI6MjEwMDA0MzkxNH0.bsMZcNkyjjI2bP5eVf9lju44Utnrjhljz6F3cvYVC9U"
};

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
