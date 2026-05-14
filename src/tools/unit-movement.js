// unit-movement.js — computes reachable tiles per unit type per game spec.
// Exposed as window.UnitMovement.
//
// Movement model (game_core.md §1.4, units_and_entities.md §2.3–2.5):
//   - Jump-based: only the DESTINATION tile is checked for terrain restrictions.
//     Intermediate tiles do not block the jump.
//   - Each unit has separate ortho and diag movement ranges.
//   - Cavalry uses Chebyshev distance (2 in every direction = full 5×5 footprint).
//   - Terrain at destination can REDUCE effective range by a penalty.
//   - Some units cannot enter certain terrain types at all.
//
// API:
//   UnitMovement.computeReachableTiles(grid, gridH, gridW, pos, unitType, doctrine, occupiedCells)
//     → Set<"r,c">
//   UnitMovement.getMoveDef(unitType, doctrine) → { orthoRange, diagRange, cavalryRange? }

(function () {
  'use strict';

  // Terrain indices — must match TERRAINS array order in map-builder.jsx
  const T_GRASS = 0, T_SWAMP = 1, T_FOREST = 2, T_MOUNTAIN = 3;

  // Terrain movement penalty when landing on that tile type (units_and_entities.md §2.5)
  const TERRAIN_PENALTY = [
    /* grass    */ 0,
    /* swamp    */ 1,
    /* forest   */ 1,
    /* mountain */ 0,  // no range penalty; entry is restricted per unit type instead
  ];

  // Which terrain indices each unit type may enter
  const CAN_ENTER = {
    infantry:  new Set([T_GRASS, T_SWAMP, T_FOREST, T_MOUNTAIN]),
    cavalry:   new Set([T_GRASS, T_SWAMP, T_FOREST, T_MOUNTAIN]),
    tanks:     new Set([T_GRASS, T_SWAMP, T_FOREST]),  // no mountains
    motorized: new Set([T_GRASS, T_SWAMP, T_FOREST]),  // no mountains
    artillery: new Set([T_GRASS, T_SWAMP]),             // no forest, no mountains
  };

  // Base movement definitions (units_and_entities.md §2.1, §2.2)
  // cavalry uses cavalryRange (Chebyshev); others use orthoRange + diagRange (pure axes only).
  const BASE_DEFS = {
    infantry:  { orthoRange: 2, diagRange: 1 },
    cavalry:   { cavalryRange: 2 },
    tanks:     { orthoRange: 3, diagRange: 0 },   // overridden per doctrine
    motorized: { orthoRange: 3, diagRange: 2 },
    artillery: { orthoRange: 1, diagRange: 1 },
  };

  function getMoveDef(unitType, doctrine) {
    const base = Object.assign({}, BASE_DEFS[unitType] || BASE_DEFS.infantry);
    if (unitType === 'tanks') {
      // Doctrine overrides (units_and_entities.md §8.3–8.5, game_core.md decisions #27,28,48)
      if (doctrine === 'blitzkrieg') { base.orthoRange = 4; base.diagRange = 0; }
      else if (doctrine === 'sf')   { base.orthoRange = 2; base.diagRange = 1; }
      else                           { base.orthoRange = 2; base.diagRange = 0; } // plain
    }
    // Cavalry level-2 bonus (+2 movement) handled elsewhere (not yet a builder concern)
    return base;
  }

  /**
   * Returns the set of tiles reachable in one move action.
   *
   * @param {Int8Array[]} grid   - grid[r][c] = terrain index (-1 = empty)
   * @param {number}      gridH
   * @param {number}      gridW
   * @param {{r,c}}       pos    - unit's current grid cell
   * @param {string}      unitType
   * @param {string}      doctrine  - 'plain' | 'blitzkrieg' | 'sf'
   * @param {Set<string>} occupiedCells - "r,c" keys blocked by other units
   * @returns {Set<string>}
   */
  function computeReachableTiles(grid, gridH, gridW, pos, unitType, doctrine, occupiedCells) {
    const def = getMoveDef(unitType, doctrine);
    const allowed = CAN_ENTER[unitType] || new Set([T_GRASS]);
    const reachable = new Set();
    const { r: sr, c: sc } = pos;

    const srcTerrain = grid[sr]?.[sc] ?? -1;
    // Artillery on swamp is neutralised: effective range = 1 - 1 = 0 (spec §2.5.2)
    if (unitType === 'artillery' && srcTerrain === T_SWAMP) return reachable;

    function tryAdd(nr, nc, cost) {
      if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) return;
      const t = grid[nr]?.[nc] ?? -1;
      if (t < 0 || !allowed.has(t)) return;
      const key = `${nr},${nc}`;
      if (occupiedCells?.has(key)) return;
      const penalty = TERRAIN_PENALTY[t] ?? 0;
      // Reachable when: cost + penalty ≤ effective range
      // Since range is already encoded in `cost` (step index), we check:
      // the tile is reachable if range - cost - penalty ≥ 0, i.e. cost + penalty ≤ range.
      // `cost` here equals the number of steps from origin (ortho or cheby).
      // We re-derive effective range from def inside each branch.
      return { key, penalty };
    }

    // ── Cavalry: Chebyshev distance ────────────────────────────────────────
    if (def.cavalryRange != null) {
      const R = def.cavalryRange;
      for (let dr = -R; dr <= R; dr++) {
        for (let dc = -R; dc <= R; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = sr + dr, nc = sc + dc;
          if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) continue;
          const t = grid[nr]?.[nc] ?? -1;
          if (t < 0 || !allowed.has(t)) continue;
          const key = `${nr},${nc}`;
          if (occupiedCells?.has(key)) continue;
          const dist = Math.max(Math.abs(dr), Math.abs(dc)); // Chebyshev
          const penalty = TERRAIN_PENALTY[t] ?? 0;
          if (dist + penalty <= R) reachable.add(key);
        }
      }
      return reachable;
    }

    // ── Pure-ortho axes ────────────────────────────────────────────────────
    if (def.orthoRange > 0) {
      const R = def.orthoRange;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (let step = 1; step <= R; step++) {
          const nr = sr + dr * step, nc = sc + dc * step;
          if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) break;
          const t = grid[nr]?.[nc] ?? -1;
          // Under jump-based movement only the destination matters for terrain checks.
          // Non-enterable intermediate tiles do NOT break the scan; skip and continue.
          if (t < 0 || !allowed.has(t)) continue;
          const key = `${nr},${nc}`;
          if (occupiedCells?.has(key)) continue;
          const penalty = TERRAIN_PENALTY[t] ?? 0;
          if (step + penalty <= R) reachable.add(key);
        }
      }
    }

    // ── Pure-diagonal axes ─────────────────────────────────────────────────
    if (def.diagRange > 0) {
      const R = def.diagRange;
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        for (let step = 1; step <= R; step++) {
          const nr = sr + dr * step, nc = sc + dc * step;
          if (nr < 0 || nr >= gridH || nc < 0 || nc >= gridW) break;
          const t = grid[nr]?.[nc] ?? -1;
          if (t < 0 || !allowed.has(t)) continue;
          const key = `${nr},${nc}`;
          if (occupiedCells?.has(key)) continue;
          const penalty = TERRAIN_PENALTY[t] ?? 0;
          if (step + penalty <= R) reachable.add(key);
        }
      }
    }

    return reachable;
  }

  window.UnitMovement = { computeReachableTiles, getMoveDef, BASE_DEFS, TERRAIN_PENALTY };
})();
