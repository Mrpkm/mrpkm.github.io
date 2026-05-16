(function () {
  'use strict';

  var _cells = null;
  var _unsubscribe = null;

  function mountMinimap(rootEl) {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _cells = {};

    var state = window.GameState.getState();
    rootEl.style.setProperty('--mm-rows', state.grid.rows);
    rootEl.style.setProperty('--mm-cols', state.grid.cols);
    rootEl.innerHTML = '';

    var frag = document.createDocumentFragment();
    state.grid.cells.forEach(function (cell) {
      var el = document.createElement('div');
      el.className = 'mm-cell';
      el.dataset.biome = cell.biome;
      el.dataset.row = cell.row;
      el.dataset.col = cell.col;
      _cells[cell.row + ',' + cell.col] = el;
      frag.appendChild(el);
    });
    rootEl.appendChild(frag);

    _unsubscribe = window.GameState.subscribe(function (s) { _update(s); });
    _update(state);
    return _unsubscribe;
  }

  function _update(state) {
    if (!_cells) return;

    var legalSet = {};
    var attackSet = {};
    state.legalMoves.forEach(function (m) { legalSet[m.row + ',' + m.col] = true; });
    (state.attackTargets || []).forEach(function (t) { attackSet[t.row + ',' + t.col] = true; });

    Object.keys(_cells).forEach(function (key) {
      var el = _cells[key];
      el.classList.toggle('mm-legal', !!legalSet[key]);
      el.classList.toggle('mm-attack', !!attackSet[key]);
      el.classList.remove('mm-has-p1', 'mm-has-p2');
      var old = el.querySelector('.mm-unit');
      if (old) el.removeChild(old);
    });

    state.units.forEach(function (u) {
      var key = u.row + ',' + u.col;
      var cellEl = _cells[key];
      if (!cellEl) return;
      var isAi = u.owner === 'ai';
      cellEl.classList.add(isAi ? 'mm-has-p2' : 'mm-has-p1');
      var dot = document.createElement('div');
      dot.className = 'mm-unit' + (u.id === state.selectedUnitId ? ' mm-selected' : '');
      dot.style.background = isAi ? '#cc4040' : '#3a7acc';
      cellEl.appendChild(dot);
    });

    var ovCoords = document.getElementById('ov-coords');
    if (ovCoords) {
      var p1 = state.units.filter(function (u) { return u.owner !== 'ai'; }).length;
      var ai = state.units.filter(function (u) { return u.owner === 'ai'; }).length;
      ovCoords.textContent = state.units.length > 0 ? 'YOU ' + p1 + ' · AI ' + ai : '—';
    }
  }

  window.MinimapRenderer = { mountMinimap: mountMinimap };
})();
