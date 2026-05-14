(function () {
  'use strict';

  let _state = null;
  const _listeners = [];

  function _deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    Object.values(obj).forEach(_deepFreeze);
    return obj;
  }

  function _notify() {
    const snapshot = getState();
    _listeners.slice().forEach(function(fn) { fn(snapshot); });
  }

  function initState(parsed) {
    const prevVersion = _state ? _state.version : 0;
    _state = {
      version:        prevVersion + 1,
      doctrine:       parsed.doctrine,
      warPoints:      parsed.warPoints,
      inventory:      parsed.inventory,
      bonuses:        parsed.bonuses,
      grid:           parsed.grid,
      units:          parsed.units.map(function(u) { return Object.assign({}, u); }),
      selectedUnitId: null,
      legalMoves:     [],
      attackTargets:  [],
      lastCombat:     null,
      bridge:         null,
    };
    _notify();
  }

  function getState() {
    if (!_state) throw new Error('gameState.getState: not initialized — call initState() first');
    return _deepFreeze(JSON.parse(JSON.stringify(_state)));
  }

  function subscribe(listener) {
    _listeners.push(listener);
    return function() {
      const idx = _listeners.indexOf(listener);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }

  function selectUnit(unitId) {
    if (!_state) throw new Error('gameState.selectUnit: not initialized');
    if (unitId !== null && !_state.units.some(function(u) { return u.id === unitId; })) {
      throw new Error('gameState.selectUnit: unknown unit id "' + unitId + '"');
    }
    _state.selectedUnitId = unitId;
    _state.legalMoves = [];
    _state.attackTargets = [];
    _notify();
  }

  function setLegalMoves(moves) {
    if (!_state) throw new Error('gameState.setLegalMoves: not initialized');
    _state.legalMoves = moves.map(function(m) { return { row: m.row, col: m.col }; });
    _notify();
  }

  function setAttackTargets(targets) {
    if (!_state) throw new Error('gameState.setAttackTargets: not initialized');
    _state.attackTargets = (targets || []).map(function(t) {
      return {
        unitId: t.unitId,
        row: t.position ? t.position.row : t.row,
        col: t.position ? t.position.col : t.col,
        direction: t.direction || 'front',
        type: t.type || null,
        currentHp: t.currentHp
      };
    });
    _notify();
  }

  function setLastCombat(result) {
    if (!_state) throw new Error('gameState.setLastCombat: not initialized');
    _state.lastCombat = result || null;
    _notify();
  }

  function moveUnit(unitId, toRow, toCol) {
    if (!_state) throw new Error('gameState.moveUnit: not initialized');
    const unit = _state.units.find(function(u) { return u.id === unitId; });
    if (!unit) throw new Error('gameState.moveUnit: unknown unit id "' + unitId + '"');
    const isLegal = _state.legalMoves.some(function(m) { return m.row === toRow && m.col === toCol; });
    if (!isLegal) throw new Error('gameState.moveUnit: ' + toRow + ',' + toCol + ' is not a legal destination');
    unit.row = toRow;
    unit.col = toCol;
    _state.selectedUnitId = null;
    _state.legalMoves = [];
    _state.attackTargets = [];
    _notify();
  }

  function syncFromBridgeState(payload) {
    if (!_state) throw new Error('gameState.syncFromBridgeState: not initialized');
    _state.units = (payload.units || []).map(function(u) { return Object.assign({}, u); });
    _state.bridge = payload.bridge || null;
    _state.selectedUnitId = null;
    _state.legalMoves = [];
    _state.attackTargets = [];
    _notify();
  }

  window.GameState = {
    initState:    initState,
    getState:     getState,
    subscribe:    subscribe,
    selectUnit:   selectUnit,
    setLegalMoves: setLegalMoves,
    setAttackTargets: setAttackTargets,
    setLastCombat: setLastCombat,
    moveUnit:     moveUnit,
    syncFromBridgeState: syncFromBridgeState,
  };
})();
