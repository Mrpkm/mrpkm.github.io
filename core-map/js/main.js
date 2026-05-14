(function () {
  'use strict';

  var mapRootEl     = document.getElementById('map-root');
  var minimapRootEl = document.getElementById('minimap-root');
  var deskView      = document.getElementById('desk-view');
  var mapView       = document.getElementById('map-view');
  var hintEl        = document.getElementById('hint');

  var _builtVersion = -1;
  var _unsubMap     = null;
  var _unsubUnits   = null;
  var _unsubMinimap = null;

  function _showMapView() {
    deskView.style.display = 'none';
    mapView.classList.add('active');
    if (hintEl) hintEl.classList.add('fade');
  }

  function _showDeskView() {
    mapView.classList.remove('active');
    deskView.style.display = '';
    if (hintEl) hintEl.classList.remove('fade');
  }

  window.GameState.subscribe(function (state) {
    if (state.version !== _builtVersion) {
      if (_unsubMap)     _unsubMap();
      if (_unsubUnits)   _unsubUnits();
      if (_unsubMinimap) _unsubMinimap();

      mapRootEl.innerHTML     = '';
      minimapRootEl.innerHTML = '';

      _unsubMap     = window.MapRenderer.mountMap(mapRootEl);
      _unsubUnits   = window.UnitRenderer.mountUnits(mapRootEl);
      _unsubMinimap = window.MinimapRenderer.mountMinimap(minimapRootEl);

      _showMapView();
      _builtVersion = state.version;
    }

    window.Dossier.render(state);
  });

  window.Selection.attachSelection(mapRootEl);
  window.Input.attachInput();
  if (window.AIAgentsBridge) window.AIAgentsBridge.connect();

  var btnClear = document.getElementById('btn-clear');
  if (btnClear) {
    btnClear.addEventListener('click', function () { _showDeskView(); });
  }

  var btnSetup = document.getElementById('btn-setup');
  if (btnSetup) {
    btnSetup.addEventListener('click', function () {
      window.location.href = '../src/tools/pregame-setup.html';
    });
  }

  var btnRules = document.getElementById('btn-rules');
  if (btnRules) {
    btnRules.addEventListener('click', function () {
      window.open('../docs/rules/game_core.md', '_blank');
    });
  }
})();
