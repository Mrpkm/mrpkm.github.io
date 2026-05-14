// hudRenderer.js — Top HUD: doctrine, war-points, inventory, selected-unit panel,
// end-turn button. Reads exclusively from gameState. Never mutates state.

import { getState, subscribe } from '../state/gameState.js';

let _rootEl = null;
let _doctrineEl = null;
let _wpEl = null;
let _inventoryEl = null;
let _selectedEl = null;
let _endTurnBtn = null;
let _unsubscribe = null;

// mountHud(rootEl, { onEndTurn }) → unsubscribe function
// Builds the HUD DOM structure once, then updates content on every state change.
export function mountHud(rootEl, { onEndTurn } = {}) {
  _rootEl = rootEl;

  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }

  // Build skeleton once — only text content changes on re-render.
  rootEl.innerHTML = `
    <a class="hud-back" href="../src/menu/Strategy%20Game%20Menu.html">&#8592; HQ</a>
    <div class="hud-doctrine"></div>
    <div class="hud-wp"></div>
    <div class="hud-inventory"></div>
    <div class="hud-selected-panel"></div>
    <button class="hud-end-turn">END TURN</button>
  `;

  _doctrineEl  = rootEl.querySelector('.hud-doctrine');
  _wpEl        = rootEl.querySelector('.hud-wp');
  _inventoryEl = rootEl.querySelector('.hud-inventory');
  _selectedEl  = rootEl.querySelector('.hud-selected-panel');
  _endTurnBtn  = rootEl.querySelector('.hud-end-turn');

  _endTurnBtn.addEventListener('click', () => { if (onEndTurn) onEndTurn(); });

  _unsubscribe = subscribe(_render);

  // Render immediately if state already exists.
  try { _render(getState()); } catch (_) { /* not yet initialized — dialog will init */ }

  return _unsubscribe;
}

function _render(state) {
  const { doctrine, warPoints, inventory, selectedUnitId, units, legalMoves } = state;

  // Doctrine
  _doctrineEl.innerHTML = '<strong>' + doctrine.name + '</strong>' +
    (doctrine.alias ? ' <span class="hud-doctrine-alias">(' + doctrine.alias + ')</span>' : '');

  // War points: "23 / 25 · 2 left"
  _wpEl.textContent =
    warPoints.spent.total + ' / ' + warPoints.budget + ' · ' + warPoints.remaining + ' left';

  // Inventory chips
  _inventoryEl.innerHTML = Object.entries(inventory)
    .map(([type, count]) => '<span class="hud-chip">' + type + ' ×' + count + '</span>')
    .join('');

  // Selected-unit panel
  const sel = selectedUnitId ? units.find(u => u.id === selectedUnitId) : null;
  if (sel) {
    _selectedEl.textContent =
      sel.type +
      (sel.rank ? ' · ' + sel.rank : '') +
      ' @ ' + sel.row + ',' + sel.col +
      ' — ' + legalMoves.length + ' moves';
    _selectedEl.classList.add('visible');
  } else {
    _selectedEl.textContent = '';
    _selectedEl.classList.remove('visible');
  }
}
