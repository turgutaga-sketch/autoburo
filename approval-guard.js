/* AutoBüro approval gate v1 — additive only. No workshop data is modified. */
(function(){
  'use strict';
  if(window.__AUTOBURO_APPROVAL_GUARD__) return;
  window.__AUTOBURO_APPROVAL_GUARD__ = true;

  function cfg(){ return window.AUTOBURO_CONFIG || {}; }
  function client(){
    if(!window.supabase || !cfg().supabaseUrl || !cfg().supabaseKey) return null;
    return window.supabase.createClient(cfg().supabaseUrl, cfg().supabaseKey);
  }
  function overlay(status){
    var old=document.getElementById('autoburo-approval-overlay');
    if(old) old.remove();
    var box=document.createElement('div');
    box.id='autoburo-approval-overlay';
    box.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#f4f5f7;display:grid;place-items:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif';
    var title=status==='rejected'?'Zugang nicht freigegeben':'Freigabe wird geprüft';
    var text=status==='rejected'?'Bitte wenden Sie sich an AutoBüro.':'Ihre Registrierung ist angekommen. Sie können die Werkstattdaten erst nach der Freigabe öffnen.';
    box.innerHTML='<div style="width:min(520px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.10);text-align:center"><div style="width:54px;height:54px;border-radius:16px;background:#1F2A4D;color:#C9A227;display:grid;place-items:center;margin:0 auto 16px;font-weight:900">AB</div><h1 style="font-size:25px;margin:0 0 10px;color:#111827">'+title+'</h1><p style="color:#64748b;line-height:1.55;margin:0 0 18px">'+text+'</p><button id="autoburo-approval-logout" style="border:0;border-radius:12px;padding:11px 16px;background:#1F2A4D;color:#fff;font-weight:800">Abmelden</button></div>';
    document.body.appendChild(box);
  }

  async function run(){
    var sb=client();
    if(!sb) return;
    var sessionResult=await sb.auth.getSession();
    var session=sessionResult && sessionResult.data && sessionResult.data.session;
    if(!session) return;
    var result=await sb.rpc('autoburo_my_access_status');
    if(result.error){ console.error('AutoBüro approval check failed', result.error); return; }
    var state=result.data || {};
    if(state.approved) return;
    overlay(state.status || 'pending');
    var logout=document.getElementById('autoburo-approval-logout');
    if(logout) logout.addEventListener('click', async function(){ await sb.auth.signOut(); location.reload(); });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
