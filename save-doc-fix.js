/* AutoBüro · Dokument speichern – sichere Reparatur */
(() => {
  'use strict';
  if (globalThis.__AUTOBURO_SAVE_DOC_FIX__) return;
  globalThis.__AUTOBURO_SAVE_DOC_FIX__ = true;

  const value = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value ?? '').trim() : '';
  };

  const makeId = () => {
    try { if (typeof uid === 'function') return uid(); } catch {}
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  };

  const nextDocumentNumber = (type) => {
    try { if (typeof nextNo === 'function') return nextNo(type); } catch (error) { console.warn(error); }
    const year = new Date().getFullYear();
    const key = type === 'RE' ? 'nextRE' : type === 'AN' ? 'nextAN' : type === 'AU' ? 'nextAU' : 'nextGS';
    const current = Math.max(1, Number(S?.settings?.[key]) || 1);
    if (S?.settings) S.settings[key] = current + 1;
    return `${type}-${year}-${String(current).padStart(4, '0')}`;
  };

  const syncVisiblePositions = () => {
    if (!Array.isArray(globalThis.POS)) globalThis.POS = [];
    const table = document.getElementById('postbl');
    if (!table) return globalThis.POS;
    [...table.querySelectorAll('tr')].slice(1).forEach((row, index) => {
      const inputs = row.querySelectorAll('input');
      if (inputs.length < 4) return;
      if (!globalThis.POS[index]) globalThis.POS[index] = {};
      Object.assign(globalThis.POS[index], {
        desc: String(inputs[0].value || '').trim(),
        qty: inputs[1].value,
        price: inputs[2].value,
        vat: inputs[3].value,
      });
    });
    return globalThis.POS;
  };

  const install = () => {
    if (typeof S === 'undefined' || !S || !Array.isArray(S.docs)) return false;
    if (typeof save !== 'function' || typeof closeModal !== 'function') return false;

    globalThis.saveDoc = function safeSaveDoc(id = '') {
      const button = document.querySelector('button[onclick^="saveDoc("]');
      if (button?.dataset.saving === '1') return;

      const customerName = value('f_cn');
      if (!customerName) {
        alert('Bitte Name / Firma eintragen.');
        document.getElementById('f_cn')?.focus();
        return;
      }

      try {
        if (button) { button.dataset.saving = '1'; button.disabled = true; }
        const positions = syncVisiblePositions()
          .filter((position) => String(position?.desc || '').trim())
          .map((position) => ({ ...position, desc: String(position.desc).trim() }));

        const documentData = {
          date: value('f_d'), serviceDate: value('f_ld'), customerId: value('f_ck'), customerName,
          customerAddress: document.getElementById('f_ca')?.value || '',
          vehiclePlate: value('f_pl').toUpperCase(), remark: document.getElementById('f_r')?.value || '',
          discTyp: value('f_dt') || 'pct', discVal: value('f_dv'), pos: positions,
        };

        if (id) {
          const existing = S.docs.find((item) => String(item?.id) === String(id));
          if (!existing) throw new Error('Dokument wurde nicht gefunden.');
          Object.assign(existing, documentData);
        } else {
          const type = value('f_ty') || 'RE';
          S.docs.push({ id: makeId(), type, no: nextDocumentNumber(type), status: type === 'RE' ? 'offen' : '-', archived: false, ...documentData });
        }

        save();
        closeModal();
        try { if (typeof toast === 'function') toast(typeof t === 'function' ? t('gespeichert') : 'Gespeichert ✓'); } catch {}
        try { if (typeof render === 'function') render(); } catch {}
      } catch (error) {
        console.error('AutoBüro Dokument speichern:', error);
        alert(`Speichern nicht möglich: ${error?.message || error}`);
      } finally {
        if (button?.isConnected) { button.dataset.saving = '0'; button.disabled = false; }
      }
    };
    return true;
  };

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 120) clearInterval(timer);
  }, 100);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
