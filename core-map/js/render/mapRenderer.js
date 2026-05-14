(function () {
  'use strict';

  let _cellEls = null;
  let _unsubscribe = null;

  function mountMap(rootEl) {
    _cellEls = {};
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

    const state = window.GameState.getState();
    const frag = document.createDocumentFragment();
    state.grid.cells.forEach(function(cell) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.row   = cell.row;
      el.dataset.col   = cell.col;
      el.dataset.biome = cell.biome;
      _cellEls[cell.row + ',' + cell.col] = el;
      frag.appendChild(el);
    });
    rootEl.appendChild(frag);

    _unsubscribe = window.GameState.subscribe(_onStateChange);
    return _unsubscribe;
  }

  function getCellEl(row, col) {
    return _cellEls ? _cellEls[row + ',' + col] : undefined;
  }

  function _onStateChange(state) {
    if (!_cellEls) return;
    // 2-player mode controls its own highlights
    if (window.TwoPlayerMode && window.TwoPlayerMode.isActive()) return;
    const legalSet = {};
    const attackSet = {};
    state.legalMoves.forEach(function(m) { legalSet[m.row + ',' + m.col] = true; });
    (state.attackTargets || []).forEach(function(t) { attackSet[t.row + ',' + t.col] = true; });
    Object.keys(_cellEls).forEach(function(key) {
      _cellEls[key].classList.toggle('legal-move', !!legalSet[key]);
      _cellEls[key].classList.toggle('attack-target', !!attackSet[key]);
    });
  }

  window.MapRenderer = { mountMap: mountMap, getCellEl: getCellEl };
})();
