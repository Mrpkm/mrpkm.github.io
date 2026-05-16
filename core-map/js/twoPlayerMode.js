/* twoPlayerMode.js — 2-player engagement mode layered on top of the core-map.
   Keeps existing tile graphics; manages its own unit state and rendering.
*/
(function () {
  'use strict';

  /* ── State ───────────────────────────────────────────────── */
  var _active        = false;
  var _units         = [];
  var _biomeMap      = {};
  var _gridRows      = 12;
  var _gridCols      = 11;
  var _currentPlayer = 1;
  var _conquered     = {};   // key → player (1 or 2)
  var _mode          = 'move';   // 'move' | 'attack' | 'rotate'
  var _selectedId    = null;
  var _log           = [];
  var _turnNo        = 1;
  var _winner        = null;
  var _unitEls       = {};       // id → DOM element
  var _boardRot      = 0;        // 0 or 180 — flips on each End Turn
  var _briefCode     = null;     // last loaded briefing code (null = default layout)
  var _p1BriefCode   = null;     // separate P1 brief (dual-brief mode)
  var _p2BriefCode   = null;     // separate P2 brief (dual-brief mode)
  var _panelWired    = false;
  var _flashTimeout  = null;
  var _endOverlayShown = false;
  var _tutStep       = -1;

  var SHORT = { Infantry:'INF', Cavalry:'CAV', Tanks:'TNK', Motorized:'MOT', Artillery:'ART' };

  /* ── Tutorial ────────────────────────────────────────────────── */
  var TUT_STEPS = [
    { title:'MOVE YOUR UNITS',   body:'Click a unit to select it. <strong>Gold squares</strong> show legal moves — click one to march. Each unit gets 2 actions per turn.', target:'twp-btn-move' },
    { title:'ATTACK ENEMIES',    body:'Switch to <strong>Attack</strong> mode, then click a red-highlighted enemy. Direction matters — rear attacks deal more damage. They counter-strike!', target:'twp-btn-attack' },
    { title:'END YOUR TURN',     body:'When your units have acted, press <strong>End Turn</strong>. The board rotates — each player always faces upward.', target:'twp-btn-end' },
  ];
  function _showTutorial() {
    var overlay = document.getElementById('twp-tutorial');
    if (!overlay) return;
    _tutStep = 0; _renderTutorialStep(); overlay.style.display = '';
  }
  function _renderTutorialStep() {
    var step = TUT_STEPS[_tutStep];
    if (!step) { _closeTutorial(); return; }
    var el = function(id){ return document.getElementById(id); };
    if (el('twp-tutorial-kicker')) el('twp-tutorial-kicker').textContent = 'STEP '+(_tutStep+1)+' OF '+TUT_STEPS.length;
    if (el('twp-tutorial-title'))  el('twp-tutorial-title').textContent  = step.title;
    if (el('twp-tutorial-body'))   el('twp-tutorial-body').innerHTML     = step.body;
    if (el('twp-tutorial-next'))   el('twp-tutorial-next').textContent   = _tutStep < TUT_STEPS.length-1 ? 'NEXT ▸' : 'GOT IT ✓';
    document.querySelectorAll('.twp-tutorial-highlight').forEach(function(e){ e.classList.remove('twp-tutorial-highlight'); });
    if (step.target) { var t = el(step.target); if (t) t.classList.add('twp-tutorial-highlight'); }
  }
  function _nextTutorialStep() { _tutStep++; if (_tutStep >= TUT_STEPS.length){ _closeTutorial(); return; } _renderTutorialStep(); }
  function _closeTutorial() {
    _tutStep = -1;
    var overlay = document.getElementById('twp-tutorial');
    if (overlay) overlay.style.display = 'none';
    document.querySelectorAll('.twp-tutorial-highlight').forEach(function(e){ e.classList.remove('twp-tutorial-highlight'); });
  }
  var STORAGE_BRIEF = 'twp_last_brief';

  /* ── Initial unit layout (12×11, 1-indexed) ─────────────── */
  var _idCounter = 0;
  function _mk(player, type, row, col) {
    var stats = window.Combat.UNIT_STATS[type];
    return {
      id: 'twp-' + (player === 1 ? 'p1' : 'p2') + '-' + (++_idCounter),
      type: type, player: player, row: row, col: col,
      facing: player === 1 ? 'N' : 'S',
      hp: stats.hp, maxHp: stats.hp,
      actionsRemaining: 2, turnsStill: 0, trenched: false, movedThisTurn: false,
    };
  }

  function _defaultUnits() {
    _idCounter = 0;
    return [
      // P1 — bottom rows 11-12, facing N
      _mk(1,'Infantry', 12, 1), _mk(1,'Infantry', 12, 2), _mk(1,'Infantry', 12, 3),
      _mk(1,'Infantry', 12, 9), _mk(1,'Infantry', 12,10), _mk(1,'Infantry', 12,11),
      _mk(1,'Infantry', 11, 5),
      _mk(1,'Cavalry',  11, 3), _mk(1,'Cavalry',  11, 9),
      _mk(1,'Tanks',    11, 4), _mk(1,'Tanks',    11, 8),
      _mk(1,'Artillery',11, 6),
      _mk(1,'Motorized',11, 2), _mk(1,'Motorized',11,10),
      // P2 — top rows 1-2, facing S
      _mk(2,'Infantry',  1, 1), _mk(2,'Infantry',  1, 2), _mk(2,'Infantry',  1, 3),
      _mk(2,'Infantry',  1, 9), _mk(2,'Infantry',  1,10), _mk(2,'Infantry',  1,11),
      _mk(2,'Infantry',  2, 7),
      _mk(2,'Cavalry',   2, 3), _mk(2,'Cavalry',   2, 9),
      _mk(2,'Tanks',     2, 4), _mk(2,'Tanks',     2, 8),
      _mk(2,'Artillery', 2, 6),
      _mk(2,'Motorized', 2, 2), _mk(2,'Motorized', 2,10),
    ];
  }

  /* ── Biome lookup ─────────────────────────────────────────── */
  function _biomeAt(r, c) { return _biomeMap[r + ',' + c] || 'P'; }

  /* ── Public ─────────────────────────────────────────────── */
  function isActive() { return _active; }

  /* ── Capture grid from current GameState ─────────────────── */
  function _captureGrid() {
    try {
      var state = window.GameState.getState();
      _biomeMap = {};
      _gridRows = state.grid.rows;
      _gridCols = state.grid.cols;
      (state.grid.cells || []).forEach(function (cell) {
        _biomeMap[cell.row + ',' + cell.col] = cell.biome;
      });
    } catch (e) { _biomeMap = {}; }
  }

  /* ── Build initial state (shared by start / newGame) ──────── */
  function _activate(units) {
    // Guard: if no units, show warning instead of blank game
    if (!units || units.length === 0) {
      _showNoUnitsWarning();
      return;
    }

    _active            = true;
    _currentPlayer     = 1;
    _mode              = 'move';
    _selectedId        = null;
    _winner            = null;
    _endOverlayShown   = false;
    _turnNo            = 1;
    _boardRot          = 0;
    _log               = [{ kind: 'turn', text: '◆ PLAYER 1 — TURN 1 ◆' }];
    _units             = units;

    document.querySelectorAll('#map-root .unit, #map-root .twp-unit').forEach(function (el) { el.remove(); });
    _unitEls = {};
    _conquered = {};

    _applyZoneOverlays();
    _renderAllUnits();
    _showPanel();
    _renderDossier();
    _showTutorial();
  }

  /* ── Red/Blue zone overlays ───────────────────────────────── */
  function _applyZoneOverlays() {
    var midRow = Math.floor(_gridRows / 2);
    document.querySelectorAll('#map-root .cell').forEach(function (el) {
      el.classList.remove('twp-zone-red', 'twp-zone-blue');
      var r = parseInt(el.dataset.row, 10);
      if (r <= midRow) el.classList.add('twp-zone-blue');
      else             el.classList.add('twp-zone-red');
    });
  }

  function _clearZoneOverlays() {
    document.querySelectorAll('#map-root .cell').forEach(function (el) {
      el.classList.remove('twp-zone-red', 'twp-zone-blue');
    });
  }

  /* ── No-units warning ─────────────────────────────────────── */
  function _showNoUnitsWarning() {
    var noUnitsEl = document.getElementById('twp-no-units');
    if (noUnitsEl) noUnitsEl.style.display = '';
    var normal   = document.getElementById('normal-dossier-content');
    var overview = document.querySelector('.overview');
    var twpPanel = document.getElementById('twp-panel');
    if (normal)   normal.style.display   = 'none';
    if (overview) overview.style.display = 'none';
    if (twpPanel) twpPanel.style.display = 'none';
  }

  /* ── Start with default layout (reads demo grid) ──────────── */
  function start() {
    _captureGrid();
    _idCounter = 0;

    // Restore last brief if one was saved
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_BRIEF); } catch (e) {}
    if (saved) {
      _briefCode = saved;
      _activate(_unitsFromBrief(saved));
    } else {
      _briefCode = null;
      _activate(_defaultUnits());
    }
  }

  /* ── Start from a pregame briefing (called via twp_autostart flag) ─ */
  function startFromBriefing() {
    _captureGrid();
    _idCounter = 0;
    try {
      var state = window.GameState.getState();
      // P1 from parsed briefing units
      var p1 = state.units.map(function (u) {
        var stats = window.Combat.UNIT_STATS[u.type] || window.Combat.UNIT_STATS.Infantry;
        return {
          id: 'twp-p1-' + (++_idCounter),
          type: u.type, player: 1,
          row: u.row, col: u.col, facing: 'N',
          hp: stats.hp, maxHp: stats.hp,
          actionsRemaining: 2, turnsStill: 0, trenched: false, movedThisTurn: false,
        };
      });
      // P2 gets default mirrored layout
      var defUnits = _defaultUnits();
      var p2 = defUnits.filter(function (u) { return u.player === 2; });
      _briefCode = null; // flag: came from pregame-setup, not inline paste
      _activate(p1.concat(p2));
    } catch (e) {
      _briefCode = null;
      _activate(_defaultUnits());
    }
  }

  /* ── Load brief inline (from 2P panel textarea) ─────────────── */
  function loadBrief(code) {
    if (!code || !code.trim()) return false;
    var units = _unitsFromBrief(code);
    if (!units) return false;
    _briefCode = code;
    try { localStorage.setItem(STORAGE_BRIEF, code); } catch (e) {}
    _activate(units);
    return true;
  }

  function clearBrief() {
    _briefCode = null;
    try { localStorage.removeItem(STORAGE_BRIEF); } catch (e) {}
    _activate(_defaultUnits());
  }

  /* ── Parse a brief code into 2-player units ─────────────────── */
  function _unitsFromBrief(code) {
    if (!window.Parser || !window.Combat) return null;
    try {
      var parsed = window.Parser.parsePreGameCode(code);
      // Update biome map from the brief
      _biomeMap = {};
      _gridRows = parsed.grid.rows;
      _gridCols = parsed.grid.cols;
      parsed.grid.cells.forEach(function (cell) {
        _biomeMap[cell.row + ',' + cell.col] = cell.biome;
      });

      _idCounter = 0;
      var p1 = parsed.units.map(function (u) {
        var stats = window.Combat.UNIT_STATS[u.type] || window.Combat.UNIT_STATS.Infantry;
        return {
          id: 'twp-p1-' + (++_idCounter),
          type: u.type, player: 1,
          row: u.row, col: u.col, facing: 'N',
          hp: stats.hp, maxHp: stats.hp,
          actionsRemaining: 2, turnsStill: 0, trenched: false, movedThisTurn: false,
        };
      });

      // Mirror P1 for P2
      var flipFacing = { N:'S', S:'N', E:'W', W:'E' };
      var placed = {};
      p1.forEach(function (u) { placed[u.row + ',' + u.col] = true; });

      var p2 = [];
      p1.forEach(function (u) {
        var mr = _gridRows + 1 - u.row;
        var mc = _gridCols + 1 - u.col;
        // Skip if collision with existing P1 or P2 unit
        var key = mr + ',' + mc;
        if (!placed[key]) {
          placed[key] = true;
          p2.push({
            id: 'twp-p2-' + (++_idCounter),
            type: u.type, player: 2,
            row: mr, col: mc,
            facing: flipFacing[u.facing] || 'S',
            hp: u.hp, maxHp: u.maxHp,
            actionsRemaining: 2, turnsStill: 0, trenched: false, movedThisTurn: false,
          });
        }
      });
      return p1.concat(p2);
    } catch (e) {
      return null;
    }
  }

  /* ── Build units from two separate brief codes ───────────── */
  function _buildUnitsFromBriefs(p1Code, p2Code) {
    _idCounter = 0;
    var p1 = null;
    var p2 = null;

    if (p1Code && window.Parser && window.Combat) {
      try {
        var parsed1 = window.Parser.parsePreGameCode(p1Code);
        // Update biome map from P1's brief
        _biomeMap = {};
        _gridRows = parsed1.grid.rows;
        _gridCols = parsed1.grid.cols;
        parsed1.grid.cells.forEach(function (cell) {
          _biomeMap[cell.row + ',' + cell.col] = cell.biome;
        });
        p1 = parsed1.units.map(function (u) {
          var stats = window.Combat.UNIT_STATS[u.type] || window.Combat.UNIT_STATS.Infantry;
          return {
            id: 'twp-p1-' + (++_idCounter),
            type: u.type, player: 1,
            row: u.row, col: u.col, facing: 'N',
            hp: stats.hp, maxHp: stats.hp,
            actionsRemaining: 2, turnsStill: 0, trenched: false, movedThisTurn: false,
          };
        });
      } catch (e) {}
    }

    if (p2Code && window.Parser && window.Combat) {
      try {
        var parsed2 = window.Parser.parsePreGameCode(p2Code);
        var rows = _gridRows;
        var cols = _gridCols;
        p2 = parsed2.units.map(function (u) {
          var stats = window.Combat.UNIT_STATS[u.type] || window.Combat.UNIT_STATS.Infantry;
          return {
            id: 'twp-p2-' + (++_idCounter),
            type: u.type, player: 2,
            row: rows + 1 - u.row, col: cols + 1 - u.col, facing: 'S',
            hp: stats.hp, maxHp: stats.hp,
            actionsRemaining: 2, turnsStill: 0, trenched: false, movedThisTurn: false,
          };
        });
      } catch (e) {}
    }

    // Fall back to defaults for any missing side
    var defaults = _defaultUnits();
    if (!p1) p1 = defaults.filter(function (u) { return u.player === 1; });
    if (!p2) p2 = defaults.filter(function (u) { return u.player === 2; });
    return p1.concat(p2);
  }

  /* ── Start with two independent briefs (dual-brief mode) ─── */
  function startWithBriefs(p1Code, p2Code) {
    _captureGrid();
    _p1BriefCode = p1Code || null;
    _p2BriefCode = p2Code || null;
    _briefCode   = p1Code || null; // kept for legacy newGame compatibility
    var units = _buildUnitsFromBriefs(p1Code, p2Code);
    _activate(units);
  }

  /* ── Click handler ─────────────────────────────────────────── */
  function handleClick(row, col) {
    if (_winner) return;
    var occ = _units.find(function (u) { return u.row === row && u.col === col; });

    if (!_selectedId) {
      if (occ && occ.player === _currentPlayer && occ.actionsRemaining > 0) _selectedId = occ.id;
      _renderAllUnits(); _renderDossier(); return;
    }

    var sel = _units.find(function (u) { return u.id === _selectedId; });
    if (!sel) { _selectedId = null; _renderAllUnits(); _renderDossier(); return; }

    // In rotate mode: clicking own cell does nothing (avoids accidental deselect)
    if (occ && occ.id === _selectedId) {
      if (_mode === 'rotate') return;
      _selectedId = null; _renderAllUnits(); _renderDossier(); return;
    }
    if (occ && occ.player === _currentPlayer && occ.actionsRemaining > 0) {
      _selectedId = occ.id; _renderAllUnits(); _renderDossier(); return;
    }

    if (_mode === 'rotate') {
      var dr = row - sel.row, dc = col - sel.col;
      if (dr === 0 && dc === 0) return;
      var f = sel.facing;
      if (Math.abs(dr) > Math.abs(dc)) f = dr < 0 ? 'N' : 'S';
      else                             f = dc < 0 ? 'W' : 'E';
      _mutate(sel.id, { facing: f });
      _pushLog({ kind:'mv', text: SHORT[sel.type]+' P'+sel.player+' rotates → '+f+'.' });
      _renderAllUnits(); _renderDossier(); return;
    }

    if (_mode === 'attack' && occ && occ.player !== _currentPlayer) {
      if (window.Combat.canAttack(sel, occ)) { _doAttack(sel, occ); return; }
    }

    if (_mode === 'move' && !occ) {
      if (window.Combat.canMoveTo(sel, row, col, _units, _biomeAt, _gridRows, _gridCols)) {
        _doMove(sel, row, col); return;
      }
    }
  }

  /* ── Move ───────────────────────────────────────────────────── */
  function _doMove(unit, tr, tc) {
    var dr = tr - unit.row, dc = tc - unit.col;
    var f = unit.facing;
    if (Math.abs(dr) >= Math.abs(dc)) f = dr < 0 ? 'N' : (dr > 0 ? 'S' : f);
    else                              f = dc < 0 ? 'W' : (dc > 0 ? 'E' : f);
    var biomeNames = { P:'PLAIN', F:'FOREST', M:'MOUNTAIN', S:'SWAMP' };
    _mutate(unit.id, {
      row: tr, col: tc, facing: f,
      actionsRemaining: Math.max(0, unit.actionsRemaining - 1),
      turnsStill: 0, trenched: false, movedThisTurn: true,
    });
    _pushLog({ kind:'mv', text: SHORT[unit.type]+' P'+unit.player+' → ('+tr+','+tc+') ['+
      (biomeNames[_biomeAt(tr,tc)]||'PLAIN')+']'+(unit.trenched?' (trench lost)':'')+'.' });
    var upd = _units.find(function (u) { return u.id === unit.id; });
    if (upd && upd.actionsRemaining <= 0) _selectedId = null;
    _checkWinner();
    _checkEndReached();
    _applyConquest(unit.player, tr, tc);
    _renderAllUnits(); _renderDossier();
  }

  /* ── Attack ─────────────────────────────────────────────────── */
  function _doAttack(attacker, defender) {
    var r = window.Combat.rollAttack(attacker, defender, _units, _biomeAt);
    var newHp = Math.max(0, defender.hp - r.damage);

    _pushLog({
      kind: 'atk',
      text: SHORT[attacker.type]+' P'+attacker.player+' attacks '+SHORT[defender.type]+' P'+defender.player+' ('+r.direction+')',
      detail: _detail(attacker, defender, r, newHp),
    });

    _mutate(attacker.id, { actionsRemaining: Math.max(0, attacker.actionsRemaining - 1) });
    _mutate(defender.id, { hp: newHp });
    if (newHp <= 0) _removeUnit(defender.id);
    _flashCell(defender.row, defender.col);

    var defAlive = _units.find(function (u) { return u.id === defender.id; });
    var atkAlive = _units.find(function (u) { return u.id === attacker.id; });
    if (defAlive && atkAlive && defAlive.actionsRemaining > 0 && window.Combat.canAttack(defAlive, atkAlive)) {
      var cr = window.Combat.rollAttack(defAlive, atkAlive, _units, _biomeAt);
      var cHp = Math.max(0, atkAlive.hp - cr.damage);
      _pushLog({
        kind: 'ctr',
        text: '↩ '+SHORT[defAlive.type]+' P'+defAlive.player+' counter-attacks '+SHORT[atkAlive.type]+' P'+atkAlive.player+' ('+cr.direction+')',
        detail: _detail(defAlive, atkAlive, cr, cHp),
      });
      _mutate(atkAlive.id, { hp: cHp });
      if (cHp <= 0) { _removeUnit(atkAlive.id); _selectedId = null; }
      _flashCell(atkAlive.row, atkAlive.col);
    }

    var postAtk = _units.find(function (u) { return u.id === attacker.id; });
    if (!postAtk || postAtk.actionsRemaining <= 0) _selectedId = null;

    _checkWinner();
    _renderAllUnits(); _renderDossier();
  }

  function _detail(atk, def, r, newHp) {
    var aStr  = window.Combat.UNIT_STATS[atk.type].strength;
    var defEff = window.Combat.effectiveDefense(def, _biomeAt);
    var sM = r.strMods.length ? ' ['+r.strMods.join(', ')+']' : '';
    var dM = r.defMods.length ? ' ['+r.defMods.join(', ')+']' : '';
    return 'd6='+r.roll+' str='+aStr+sM+' → '+r.atkPwr.toFixed(1)+' vs def='+defEff.total+dM+'='+r.defVal.toFixed(1)+' → -'+r.damage+(newHp===0 ? ' ☠ KIA' : ' ('+def.hp+'→'+newHp+')');
  }

  /* ── End Turn ────────────────────────────────────────────────── */
  function endTurn() {
    if (_winner) return;
    var next = _currentPlayer === 1 ? 2 : 1;

    _units = _units.map(function (u) {
      if (u.player === _currentPlayer) {
        var newStill  = u.movedThisTurn ? 0 : u.turnsStill + 1;
        var canTrench = window.Combat.UNIT_STATS[u.type].trench && _biomeAt(u.row, u.col) !== 'S';
        var trenched  = canTrench && newStill >= 3;
        if (trenched && !u.trenched) _pushLog({ kind:'mv', text: SHORT[u.type]+' P'+u.player+' digs in — TRENCH.' });
        return Object.assign({}, u, { turnsStill: newStill, trenched: trenched, movedThisTurn: false });
      }
      if (u.player === next) return Object.assign({}, u, { actionsRemaining: 2, movedThisTurn: false });
      return u;
    });

    _currentPlayer = next;
    _selectedId    = null;
    _mode          = 'move';
    _turnNo       += 1;
    _boardRot      = (_boardRot + 180) % 360;
    _pushLog({ kind:'turn', text: '◆ PLAYER '+next+' — TURN '+_turnNo+' ◆' });
    _renderAllUnits(); _renderDossier();
  }

  /* ── New Game (preserves brief if one was loaded) ──────────── */
  function newGame() {
    _currentPlayer   = 1;
    _mode            = 'move';
    _selectedId      = null;
    _winner          = null;
    _endOverlayShown = false;
    _turnNo          = 1;
    _boardRot        = 0;
    _log             = [{ kind:'turn', text: '◆ PLAYER 1 — TURN 1 ◆' }];

    document.querySelectorAll('#map-root .twp-unit').forEach(function (el) { el.remove(); });
    _clearZoneOverlays();
    _clearConquest();
    _unitEls = {};

    if (_p1BriefCode || _p2BriefCode) {
      _units = _buildUnitsFromBriefs(_p1BriefCode, _p2BriefCode);
    } else if (_briefCode) {
      _units = _unitsFromBrief(_briefCode) || _defaultUnits();
    } else {
      _idCounter = 0;
      _units = _defaultUnits();
    }

    _renderAllUnits(); _renderDossier();
  }

  /* ── Conquest ────────────────────────────────────────────────── */
  function _applyConquest(player, row, col) {
    var midRow = Math.floor(_gridRows / 2);
    // P1 (blue units) conquers tiles in the blue zone (top half, rows ≤ midRow)
    // P2 (red  units) conquers tiles in the red  zone (bottom half, rows > midRow)
    var isEnemyZone = (player === 1 && row <= midRow) || (player === 2 && row > midRow);
    if (!isEnemyZone) return;
    var k = row + ',' + col;
    _conquered[k] = player;
    var cellEl = window.MapRenderer.getCellEl(row, col);
    if (cellEl) {
      cellEl.classList.remove('twp-conquered-p1', 'twp-conquered-p2');
      cellEl.classList.add('twp-conquered-p' + player);
    }
  }
  function _clearConquest() {
    _conquered = {};
    document.querySelectorAll('#map-root .cell').forEach(function (el) {
      el.classList.remove('twp-conquered-p1', 'twp-conquered-p2');
    });
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _mutate(id, patch) {
    _units = _units.map(function (u) { return u.id === id ? Object.assign({}, u, patch) : u; });
  }
  function _removeUnit(id) {
    _units = _units.filter(function (u) { return u.id !== id; });
    var el = _unitEls[id];
    if (el) { el.remove(); delete _unitEls[id]; }
  }
  function _markTargetRows() {
    for (var c = 1; c <= _gridCols; c++) {
      var t = window.MapRenderer.getCellEl(1, c);
      if (t) t.classList.add('twp-target-p1');
      var b = window.MapRenderer.getCellEl(_gridRows, c);
      if (b) b.classList.add('twp-target-p2');
    }
  }

  function _flashBreachCell(row, col) {
    var cellEl = window.MapRenderer.getCellEl(row, col);
    if (!cellEl) return;
    cellEl.classList.add('twp-breach-flash');
    setTimeout(function () { cellEl.classList.remove('twp-breach-flash'); }, 1500);
  }

  function _checkWinner() {
    var p1 = _units.some(function (u) { return u.player === 1; });
    var p2 = _units.some(function (u) { return u.player === 2; });
    if (!p1) { _winner = 2; _pushLog({ kind:'turn', text: '★ PLAYER 2 WINS — ALL ENEMY FORCES ELIMINATED ★' }); }
    else if (!p2) { _winner = 1; _pushLog({ kind:'turn', text: '★ PLAYER 1 WINS — ALL ENEMY FORCES ELIMINATED ★' }); }
  }

  function _checkEndReached() {
    if (_winner) return;
    var p1Unit = _units.find(function (u) { return u.player === 1 && u.row === 1; });
    var p2Unit = _units.find(function (u) { return u.player === 2 && u.row === _gridRows; });
    if (p1Unit) {
      _winner = 1;
      _flashBreachCell(1, p1Unit.col);
      _pushLog({ kind: 'turn', text: '★ PLAYER 1 BREACHED ENEMY LINES — P1 WINS ★' });
    } else if (p2Unit) {
      _winner = 2;
      _flashBreachCell(_gridRows, p2Unit.col);
      _pushLog({ kind: 'turn', text: '★ PLAYER 2 BREACHED ENEMY LINES — P2 WINS ★' });
    }
  }
  function _pushLog(entry) {
    _log.push(entry);
    if (_log.length > 80) _log.shift();
  }
  function _flashCell(row, col) {
    var cellEl = window.MapRenderer.getCellEl(row, col);
    if (!cellEl) return;
    cellEl.classList.add('attack-target');
    clearTimeout(_flashTimeout);
    _flashTimeout = setTimeout(function () {
      if (_active) cellEl.classList.remove('attack-target');
    }, 700);
  }

  /* ── Compute move / attack hints ─────────────────────────────── */
  function _computeHints() {
    var moveSet = {}, attackSet = {};
    if (!_selectedId) return { moveSet: moveSet, attackSet: attackSet };
    var sel = _units.find(function (u) { return u.id === _selectedId; });
    if (!sel || sel.actionsRemaining <= 0) return { moveSet: moveSet, attackSet: attackSet };
    if (_mode === 'move') {
      for (var r = 1; r <= _gridRows; r++) {
        for (var c = 1; c <= _gridCols; c++) {
          if (window.Combat.canMoveTo(sel, r, c, _units, _biomeAt, _gridRows, _gridCols)) moveSet[r+','+c] = true;
        }
      }
    } else if (_mode === 'attack') {
      _units.forEach(function (t) {
        if (t.player !== sel.player && window.Combat.canAttack(sel, t)) attackSet[t.row+','+t.col] = true;
      });
    }
    return { moveSet: moveSet, attackSet: attackSet };
  }

  /* ── Unit DOM rendering ───────────────────────────────────────── */
  function _renderAllUnits() {
    _markTargetRows();
    var hints = _computeHints();

    // Clear cell highlights
    document.querySelectorAll('#map-root .cell').forEach(function (el) {
      el.classList.remove('legal-move', 'attack-target', 'twp-selected-cell');
    });
    Object.keys(hints.moveSet).forEach(function (key) {
      var p = key.split(',');
      var c = window.MapRenderer.getCellEl(+p[0], +p[1]);
      if (c) c.classList.add('legal-move');
    });
    Object.keys(hints.attackSet).forEach(function (key) {
      var p = key.split(',');
      var c = window.MapRenderer.getCellEl(+p[0], +p[1]);
      if (c) c.classList.add('attack-target');
    });

    var seen = {};
    _units.forEach(function (unit) {
      seen[unit.id] = true;
      var cellEl = window.MapRenderer.getCellEl(unit.row, unit.col);
      if (!cellEl) return;

      var isNew = !_unitEls[unit.id];
      var el = _unitEls[unit.id];
      if (!el) { el = _buildUnitEl(unit); _unitEls[unit.id] = el; }
      if (el.parentElement !== cellEl) cellEl.appendChild(el);

      // Use classList instead of className= to avoid resetting CSS animations
      var wantSelected  = unit.id === _selectedId;
      var wantExhausted = unit.actionsRemaining <= 0;
      el.classList.toggle('twp-selected',  wantSelected);
      el.classList.toggle('twp-exhausted', wantExhausted);

      // Force animation start on new elements (handles GIF delay)
      if (isNew) {
        el.style.animationPlayState = 'running';
        // Trigger reflow so animation starts from frame 0 consistently
        void el.offsetWidth;
      }

      // Counter-rotate the inner wrapper
      var inner = el.querySelector('.twp-inner');
      if (inner) inner.style.transform = 'rotate(' + (-_boardRot) + 'deg)';

      // Update facing indicator — subtract board rotation so net visual is just the facing angle
      var facingEl = el.querySelector('.twp-facing');
      if (facingEl) {
        var FROT = { N: -90, S: 90, E: 0, W: 180 };
        facingEl.style.transform = 'rotate(' + ((FROT[unit.facing] || 0) - _boardRot) + 'deg)';
      }

      _updateHpPips(el, unit);
    });

    // Remove orphaned elements
    Object.keys(_unitEls).forEach(function (id) {
      if (!seen[id]) { _unitEls[id].remove(); delete _unitEls[id]; }
    });

    // Highlight selected cell
    if (_selectedId) {
      var su = _units.find(function (u) { return u.id === _selectedId; });
      if (su) {
        var sc = window.MapRenderer.getCellEl(su.row, su.col);
        if (sc) sc.classList.add('twp-selected-cell');
      }
    }

    // Rotate the board and compass
    var mapRoot = document.getElementById('map-root');
    if (mapRoot) mapRoot.style.transform = 'rotate(' + _boardRot + 'deg)';
    var compass = document.querySelector('.field-map .compass');
    if (compass) compass.style.transform = 'rotate(' + _boardRot + 'deg)';

    _updateMinimap();
  }

  var UNIT_SPRITE = {
    Infantry:  '../src/menu/assets/units/infantry.png',
    Cavalry:   '../src/menu/assets/units/cavalry.png',
    Tanks:     '../src/menu/assets/units/tank.png',
    Motorized: '../src/menu/assets/units/motorized-infantry.png',
    Artillery: '../src/menu/assets/units/artillery.png',
  };

  /* ── Chroma key (same algorithm as map-builder) ── */
  var _cachedSprites = {};

  function _chromaKey(src) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var id;
        try { id = ctx.getImageData(0, 0, c.width, c.height); } catch(e) { resolve(src); return; }
        var d = id.data;
        var kr = d[0], kg = d[1], kb = d[2], tol = 60;
        for (var i = 0; i < d.length; i += 4) {
          if (Math.abs(d[i]-kr)<tol && Math.abs(d[i+1]-kg)<tol && Math.abs(d[i+2]-kb)<tol) d[i+3]=0;
        }
        ctx.putImageData(id, 0, 0);
        var minX=c.width,maxX=-1,minY=c.height,maxY=-1;
        for (var y=0;y<c.height;y++) for (var x=0;x<c.width;x++) {
          if (d[(y*c.width+x)*4+3]>8) {
            if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
          }
        }
        if (maxX===-1) { resolve(c.toDataURL('image/png')); return; }
        var out = document.createElement('canvas');
        out.width = maxX-minX+1; out.height = maxY-minY+1;
        var octx = out.getContext('2d');
        octx.imageSmoothingEnabled = false;
        octx.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        resolve(out.toDataURL('image/png'));
      };
      img.onerror = function() { resolve(src); };
      img.src = src;
    });
  }

  function _preloadSprites() {
    Object.keys(UNIT_SPRITE).forEach(function(type) {
      _chromaKey(UNIT_SPRITE[type]).then(function(dataUrl) {
        _cachedSprites[type] = dataUrl;
        document.querySelectorAll('.twp-unit[data-unit-type="' + type + '"] .twp-inner img').forEach(function(img) {
          img.src = dataUrl;
        });
      });
    });
  }

  function _buildUnitEl(unit) {
    var el = document.createElement('div');
    el.className = 'unit twp-unit twp-p' + unit.player;
    el.dataset.unitId   = unit.id;
    el.dataset.unitType = unit.type;
    el.dataset.player   = unit.player;

    // Inner wrapper handles counter-rotation independently of bob animation
    var inner = document.createElement('div');
    inner.className = 'twp-inner';

    var img = document.createElement('img');
    img.src = _cachedSprites[unit.type] || UNIT_SPRITE[unit.type] || UNIT_SPRITE.Infantry;
    img.alt = unit.type;
    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;pointer-events:none;filter:drop-shadow(0 1px 0 rgba(0,0,0,0.55));';
    inner.appendChild(img);

    // HP pip bar
    var hpBar = document.createElement('div');
    hpBar.className = 'twp-hp';
    for (var i = 0; i < unit.maxHp; i++) {
      var pip = document.createElement('span');
      pip.className = 'twp-pip' + (i >= unit.hp ? ' twp-pip-lost' : '');
      hpBar.appendChild(pip);
    }
    inner.appendChild(hpBar);
    el.appendChild(inner);

    // Facing indicator — outside .twp-inner so rotation is independent
    var fInd = document.createElement('span');
    fInd.className = 'twp-facing';
    fInd.textContent = '>';
    el.appendChild(fInd);

    return el;
  }

  function _updateHpPips(el, unit) {
    var hpBar = el.querySelector('.twp-hp');
    if (!hpBar) return;
    hpBar.querySelectorAll('.twp-pip, .twp-pip-lost').forEach(function (pip, i) {
      pip.className = 'twp-pip' + (i >= unit.hp ? ' twp-pip-lost' : '');
    });
  }

  /* ── Panel show / wire ─────────────────────────────────────── */
  function _showPanel() {
    var normal   = document.getElementById('normal-dossier-content');
    var twpPanel = document.getElementById('twp-panel');
    if (normal)   normal.style.display = 'none';
    if (twpPanel) twpPanel.style.display = '';
    _wirePanelButtons();
  }

  function _updateMinimap() {
    var mmRoot = document.getElementById('minimap-root');
    if (!mmRoot) return;
    mmRoot.querySelectorAll('.mm-cell').forEach(function (c) {
      c.classList.remove('mm-has-p1', 'mm-has-p2');
    });
    _units.forEach(function (u) {
      var cell = mmRoot.querySelector('.mm-cell[data-row="' + u.row + '"][data-col="' + u.col + '"]');
      if (cell) cell.classList.add(u.player === 1 ? 'mm-has-p1' : 'mm-has-p2');
    });
    var ovCoords = document.getElementById('ov-coords');
    if (ovCoords) {
      var p1 = _units.filter(function (u) { return u.player === 1; }).length;
      var p2 = _units.filter(function (u) { return u.player === 2; }).length;
      ovCoords.textContent = 'P1 ' + p1 + ' · P2 ' + p2;
    }
  }

  function _wirePanelButtons() {
    if (_panelWired) return;
    _panelWired = true;

    var b = function (id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    b('twp-btn-end',    endTurn);
    b('twp-btn-new',    newGame);
    b('twp-btn-move',   function () { _setMode('move'); });
    b('twp-btn-attack', function () { _setMode('attack'); });
    b('twp-btn-rotate', function () { _setMode('rotate'); });

    // Briefing load
    b('twp-btn-load-brief', function () {
      var ta = document.getElementById('twp-brief-input');
      if (!ta) return;
      var code = ta.value.trim();
      if (!code) return;
      var ok = loadBrief(code);
      var statusEl = document.getElementById('twp-brief-status');
      if (statusEl) statusEl.textContent = ok ? '✓ Loaded' : '✗ Invalid brief code';
    });

    b('twp-btn-clear-brief', function () {
      var ta = document.getElementById('twp-brief-input');
      if (ta) ta.value = '';
      var statusEl = document.getElementById('twp-brief-status');
      if (statusEl) statusEl.textContent = 'Using default layout.';
      clearBrief();
    });
  }

  function _setMode(m) {
    _mode = m;
    _renderAllUnits(); _renderDossier();
  }

  /* ── Dossier render ────────────────────────────────────────── */
  function _renderDossier() {
    // Turn stamp
    var stampEl = document.getElementById('twp-player-stamp');
    if (stampEl) {
      stampEl.textContent = 'PLAYER ' + _currentPlayer;
      stampEl.className = 'twp-stamp twp-stamp-p' + _currentPlayer;
    }
    var actEl = document.getElementById('twp-actions-count');
    if (actEl) {
      var n = _units.filter(function (u) { return u.player === _currentPlayer && u.actionsRemaining > 0; }).length;
      actEl.textContent = n + ' unit' + (n !== 1 ? 's' : '') + ' with actions';
    }

    // Selection info
    var infoEl = document.getElementById('twp-selection-info');
    if (infoEl) {
      var sel = _selectedId ? _units.find(function (u) { return u.id === _selectedId; }) : null;
      if (!sel) {
        infoEl.innerHTML = '<span style="color:var(--olive);font-style:italic;font-size:12px;">Click one of your tokens.</span>';
      } else {
        var defEff = window.Combat.effectiveDefense(sel, _biomeAt);
        var stats  = window.Combat.UNIT_STATS[sel.type];
        infoEl.innerHTML =
          '<div style="font-family:\'Special Elite\',monospace;font-size:13px;letter-spacing:1px;">' +
            sel.type.toUpperCase() + ' · P' + sel.player +
          '</div>' +
          '<div style="font-family:\'VT323\',monospace;font-size:13px;color:var(--olive);letter-spacing:1px;">' +
            'HP '+sel.hp+'/'+sel.maxHp+' · STR '+stats.strength+' · DEF '+defEff.total.toFixed(1)+' · REACH '+stats.reach +
          '</div>' +
          '<div style="display:flex;gap:4px;margin-top:4px;">' +
            '<span class="twp-act-stamp'+(sel.actionsRemaining<2?' twp-act-used':'')+'">ACT I</span>' +
            '<span class="twp-act-stamp'+(sel.actionsRemaining<1?' twp-act-used':'')+'">ACT II</span>' +
            (sel.trenched ? '<span style="font-family:\'VT323\',monospace;font-size:13px;color:var(--green);margin-left:6px;">TRENCHED</span>' : '') +
          '</div>';
      }
    }

    // Mode buttons
    var sel2  = _selectedId ? _units.find(function (u) { return u.id === _selectedId; }) : null;
    var noAct = !sel2 || sel2.actionsRemaining <= 0;
    var hasAtk = sel2 && _units.some(function (t) { return t.player !== sel2.player && window.Combat.canAttack(sel2, t); });
    _btnState('twp-btn-move',   _mode === 'move',   noAct);
    _btnState('twp-btn-attack', _mode === 'attack', noAct || !hasAtk);
    _btnState('twp-btn-rotate', _mode === 'rotate', false);

    var hintEl = document.getElementById('twp-mode-hint');
    if (hintEl) {
      if      (_mode === 'move')   hintEl.textContent = 'Cyan = legal moves. Forest/swamp cost +1 move.';
      else if (_mode === 'attack') hintEl.textContent = hasAtk ? 'Red = enemies in reach. They counter-strike.' : 'No enemies in reach.';
      else                         hintEl.textContent = 'Click any cell — unit faces that direction (free).';
    }

    // Rotation indicator
    var rotEl = document.getElementById('twp-rot-indicator');
    if (rotEl) {
      rotEl.textContent = _boardRot === 180 ? 'VIEW: PLAYER 2 SIDE ↑' : 'VIEW: PLAYER 1 SIDE ↑';
    }

    // End Turn button
    var btnEnd = document.getElementById('twp-btn-end');
    if (btnEnd) {
      btnEnd.disabled    = !!_winner;
      btnEnd.textContent = 'End Turn ▸ P' + (_currentPlayer === 1 ? 2 : 1);
    }

    // Brief status
    var briefStatusEl = document.getElementById('twp-brief-status');
    if (briefStatusEl && briefStatusEl.textContent === '') {
      briefStatusEl.textContent = _briefCode ? '✓ Brief loaded.' : 'Default layout.';
    }

    // Combat log
    var logEl = document.getElementById('twp-log');
    if (logEl) {
      logEl.innerHTML = _log.map(function (e) {
        return '<div class="twp-log-entry twp-log-' + (e.kind || 'mv') + '">' +
          '<div>' + e.text + '</div>' +
          (e.detail ? '<div class="twp-log-detail">' + e.detail + '</div>' : '') +
          '</div>';
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    }

    // Winner
    var winnerEl = document.getElementById('twp-winner');
    if (winnerEl) {
      winnerEl.style.display = _winner ? '' : 'none';
      if (_winner) {
        var wt = document.getElementById('twp-winner-text');
        if (wt) wt.textContent = 'PLAYER ' + _winner + ' WINS';
        var ws = document.getElementById('twp-winner-sub');
        var lastLog = _log[_log.length - 1];
        if (ws && lastLog) ws.textContent = lastLog.text;
      }
    }
    // Show full-map overlay when game ends (only once per game)
    var endOverlay = document.getElementById('twp-end-overlay');
    if (endOverlay && _winner && !_endOverlayShown) {
      _endOverlayShown = true;
      endOverlay.style.display = 'flex';
      var et = document.getElementById('twp-end-text');
      if (et) et.textContent = 'PLAYER ' + _winner + ' WINS';
      var lastL = _log[_log.length - 1];
      var es = document.getElementById('twp-end-sub');
      if (es && lastL) es.textContent = lastL.text.replace(/★/g, '').trim();
    }
  }

  function _btnState(id, active, disabled) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('twp-mode-active', active);
    btn.disabled = !!disabled;
  }

  _preloadSprites();

  /* ── Expose ─────────────────────────────────────────────────── */
  window.TwoPlayerMode = {
    isActive:            isActive,
    start:               start,
    startFromBriefing:   startFromBriefing,
    startWithBriefs:     startWithBriefs,
    loadBrief:           loadBrief,
    clearBrief:          clearBrief,
    handleClick:         handleClick,
    endTurn:             endTurn,
    newGame:             newGame,
    nextTutorialStep:    _nextTutorialStep,
    closeTutorial:       _closeTutorial,
  };
})();
