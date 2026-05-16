(function () {
  'use strict';

  let _units = {};   // unitId → HTMLElement
  let _unsubscribe = null;

  function mountUnits(mapRootEl) {
    _units = {};
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }

    const state = window.GameState.getState();
    state.units.forEach(function(unit) {
      const el = _buildUnitEl(unit);
      _units[unit.id] = el;
      const cellEl = window.MapRenderer.getCellEl(unit.row, unit.col);
      if (!cellEl) throw new Error('unitRenderer: no cell at ' + unit.row + ',' + unit.col);
      cellEl.appendChild(el);
    });

    _unsubscribe = window.GameState.subscribe(_onStateChange);
    return _unsubscribe;
  }

  function _buildUnitEl(unit) {
    const el = document.createElement('div');
    el.className = 'unit' + (unit.owner === 'ai' ? ' unit--ai' : '');
    el.dataset.unitId   = unit.id;
    el.dataset.unitType = unit.type;
    el.dataset.owner    = unit.owner || 'player';

    el.appendChild(window.ChromaBridge.getSprite(unit.type));

    if (unit.rank) {
      const chip = document.createElement('span');
      chip.className   = 'rank-chip';
      chip.textContent = unit.rank;
      el.appendChild(chip);
    }
    return el;
  }

  function _onStateChange(state) {
    // 2-player mode manages its own unit DOM — skip to avoid conflicts
    if (window.TwoPlayerMode && window.TwoPlayerMode.isActive()) return;
    state.units.forEach(function(unit) {
      let el = _units[unit.id];
      if (!el) {
        el = _buildUnitEl(unit);
        _units[unit.id] = el;
      }
      el.classList.toggle('unit--ai', unit.owner === 'ai');
      el.dataset.owner = unit.owner || 'player';

      const parent = el.parentElement;
      if (!parent ||
          parseInt(parent.dataset.row) !== unit.row ||
          parseInt(parent.dataset.col) !== unit.col) {
        const cellEl = window.MapRenderer.getCellEl(unit.row, unit.col);
        if (cellEl) cellEl.appendChild(el);
      }

      el.classList.toggle('unit--selected', unit.id === state.selectedUnitId);
    });

    Object.keys(_units).forEach(function (id) {
      if (!state.units.some(function (u) { return u.id === id; })) {
        _units[id].remove();
        delete _units[id];
      }
    });
  }

  function playAttackEffect(attackerUnitId, defenderUnitId) {
    const attackerEl = _units[attackerUnitId];
    const defenderEl = _units[defenderUnitId];

    const attackerType = attackerEl ? attackerEl.dataset.unitType : 'Tanks';
    const attackSrc = window.ChromaBridge.getAttackSpriteSrc(attackerType);

    const mapRoot = document.getElementById('map-root');

    if (attackerEl) attackerEl.classList.add('unit--attacking');
    if (defenderEl) defenderEl.classList.add('unit--hit');

    if (mapRoot) {
      const overlay = document.createElement('div');
      overlay.className = 'attack-overlay';
      mapRoot.appendChild(overlay);

      window.ChromaRenderer.createGifSprite(attackSrc)
        .then(function (result) {
          result.el.className = 'attack-overlay__canvas';
          overlay.appendChild(result.el);

          window.setTimeout(function () {
            result.destroy();
            overlay.remove();
            if (attackerEl) attackerEl.classList.remove('unit--attacking');
            if (defenderEl) defenderEl.classList.remove('unit--hit');
          }, 1500);
        })
        .catch(function () {
          overlay.remove();
          _fallbackBurst(defenderEl, attackerEl);
        });
    } else {
      _fallbackBurst(defenderEl, attackerEl);
    }
  }

  function _fallbackBurst(defenderEl, attackerEl) {
    if (!defenderEl) return;
    const cellEl = defenderEl.closest('.cell');
    if (cellEl) {
      const burst = document.createElement('img');
      burst.className = 'attack-burst';
      burst.src = '../assets/units/animations/tank/tank-attack.gif';
      burst.alt = '';
      cellEl.appendChild(burst);
    }
    window.setTimeout(function () {
      if (attackerEl) attackerEl.classList.remove('unit--attacking');
      if (defenderEl) defenderEl.classList.remove('unit--hit');
    }, 760);
  }

  window.UnitRenderer = { mountUnits: mountUnits, playAttackEffect: playAttackEffect };
})();
