(function () {
  'use strict';

  function attachSelection(mapRootEl) {
    mapRootEl.addEventListener('click', function(e) {
      // Delegate entirely to 2-player mode when active
      if (window.TwoPlayerMode && window.TwoPlayerMode.isActive()) {
        var cellEl2 = e.target.closest('.cell');
        if (!cellEl2) return;
        window.TwoPlayerMode.handleClick(
          parseInt(cellEl2.dataset.row),
          parseInt(cellEl2.dataset.col)
        );
        return;
      }

      let state;
      try { state = window.GameState.getState(); } catch (_) { return; }

      const cellEl = e.target.closest('.cell');
      if (!cellEl) return;

      const row = parseInt(cellEl.dataset.row);
      const col = parseInt(cellEl.dataset.col);

      // Legal-move destination → move the selected unit
      if (state.selectedUnitId) {
        const isLegal = state.legalMoves.some(function(m) { return m.row === row && m.col === col; });
        if (isLegal) {
          const movingId = state.selectedUnitId;
          if (window.OrchestrationBridge) window.OrchestrationBridge.notifyMove(movingId, row, col);
          window.GameState.moveUnit(movingId, row, col);
          return;
        }
      }

      // Unit element → select or deselect
      const unitEl = e.target.closest('[data-unit-id]');
      if (unitEl) {
        const unitId = unitEl.dataset.unitId;
        const unit = state.units.find(function (u) { return u.id === unitId; });

        if (state.selectedUnitId && unit && unit.owner === 'ai') {
          const target = (state.attackTargets || []).find(function (t) { return t.unitId === unitId; });
          if (target && window.OrchestrationBridge?.attackUnit) {
            const attackerId = state.selectedUnitId;
            if (window.UnitRenderer?.playAttackEffect) {
              window.UnitRenderer.playAttackEffect(attackerId, unitId);
            }
            window.OrchestrationBridge.attackUnit(attackerId, unitId).then(function (result) {
              if (window.GameState?.setLastCombat) window.GameState.setLastCombat(result);
            });
          }
          return;
        }

        if (unit && unit.owner === 'ai') {
          window.GameState.selectUnit(null);
          return;
        }
        if (state.selectedUnitId === unitId) {
          window.GameState.selectUnit(null);
        } else {
          window.GameState.selectUnit(unitId);
          // Show local moves immediately for instant response
          const moves = window.EngineBridge.getLegalMoves(unitId, window.GameState.getState());
          window.GameState.setLegalMoves(moves);
          if (window.GameState.setAttackTargets) window.GameState.setAttackTargets([]);
          // Then upgrade to doctrine-aware bridge moves if bridge is online
          if (window.OrchestrationBridge && window.OrchestrationBridge.isOnline()) {
            window.OrchestrationBridge.getLegalMoves(unitId).then(function (bridgeMoves) {
              if (bridgeMoves && window.GameState.getState().selectedUnitId === unitId) {
                window.GameState.setLegalMoves(bridgeMoves);
              }
            });
            if (window.OrchestrationBridge.getAttackTargets) {
              window.OrchestrationBridge.getAttackTargets(unitId).then(function (targets) {
                if (targets && window.GameState.getState().selectedUnitId === unitId) {
                  window.GameState.setAttackTargets(targets);
                }
              });
            }
          }
        }
        return;
      }

      // Empty cell → deselect
      if (state.selectedUnitId) window.GameState.selectUnit(null);
    });
  }

  window.Selection = { attachSelection: attachSelection };
})();
