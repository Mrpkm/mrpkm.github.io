(function () {
  'use strict';

  // Biome letter → terrain index used by unit-movement.js
  // T_GRASS=0, T_SWAMP=1, T_FOREST=2, T_MOUNTAIN=3  (unit-movement.js line 21)
  const BIOME_TO_TERRAIN = { P: 0, S: 1, F: 2, M: 3 };

  function _buildTerrainGrid(grid) {
    const terrain = [];
    for (let r = 0; r < grid.rows; r++) terrain[r] = new Int8Array(grid.cols);
    grid.cells.forEach(function(cell) {
      terrain[cell.row - 1][cell.col - 1] = BIOME_TO_TERRAIN[cell.biome] || 0;
    });
    return terrain;
  }

  function _buildOccupiedCells(units, excludeId) {
    const set = new Set();
    units.forEach(function(u) {
      if (u.id !== excludeId) set.add((u.row - 1) + ',' + (u.col - 1));
    });
    return set;
  }

  function getLegalMoves(unitId, state) {
    if (typeof window.UnitMovement === 'undefined') {
      throw new Error('engineBridge: window.UnitMovement not loaded');
    }
    const unit = state.units.find(function(u) { return u.id === unitId; });
    if (!unit) throw new Error('engineBridge.getLegalMoves: unknown unit "' + unitId + '"');

    const grid     = _buildTerrainGrid(state.grid);
    const pos      = { r: unit.row - 1, c: unit.col - 1 };
    const unitType = unit.type.toLowerCase();
    const doctrine = state.doctrine.name.toLowerCase();
    const occupied = _buildOccupiedCells(state.units, unitId);
    const level    = unit.level || 1;

    const reachable = window.UnitMovement.computeReachableTiles(
      grid, state.grid.rows, state.grid.cols, pos, unitType, doctrine, occupied, level
    );

    return Array.from(reachable).map(function(key) {
      const parts = key.split(',');
      return { row: parseInt(parts[0]) + 1, col: parseInt(parts[1]) + 1 };
    });
  }

  function endTurn() { return {}; }

  window.EngineBridge = { getLegalMoves: getLegalMoves, endTurn: endTurn };
})();
