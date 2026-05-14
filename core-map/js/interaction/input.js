(function () {
  'use strict';

  function attachInput(opts) {
    const onLoad  = (opts && opts.onLoad) || null;
    const textarea = document.getElementById('paste-textarea');
    const btnLoad  = document.getElementById('btn-load');
    const errorEl  = document.getElementById('parse-error');

    if (!btnLoad) throw new Error('attachInput: #btn-load not found');

    btnLoad.addEventListener('click', function() {
      const code = textarea.value.trim();
      if (!code) return;
      errorEl.textContent = '';
      try {
        const parsed = window.Parser.parsePreGameCode(code);
        window.GameState.initState(parsed);
        try { localStorage.setItem('last_briefing', code); } catch (_) {}
        if (window.OrchestrationBridge) window.OrchestrationBridge.initSession(parsed);
        if (onLoad) onLoad();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });

    window.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        try { window.GameState.selectUnit(null); } catch (_) {}
      }
    });
  }

  window.Input = { attachInput: attachInput };
})();
