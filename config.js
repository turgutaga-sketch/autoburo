/* AutoBüro · Verbindung zur Datenbank */
window.AUTOBURO_CONFIG = {
  supabaseUrl: "https://vnlcniulwrtlvmchayln.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGNuaXVsd3J0bHZtY2hheWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc5MTQsImV4cCI6MjEwMDA0MzkxNH0.bsMZcNkyjjI2bP5eVf9lju44Utnrjhljz6F3cvYVC9U"
};

/* Sicherer Geldbereich: lädt separat und verändert keine bestehenden Datensätze. */
(() => {
  if (document.querySelector('script[data-autoburo-money-module]')) return;
  const script = document.createElement('script');
  script.src = new URL('money-section.js?v=1', document.baseURI).href;
  script.defer = true;
  script.dataset.autoburoMoneyModule = 'true';
  document.head.appendChild(script);
})();
