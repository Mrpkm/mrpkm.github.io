(function () {
  'use strict';

  var BASE_URL = 'http://localhost:3400';

  // In-memory session state
  var _sessionId = null;
  var _online = false;
  var _lastBridgeState = null;

  // core-map biome → bridge terrain number (matches unit-movement.js: P=0,S=1,F=2,M=3)
  var BIOME_TO_NUM = { P: 0, S: 1, F: 2, M: 3 };

  // Base HP per unit type from bridge UNIT_DEFS
  var TYPE_HP = { Infantry: 4, Cavalry: 3, Tanks: 8, Motorized: 6, Artillery: 2 };

  // Doctrine name normalisation: core-map → bridge format (no spaces)
  var DOCTRINE_MAP = {
    'Plain':                'Plain',
    'Blitzkrieg':           'Blitzkrieg',
    'Superior Firepower':   'SuperiorFirepower'
  };
  var BRIDGE_TO_CORE_DOCTRINE = {
    Plain: 'Plain',
    Blitzkrieg: 'Blitzkrieg',
    SuperiorFirepower: 'Superior Firepower'
  };

  // ── helpers ────────────────────────────────────────────────────────

  function _updateStatusEl(online) {
    _online = online;
    var el = document.getElementById('bridge-status');
    if (!el) return;
    el.textContent  = online ? 'ONLINE' : 'OFFLINE';
    el.style.color  = online ? '#4ecca3' : '#e2b65a';
  }

  function _apiJson(urlPath, method, body) {
    var opts = { method: method || 'GET', headers: {} };
    if (body != null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE_URL + urlPath, opts).then(function (r) {
      if (!r.ok) return Promise.reject(new Error('HTTP ' + r.status));
      return r.json();
    });
  }

  // Convert a parsed core-map state to the bridge's GameState schema.
  // Only player 0 (the local player) is populated from the briefing.
  // Player 1 is a passive stub (empty army) so the bridge can function.
  function _coreToBridgeState(parsed) {
    var gridRows = parsed.grid.rows;
    var gridCols = parsed.grid.cols;

    // Build numeric grid (0-based 2-D array)
    var grid = [];
    for (var r = 0; r < gridRows; r++) grid[r] = new Array(gridCols).fill(0);
    parsed.grid.cells.forEach(function (cell) {
      grid[cell.row - 1][cell.col - 1] = BIOME_TO_NUM[cell.biome] || 0;
    });

    var doctrineName = DOCTRINE_MAP[parsed.doctrine.name] || 'Plain';

    // core-map level is 1-based (1 = base rank); bridge is 0-based (0 = base)
    var p0Units = parsed.units.map(function (u) {
      var unit = {
        id:               u.id,
        type:             u.type,
        level:            Math.max(0, (u.level || 1) - 1),
        row:              u.row,
        col:              u.col,
        facing:           'S',
        currentHp:        TYPE_HP[u.type] || 4,
        actionsRemaining: 2,
        movedThisTurn:    false
      };
      if (u.type === 'Infantry' || u.type === 'Cavalry') unit.trenchTurns = 0;
      if (u.type === 'Tanks'    || u.type === 'Motorized') unit.stillTurns = 0;
      return unit;
    });

    var p1Units = p0Units.map(function (u, idx) {
      return Object.assign({}, u, {
        id: 'ai_' + idx + '_' + u.id,
        row: gridRows - u.row + 1,
        col: gridCols - u.col + 1,
        facing: 'N',
        actionsRemaining: 2,
        movedThisTurn: false
      });
    });

    return {
      turnNumber:  1,
      activePlayer: 0,
      phase:       'action',
      board: {
        rows:       gridRows,
        cols:       gridCols,
        grid:       grid,
        terrainKey: { 0: 'grassland', 1: 'swamp', 2: 'forest', 3: 'mountain' }
      },
      players: [
        {
          playerIndex:    0,
          doctrine:       doctrineName,
          hqHp:           20,
          hqPosition:     { row: 1, col: 1 },
          hqOccupyTimer:  0,
          units:          p0Units
        },
        {
          playerIndex:    1,
          doctrine:       doctrineName,
          hqHp:           20,
          hqPosition:     { row: gridRows, col: gridCols },
          hqOccupyTimer:  0,
          units:          p1Units
        }
      ]
    };
  }

  function _bridgeToCoreUnits(bridgeState) {
    var units = [];
    (bridgeState.players || []).forEach(function (player) {
      (player.units || []).forEach(function (u) {
        units.push({
          id: u.id,
          type: u.type,
          level: (u.level || 0) + 1,
          rank: u.level > 0 ? 'Corporal' : null,
          row: u.row,
          col: u.col,
          owner: player.playerIndex === 0 ? 'player' : 'ai',
          facing: u.facing,
          currentHp: u.currentHp
        });
      });
    });
    return units;
  }

  function _publishBridgeState(bridgeState) {
    _lastBridgeState = JSON.parse(JSON.stringify(bridgeState));
    if (!window.GameState || !window.GameState.syncFromBridgeState) return;
    window.GameState.syncFromBridgeState({
      units: _bridgeToCoreUnits(bridgeState),
      bridge: {
        activePlayer: bridgeState.activePlayer,
        turnNumber: bridgeState.turnNumber,
        players: (bridgeState.players || []).map(function (p) {
          return {
            playerIndex: p.playerIndex,
            doctrine: BRIDGE_TO_CORE_DOCTRINE[p.doctrine] || p.doctrine,
            hqHp: p.hqHp,
            units: (p.units || []).length
          };
        })
      }
    });
  }

  // ── public API ─────────────────────────────────────────────────────

  function checkOnline() {
    return fetch(BASE_URL + '/health')
      .then(function (r) { _updateStatusEl(r.ok); return r.ok; })
      .catch(function ()  { _updateStatusEl(false); return false; });
  }

  // Create (or reset) a bridge session from the freshly parsed briefing.
  function initSession(parsed) {
    var bridgeState = _coreToBridgeState(parsed);
    _publishBridgeState(bridgeState);
    return _apiJson('/sessions', 'POST', { gameState: bridgeState })
      .then(function (data) {
        _sessionId = data.sessionId;
        if (data.gameState) _publishBridgeState(data.gameState);
        _updateStatusEl(true);
        console.log('[OrchestrationBridge] session created:', _sessionId);
        return _sessionId;
      })
      .catch(function (err) {
        _updateStatusEl(false);
        console.warn('[OrchestrationBridge] bridge offline —', err.message);
        return null;
      });
  }

  // Fetch doctrine-aware legal moves for a unit from the bridge.
  // Returns [{row, col}] array or null when offline / session missing.
  function getLegalMoves(unitId) {
    if (!_sessionId) return Promise.resolve(null);
    return _apiJson('/sessions/' + _sessionId + '/units/' + encodeURIComponent(unitId) + '/moves')
      .then(function (data) {
        return (data.legalMoves || []).map(function (m) { return { row: m.row, col: m.col }; });
      })
      .catch(function () { return null; });
  }

  function getAttackTargets(unitId) {
    if (!_sessionId) return Promise.resolve(null);
    return _apiJson('/sessions/' + _sessionId + '/units/' + encodeURIComponent(unitId) + '/targets')
      .then(function (data) {
        return data.targets || [];
      })
      .catch(function () { return null; });
  }

  // Tell the bridge a move happened so its session state stays in sync.
  // Fire-and-forget — never blocks the UI.
  function notifyMove(unitId, toRow, toCol) {
    if (!_sessionId) return;
    _apiJson('/sessions/' + _sessionId + '/move', 'POST', { unitId: unitId, toRow: toRow, toCol: toCol })
      .then(function (data) {
        if (data && data.updatedState) _publishBridgeState(data.updatedState);
      })
      .catch(function () {});
  }

  function attackUnit(attackerUnitId, defenderUnitId) {
    if (!_sessionId) return Promise.resolve(null);
    return _apiJson('/sessions/' + _sessionId + '/attack', 'POST', {
      attackerUnitId: attackerUnitId,
      defenderUnitId: defenderUnitId
    }).then(function (data) {
      if (data && data.updatedState) _publishBridgeState(data.updatedState);
      return data;
    }).catch(function (err) {
      return { error: err.message || 'Attack failed' };
    });
  }

  // Heuristic AI recommendation (local engine, no Claude call).
  function getAiAdvice() {
    if (!_sessionId) return Promise.resolve(null);
    return _apiJson('/sessions/' + _sessionId + '/advise', 'POST')
      .catch(function () { return null; });
  }

  // Ask Claude for strategic reasoning (requires bridge + Artifact API access).
  function thinkWithClaude(question) {
    if (!_sessionId) return Promise.resolve(null);
    var body = question ? { question: question } : {};
    return _apiJson('/sessions/' + _sessionId + '/think', 'POST', body)
      .catch(function () { return null; });
  }

  function endTurn() {
    if (!_sessionId) return Promise.resolve(null);
    return _apiJson('/sessions/' + _sessionId + '/end-turn', 'POST')
      .then(function (data) {
        if (data && data.updatedState) _publishBridgeState(data.updatedState);
        return data;
      })
      .catch(function () { return null; });
  }

  function applyBridgeState(bridgeState) {
    if (!bridgeState) return;
    _publishBridgeState(bridgeState);
  }

  // Expose globally
  window.OrchestrationBridge = {
    isOnline:       function () { return _online; },
    getSessionId:    function () { return _sessionId; },
    getCurrentGameState: function () {
      return _lastBridgeState ? JSON.parse(JSON.stringify(_lastBridgeState)) : null;
    },
    checkOnline:    checkOnline,
    initSession:    initSession,
    getLegalMoves:  getLegalMoves,
    getAttackTargets: getAttackTargets,
    notifyMove:     notifyMove,
    attackUnit:      attackUnit,
    getAiAdvice:    getAiAdvice,
    thinkWithClaude: thinkWithClaude,
    endTurn:        endTurn,
    applyBridgeState: applyBridgeState
  };

  // Probe on page load (non-blocking)
  checkOnline();
})();
