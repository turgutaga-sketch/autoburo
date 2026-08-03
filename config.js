/* WERK ONE · Verbindung zur Datenbank */
window.AUTOBURO_CONFIG = {
  supabaseUrl: "https://vnlcniulwrtlvmchayln.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubGNuaXVsd3J0bHZtY2hheWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0Njc5MTQsImV4cCI6MjEwMDA0MzkxNH0.bsMZcNkyjjI2bP5eVf9lju44Utnrjhljz6F3cvYVC9U",
  analyticsEnabled: true
};

/* Backward-compatible alias: existing application code keeps working. */
window.WERKONE_CONFIG = window.AUTOBURO_CONFIG;

/* Additive loader: leaves index.html and all existing application logic untouched. */
(function loadWerkOneAnalytics() {
  if (document.querySelector('script[data-werkone-analytics]')) return;
  var script = document.createElement('script');
  script.src = 'analytics.js';
  script.defer = true;
  script.setAttribute('data-werkone-analytics', 'v1');
  document.head.appendChild(script);
})();
