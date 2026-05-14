// pathfinder.js — shared BFS pathfinder, canonical source.
// Exposed as window.Pathfinder so map-builder.jsx and future tools can import
// without duplicating logic.
//
// API:
//   Pathfinder.isWalkable(board, tiles, r, c, gridH, gridW) → boolean
//   Pathfinder.findPath(board, tiles, start, goal, gridH, gridW) → [{r,c}] | null
//
// board:  grid[r][c] = tile-index (-1 = empty)
// tiles:  array of tile defs; tile.walkable === false means impassable
// start/goal: {r, c}
// Returns null when no path exists; [] when start === goal.

(function () {
  'use strict';

  function isWalkable(board, tiles, r, c, gridH, gridW) {
    if (r < 0 || r >= gridH || c < 0 || c >= gridW) return false;
    const idx = (board[r] || [])[c];
    if (idx == null || idx < 0) return false;
    return tiles[idx]?.walkable !== false;
  }

  // BFS — 4-directional. Used for unit animation paths (visual only).
  function findPath(board, tiles, start, goal, gridH, gridW) {
    if (start.r === goal.r && start.c === goal.c) return [];
    if (!isWalkable(board, tiles, goal.r, goal.c, gridH, gridW)) return null;

    const visited = Array.from({ length: gridH }, () => new Uint8Array(gridW));
    const parent = new Map();
    visited[start.r][start.c] = 1;
    const queue = [start];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let head = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      if (cur.r === goal.r && cur.c === goal.c) {
        const path = [];
        let p = cur;
        let key = `${p.r},${p.c}`;
        while (!(p.r === start.r && p.c === start.c)) {
          path.unshift(p);
          p = parent.get(key);
          if (!p) break;
          key = `${p.r},${p.c}`;
        }
        return path;
      }
      for (const [dr, dc] of dirs) {
        const nr = cur.r + dr, nc = cur.c + dc;
        if (!isWalkable(board, tiles, nr, nc, gridH, gridW)) continue;
        if (visited[nr][nc]) continue;
        visited[nr][nc] = 1;
        parent.set(`${nr},${nc}`, cur);
        queue.push({ r: nr, c: nc });
      }
    }
    return null;
  }

  window.Pathfinder = { isWalkable, findPath };
})();
