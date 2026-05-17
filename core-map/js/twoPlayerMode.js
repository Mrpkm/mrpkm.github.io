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
  var _boardTrenches = {};   // 'row,col' → { type: 'basic'|'perm' } — persistent trench left on cell
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
  var _tutStep        = -1;
  var _tutListeners   = [];
  var _tutDoneOk      = false;
  var _tutPosTimer    = null;
  var _tutUnsub       = null;
  var _p1ActionPoints = 20;
  var _p2ActionPoints = 0;

  var SHORT = { Infantry:'INF', Cavalry:'CAV', Tanks:'TNK', Motorized:'MOT', Artillery:'ART' };

  /* ── Tutorial event bus ──────────────────────────────────────── */
  function _tutEmit(evt) {
    _tutListeners.slice().forEach(function(fn) { try { fn(evt); } catch(e) {} });
  }

  /* ── Tutorial steps ──────────────────────────────────────────── */
  var TUT_STEPS = [
    { id:'intro', kind:'modal',
      title:'Welcome, Commander.',
      body:'Your army is in <strong>blue</strong>, the enemy in <strong>red</strong>. Reach the enemy back row, or eliminate their force, to win.<br><br>This quick walkthrough shows you the controls.',
      prompt:'Click NEXT when ready.',
    },
    { id:'ap', kind:'read', target:'#twp-ap-widget',
      title:'01 · Action Points',
      body:'You spend <strong>Action Points</strong> to act. <strong>Move&nbsp;= 1&nbsp;AP</strong>, <strong>Attack&nbsp;= 2&nbsp;AP</strong>, <strong>Rotate&nbsp;= free</strong>. You start with <strong>20&nbsp;AP</strong> — unspent points <strong>carry over</strong> next turn.',
      prompt:'Read the widget, then click NEXT.',
    },
    { id:'select', kind:'do', target:'.twp-unit.twp-p1',
      title:'02 · Select a Unit',
      body:'Click one of your <strong>blue-framed</strong> units on the map. Each unit can act up to <strong>2 times per turn</strong>. Gold squares show where it can move.',
      prompt:'Click any blue unit on the map.',
      expect:'unit-selected',
    },
    { id:'move', kind:'do', target:'.cell.legal-move',
      title:'03 · Move',
      body:'<strong>Gold squares</strong> show every legal move. Click one to advance. Forest and mountains cost extra movement.',
      prompt:'Click a gold square to move your unit.',
      expect:'unit-moved',
    },
    { id:'attack-mode', kind:'do', target:'#twp-btn-attack',
      title:'04 · Attack Mode',
      body:'Switch to <strong>Attack</strong> mode — click the button or press <strong>A</strong>. Enemies within reach glow red.',
      prompt:'Click the ATTACK button (or press A).',
      expect:'mode-attack',
    },
    { id:'strike', kind:'do', target:null,
      title:'05 · Strike',
      body:'Red-highlighted cells are valid targets. <strong>Rear attacks</strong> deal more damage — facing matters. Costs <strong>2&nbsp;AP</strong>. Watch for the damage number and counter-strike!',
      prompt:'Click a red-highlighted enemy. (Click NEXT to skip if none in range.)',
      expect:'attack-resolved', allowSkip:true,
    },
    { id:'effects', kind:'read', target:'#twp-selection-info',
      title:'06 · Unit Effects',
      body:'<strong>Infantry &amp; Cavalry</strong> that hold position for 3&nbsp;turns dig a <strong>trench</strong> (+DEF). Move a light unit onto a friendly to enter <strong>formation</strong> (combined DEF). Active effects appear in the Selected Unit card.',
      prompt:'Read, then click NEXT.',
    },
    { id:'end', kind:'do', target:'#twp-btn-end',
      title:'07 · End Your Turn',
      body:'When done, press <strong>End Turn</strong>. The board <strong>rotates 180°</strong> — each player always faces forward. Unused AP banks for later.',
      prompt:'Click END TURN (or press SPACE).',
      expect:'turn-ended',
    },
    { id:'done', kind:'modal',
      title:'You have the conn, Commander.',
      body:'Two ways to win:<br>&nbsp;&nbsp;<strong>▸</strong> Eliminate every enemy unit.<br>&nbsp;&nbsp;<strong>▸</strong> Move any unit into the enemy back row.<br><br>Good luck out there.',
      prompt:'Close to begin the battle.',
      finalLabel:'BEGIN BATTLE ✓',
    },
  ];

  /* ── Tutorial display ────────────────────────────────────────── */
  function _showTutorial() {
    var overlay = document.getElementById('twp-tutorial');
    if (!overlay) return;
    _tutStep = 0; _tutDoneOk = false; _tutListeners = [];
    overlay.style.display = '';
    document.getElementById('map-root') && document.getElementById('map-root').classList.add('twp-tutorial-on');
    _renderTutorialStep();
  }

  function _renderTutorialStep() {
    if (_tutUnsub)   { _tutUnsub(); _tutUnsub = null; }
    if (_tutPosTimer){ clearInterval(_tutPosTimer); _tutPosTimer = null; }
    _tutDoneOk = false;

    var step    = TUT_STEPS[_tutStep];
    if (!step)  { _closeTutorial(); return; }
    var isFinal = _tutStep === TUT_STEPS.length - 1;
    var $ = function(id) { return document.getElementById(id); };

    if ($('twp-tutorial-kicker'))
      $('twp-tutorial-kicker').textContent = (step.kind === 'modal') ? 'FIELD ORIENTATION' : 'STEP ' + _tutStep + ' OF ' + (TUT_STEPS.length - 2);
    if ($('twp-tutorial-title')) $('twp-tutorial-title').textContent = step.title;
    if ($('twp-tutorial-body'))  $('twp-tutorial-body').innerHTML   = step.body;

    var promptEl = $('twp-tutorial-prompt');
    if (promptEl) {
      promptEl.innerHTML     = step.prompt || '';
      promptEl.style.display = step.prompt ? '' : 'none';
      promptEl.className     = 'twp-tutorial-prompt';
    }

    var nextBtn = $('twp-tutorial-next');
    if (nextBtn) {
      nextBtn.disabled    = false;
      nextBtn.textContent = isFinal ? (step.finalLabel || 'GOT IT ✓') : 'NEXT ▸';
      nextBtn.onclick     = function() { if (isFinal) _closeTutorial(); else _nextTutorialStep(); };
    }
    var skipBtn = $('twp-tutorial-skip');
    if (skipBtn) { skipBtn.textContent = isFinal ? 'CLOSE' : 'SKIP TUTORIAL'; skipBtn.onclick = _closeTutorial; }

    _tutUpdateProgress();
    _tutPositionCard(step);

    /* backdrop: do-steps must pass clicks through to the map */
    var backdrop = $('twp-tutorial-backdrop');
    if (backdrop) {
      backdrop.style.background   = 'transparent';
      backdrop.style.pointerEvents = step.kind === 'do' ? 'none' : 'auto';
    }

    /* action gating for 'do' steps */
    if (step.kind === 'do' && step.expect) {
      var gateEvt = step.expect;
      var gateFn  = function(evt) {
        if (evt !== gateEvt) return;
        _tutDoneOk = true;
        if (promptEl) promptEl.className = 'twp-tutorial-prompt complete';
        setTimeout(function() {
          if (_tutStep >= 0 && TUT_STEPS[_tutStep] && TUT_STEPS[_tutStep].expect === gateEvt)
            _nextTutorialStep();
        }, 700);
      };
      _tutListeners.push(gateFn);
      _tutUnsub = function() {
        _tutListeners = _tutListeners.filter(function(f) { return f !== gateFn; });
      };
    }

    /* reposition every ~400 ms (handles board rotation / layout shift) */
    _tutPosTimer = setInterval(function() {
      if (_tutStep >= 0 && TUT_STEPS[_tutStep]) _tutPositionCard(TUT_STEPS[_tutStep]);
    }, 400);
  }

  function _tutPositionCard(step) {
    var card = document.getElementById('twp-tutorial-card');
    if (!card) return;

    var targetEl = null;
    if (step && step.target) {
      try { targetEl = document.querySelector(step.target); } catch(e) {}
    }

    _tutDrawSpotlight(targetEl);

    if (!targetEl || step.kind === 'modal') {
      card.className  = 'tut-center';
      card.style.top  = '';
      card.style.left = '';
      return;
    }

    card.className = '';
    var rect  = targetEl.getBoundingClientRect();
    var cardW = 340, cardH = card.offsetHeight || 300, gap = 22;
    var sp    = {
      right:  window.innerWidth  - rect.right  - gap,
      left:   rect.left          - gap,
      bottom: window.innerHeight - rect.bottom - gap,
      top:    rect.top           - gap,
    };

    var side = 'right';
    if      (sp.right  >= cardW + 10) side = 'right';
    else if (sp.left   >= cardW + 10) side = 'left';
    else if (sp.bottom >= cardH + 10) side = 'bottom';
    else                              side = 'top';

    var l, t;
    if (side === 'right')  { l = rect.right + gap; t = Math.max(12, Math.min(window.innerHeight - cardH - 12, rect.top + rect.height/2 - cardH/2)); }
    else if (side === 'left')   { l = rect.left - cardW - gap; t = Math.max(12, Math.min(window.innerHeight - cardH - 12, rect.top + rect.height/2 - cardH/2)); }
    else if (side === 'bottom') { l = Math.max(12, Math.min(window.innerWidth - cardW - 12, rect.left + rect.width/2 - cardW/2)); t = rect.bottom + gap; }
    else                        { l = Math.max(12, Math.min(window.innerWidth - cardW - 12, rect.left + rect.width/2 - cardW/2)); t = rect.top - cardH - gap; }

    card.style.left = l + 'px';
    card.style.top  = t + 'px';
  }

  function _tutDrawSpotlight(targetEl) {
    var svg = document.getElementById('twp-tutorial-mask');
    if (!svg) return;
    if (!targetEl) {
      svg.innerHTML = '<rect x="0" y="0" width="100%" height="100%" fill="rgba(5,4,2,0.62)"/>';
      return;
    }
    var r = targetEl.getBoundingClientRect(), p = 8;
    var x = r.left - p, y = r.top - p, w = r.width + p*2, h = r.height + p*2;
    svg.innerHTML =
      '<defs><mask id="tut-hole">' +
        '<rect x="0" y="0" width="100%" height="100%" fill="white"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="black"/>' +
      '</mask></defs>' +
      '<rect x="0" y="0" width="100%" height="100%" fill="rgba(5,4,2,0.68)" mask="url(#tut-hole)"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="4" fill="none" stroke="#ffd34a" stroke-width="2.5">' +
        '<animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="1.4s" repeatCount="indefinite"/>' +
      '</rect>';
  }

  function _tutUpdateProgress() {
    var prog = document.getElementById('twp-tutorial-progress');
    if (!prog) return;
    prog.innerHTML = '';
    for (var i = 0; i < TUT_STEPS.length; i++) {
      var dot = document.createElement('span');
      dot.className = 'tut-dot' + (i < _tutStep ? ' done' : i === _tutStep ? ' active' : '');
      prog.appendChild(dot);
    }
  }

  function _nextTutorialStep() {
    if (_tutUnsub)   { _tutUnsub(); _tutUnsub = null; }
    if (_tutPosTimer){ clearInterval(_tutPosTimer); _tutPosTimer = null; }
    _tutStep++;
    if (_tutStep >= TUT_STEPS.length) { _closeTutorial(); return; }
    _renderTutorialStep();
  }

  function _closeTutorial() {
    if (_tutUnsub)   { _tutUnsub(); _tutUnsub = null; }
    if (_tutPosTimer){ clearInterval(_tutPosTimer); _tutPosTimer = null; }
    _tutListeners = []; _tutStep = -1; _tutDoneOk = false;
    var overlay = document.getElementById('twp-tutorial');
    if (overlay) overlay.style.display = 'none';
    var svg = document.getElementById('twp-tutorial-mask');
    if (svg) svg.innerHTML = '';
    var mapRoot = document.getElementById('map-root');
    if (mapRoot) mapRoot.classList.remove('twp-tutorial-on');
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
      formationPartnerId: null,
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

  /* ── Action-point helpers ─────────────────────────────────── */
  function _getAP() { return _currentPlayer === 1 ? _p1ActionPoints : _p2ActionPoints; }
  function _spendAP(n) {
    if (_currentPlayer === 1) _p1ActionPoints = Math.max(0, _p1ActionPoints - n);
    else                      _p2ActionPoints = Math.max(0, _p2ActionPoints - n);
  }

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
    _p1ActionPoints    = 20;
    _p2ActionPoints    = 0;
    _boardTrenches     = {};

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
          formationPartnerId: null,
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
          formationPartnerId: null,
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
            formationPartnerId: null,
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
            formationPartnerId: null,
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
            formationPartnerId: null,
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
      if (occ && occ.player === _currentPlayer && occ.actionsRemaining > 0 && _getAP() > 0) {
        _selectedId = occ.id;
        _tutEmit('unit-selected');
      }
      _renderAllUnits(); _renderDossier(); return;
    }

    var sel = _units.find(function (u) { return u.id === _selectedId; });
    if (!sel) { _selectedId = null; _renderAllUnits(); _renderDossier(); return; }

    // In rotate mode: clicking own cell does nothing (avoids accidental deselect)
    if (occ && occ.id === _selectedId) {
      if (_mode === 'rotate') return;
      _selectedId = null; _renderAllUnits(); _renderDossier(); return;
    }
    if (occ && occ.player === _currentPlayer && occ.actionsRemaining > 0 && _getAP() > 0) {
      /* Formation entry: if in move mode and canMoveTo allows stacking, move rather than re-select */
      if (_mode === 'move' && sel && _getAP() >= 1 &&
          window.Combat.canMoveTo(sel, row, col, _units, _biomeAt, _gridRows, _gridCols)) {
        _doMove(sel, row, col); return;
      }
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
      if (_getAP() >= 2 && window.Combat.canAttack(sel, occ)) { _doAttack(sel, occ); return; }
    }

    if (_mode === 'move' && occ && occ.player !== _currentPlayer) {
      if (_getAP() >= 2 && window.Combat.canAttack(sel, occ)) { _doAttack(sel, occ); return; }
    }

    if (_mode === 'move' && !occ) {
      if (_getAP() >= 1 && window.Combat.canMoveTo(sel, row, col, _units, _biomeAt, _gridRows, _gridCols)) {
        _doMove(sel, row, col); return;
      }
    }
  }

  /* ── Board-trench helpers ───────────────────────────────────── */
  function _markBoardTrench(row, col, type) {
    var k = row + ',' + col;
    _boardTrenches[k] = { type: type || 'basic' };
    var cellEl = window.MapRenderer && window.MapRenderer.getCellEl(row, col);
    if (cellEl) {
      cellEl.classList.remove('twp-btrench', 'twp-btrench-perm');
      cellEl.classList.add(type === 'perm' ? 'twp-btrench-perm' : 'twp-btrench');
    }
  }
  function _clearBoardTrench(row, col) {
    delete _boardTrenches[row + ',' + col];
    var cellEl = window.MapRenderer && window.MapRenderer.getCellEl(row, col);
    if (cellEl) cellEl.classList.remove('twp-btrench', 'twp-btrench-perm');
  }
  function _clearAllBoardTrenches() {
    Object.keys(_boardTrenches).forEach(function (k) {
      var p = k.split(',');
      var cellEl = window.MapRenderer && window.MapRenderer.getCellEl(+p[0], +p[1]);
      if (cellEl) cellEl.classList.remove('twp-btrench', 'twp-btrench-perm');
    });
    _boardTrenches = {};
  }

  /* ── Formation ──────────────────────────────────────────────── */
  function _doFormation(mover, target) {
    /* Handle board trench at mover's old position */
    var oldKey = mover.row + ',' + mover.col;
    var existingOldBT = _boardTrenches[oldKey];
    if (existingOldBT) {
      if (existingOldBT.type !== 'perm' && mover.turnsStill < 4) _clearBoardTrench(mover.row, mover.col);
    } else if (mover.turnsStill >= 4) {
      _markBoardTrench(mover.row, mover.col, mover.turnsStill >= 6 ? 'perm' : 'basic');
    }
    /* Check for board trench at formation destination */
    var destKey = target.row + ',' + target.col;
    var destBT = _boardTrenches[destKey];
    var immediateTrench = false;
    if (destBT && window.Combat.UNIT_STATS[mover.type].trench && _biomeAt(target.row, target.col) !== 'S') {
      immediateTrench = destBT.type === 'perm' ? 'perm' : true;
    }
    _spendAP(1);
    _mutate(mover.id, {
      row: target.row, col: target.col, facing: mover.facing,
      actionsRemaining: Math.max(0, mover.actionsRemaining - 1),
      turnsStill: 0, trenched: immediateTrench, movedThisTurn: true,
      formationPartnerId: target.id,
    });
    _mutate(target.id, { formationPartnerId: mover.id });
    _pushLog({ kind:'mv', text: SHORT[mover.type]+' P'+mover.player+' joins '+SHORT[target.type]+' — FORMATION.' });
    var upd = _units.find(function (u) { return u.id === mover.id; });
    if (upd && upd.actionsRemaining <= 0) _selectedId = null;
    _checkWinner();
    _checkEndReached();
    _applyConquest(mover.player, target.row, target.col);
    _renderAllUnits(); _renderDossier();
  }

  /* ── Move ───────────────────────────────────────────────────── */
  function _doMove(unit, tr, tc) {
    /* Dispatch to formation if moving onto a friendly light unit */
    var targetUnit = _units.find(function (u) { return u.row === tr && u.col === tc && u.player === unit.player; });
    if (targetUnit) { _doFormation(unit, targetUnit); return; }

    /* Board trench at old position: leave one if unit held long enough */
    var oldKey = unit.row + ',' + unit.col;
    var existingBT = _boardTrenches[oldKey];
    if (existingBT) {
      if (existingBT.type !== 'perm' && unit.turnsStill < 4) {
        _clearBoardTrench(unit.row, unit.col);
      }
      /* Permanent trench: never removed. Basic + held >= 4 turns: refresh (no change). */
    } else if (unit.turnsStill >= 4) {
      var trType = unit.turnsStill >= 6 ? 'perm' : 'basic';
      _markBoardTrench(unit.row, unit.col, trType);
      _pushLog({ kind:'mv', text: SHORT[unit.type]+' P'+unit.player+' left a trench at ('+unit.row+','+unit.col+').' });
    }

    /* Check for board trench at destination — immediate occupation bonus */
    var destKey = tr + ',' + tc;
    var destBT = _boardTrenches[destKey];
    var immediateTrench = false;
    if (destBT && window.Combat.UNIT_STATS[unit.type].trench && _biomeAt(tr, tc) !== 'S') {
      immediateTrench = destBT.type === 'perm' ? 'perm' : true;
      _pushLog({ kind:'mv', text: SHORT[unit.type]+' P'+unit.player+' uses standing trench.' });
    }

    var dr = tr - unit.row, dc = tc - unit.col;
    var f = unit.facing;
    if (Math.abs(dr) >= Math.abs(dc)) f = dr < 0 ? 'N' : (dr > 0 ? 'S' : f);
    else                              f = dc < 0 ? 'W' : (dc > 0 ? 'E' : f);
    var biomeNames = { P:'PLAIN', F:'FOREST', M:'MOUNTAIN', S:'SWAMP' };
    _spendAP(1);
    _mutate(unit.id, {
      row: tr, col: tc, facing: f,
      actionsRemaining: Math.max(0, unit.actionsRemaining - 1),
      turnsStill: 0, trenched: immediateTrench, movedThisTurn: true,
    });
    _pushLog({ kind:'mv', text: SHORT[unit.type]+' P'+unit.player+' → ('+tr+','+tc+') ['+
      (biomeNames[_biomeAt(tr,tc)]||'PLAIN')+']'+(unit.trenched?' (trench lost)':'')+'.' });
    var upd = _units.find(function (u) { return u.id === unit.id; });
    if (upd && upd.actionsRemaining <= 0) _selectedId = null;
    _checkWinner();
    _checkEndReached();
    _applyConquest(unit.player, tr, tc);
    _renderAllUnits(); _renderDossier();
    _tutEmit('unit-moved');
  }

  /* ── Attack effect (damage pop + impact mark + shake) ────────── */
  function _showAttackEffect(row, col, damage, kind) {
    var cellEl = window.MapRenderer.getCellEl(row, col);
    if (!cellEl) return;

    var mark = document.createElement('div');
    mark.className = 'impact-mark';
    cellEl.appendChild(mark);
    setTimeout(function() { if (mark.parentNode) mark.remove(); }, 900);

    var wrap = document.createElement('div');
    wrap.className = 'dmg-pop-wrap';
    var pop = document.createElement('div');
    pop.className = 'dmg-pop' + (kind === 'counter' ? ' counter' : '');
    pop.textContent = '−' + damage;
    wrap.appendChild(pop);
    cellEl.appendChild(wrap);
    setTimeout(function() { if (wrap.parentNode) wrap.remove(); }, 1300);

    cellEl.classList.add('attack-shake');
    setTimeout(function() { cellEl.classList.remove('attack-shake'); }, 500);
  }

  /* ── Attack ─────────────────────────────────────────────────── */
  function _doAttack(attacker, defender) {
    _spendAP(2);
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
    _showAttackEffect(defender.row, defender.col, r.damage, 'hit');

    var defAlive = _units.find(function (u) { return u.id === defender.id; });
    var atkAlive = _units.find(function (u) { return u.id === attacker.id; });
    /* Formation units cannot counter-attack (§ 4.3) */
    if (defAlive && atkAlive && defAlive.actionsRemaining > 0 &&
        !defAlive.formationPartnerId &&
        window.Combat.canAttack(defAlive, atkAlive)) {
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
      if (cr.damage > 0) _showAttackEffect(atkAlive.row, atkAlive.col, cr.damage, 'counter');
    }

    var postAtk = _units.find(function (u) { return u.id === attacker.id; });
    if (!postAtk || postAtk.actionsRemaining <= 0) _selectedId = null;

    _checkWinner();
    _renderAllUnits(); _renderDossier();
    _tutEmit('attack-resolved');
  }

  function _detail(atk, def, r, newHp) {
    var aStr  = window.Combat.UNIT_STATS[atk.type].strength;
    var defEff = window.Combat.effectiveDefense(def, _biomeAt, _units);
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
        var onBoardTrench = !!_boardTrenches[u.row + ',' + u.col];
        var newTrenched = false;
        if (canTrench) {
          if (newStill >= 6) {
            newTrenched = 'perm';
          } else if (newStill >= 3 || (onBoardTrench && !u.movedThisTurn)) {
            newTrenched = (onBoardTrench && _boardTrenches[u.row+','+u.col].type === 'perm') ? 'perm' : true;
          }
        }
        if (newTrenched === 'perm' && u.trenched !== 'perm') {
          _pushLog({ kind:'mv', text: SHORT[u.type]+' P'+u.player+' — TRENCH PERMANENT (+1 def).' });
        } else if (newTrenched && !u.trenched) {
          _pushLog({ kind:'mv', text: SHORT[u.type]+' P'+u.player+' digs in — TRENCH.' });
        }
        return Object.assign({}, u, { turnsStill: newStill, trenched: newTrenched, movedThisTurn: false });
      }
      if (u.player === next) return Object.assign({}, u, { actionsRemaining: 2, movedThisTurn: false });
      return u;
    });

    // Carry over remaining points + grant next player 20 new points
    if (next === 1) _p1ActionPoints += 20;
    else            _p2ActionPoints += 20;
    _currentPlayer = next;
    _selectedId    = null;
    _mode          = 'move';
    _turnNo       += 1;
    _boardRot      = (_boardRot + 180) % 360;
    _pushLog({ kind:'turn', text: '◆ PLAYER '+next+' — TURN '+_turnNo+' ◆' });
    _renderAllUnits(); _renderDossier();
    _tutEmit('turn-ended');
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
    _p1ActionPoints  = 20;
    _p2ActionPoints  = 0;

    document.querySelectorAll('#map-root .twp-unit').forEach(function (el) { el.remove(); });
    _clearZoneOverlays();
    _clearConquest();
    _clearAllBoardTrenches();
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
    /* If this unit was in a formation, free the partner */
    var dead = _units.find(function (u) { return u.id === id; });
    if (dead && dead.formationPartnerId) {
      _mutate(dead.formationPartnerId, { formationPartnerId: null });
    }
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
    if (cellEl) {
      cellEl.classList.add('twp-breach-flash');
      setTimeout(function () { cellEl.classList.remove('twp-breach-flash'); }, 1500);
    }
    var mmRoot = document.getElementById('minimap-root');
    if (mmRoot) {
      var mmCell = mmRoot.querySelector('.mm-cell[data-row="' + row + '"][data-col="' + col + '"]');
      if (mmCell) {
        mmCell.classList.add('twp-mm-breach-flash');
        setTimeout(function () { mmCell.classList.remove('twp-mm-breach-flash'); }, 1500);
      }
    }
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
    cellEl.classList.add('attack-target', 'attack-flash');
    clearTimeout(_flashTimeout);
    _flashTimeout = setTimeout(function () {
      if (_active) { cellEl.classList.remove('attack-target'); cellEl.classList.remove('attack-flash'); }
    }, 900);
  }

  /* ── Compute move / attack hints ─────────────────────────────── */
  function _computeHints() {
    var moveSet = {}, attackSet = {};
    if (!_selectedId) return { moveSet: moveSet, attackSet: attackSet };
    var sel = _units.find(function (u) { return u.id === _selectedId; });
    if (!sel || sel.actionsRemaining <= 0) return { moveSet: moveSet, attackSet: attackSet };
    var ap = _getAP();
    if (_mode === 'move' && ap >= 1) {
      for (var r = 1; r <= _gridRows; r++) {
        for (var c = 1; c <= _gridCols; c++) {
          if (window.Combat.canMoveTo(sel, r, c, _units, _biomeAt, _gridRows, _gridCols)) moveSet[r+','+c] = true;
        }
      }
    } else if (_mode === 'attack' && ap >= 2) {
      _units.forEach(function (t) {
        if (t.player !== sel.player && window.Combat.canAttack(sel, t)) attackSet[t.row+','+t.col] = true;
      });
    }
    return { moveSet: moveSet, attackSet: attackSet };
  }

  var _FROT = { N: -90, S: 90, E: 0, W: 180 };
  var _FDR  = { N: -1, S: 1, E: 0, W: 0 };
  var _FDC  = { N: 0, S: 0, E: 1, W: -1 };

  /* ── Unit DOM rendering ───────────────────────────────────────── */
  function _renderAllUnits() {
    _markTargetRows();
    var hints = _computeHints();

    // Clear cell highlights and old facing indicators
    document.querySelectorAll('#map-root .cell').forEach(function (el) {
      el.classList.remove('legal-move', 'attack-target', 'sel-cell');
    });
    document.querySelectorAll('#map-root .unit-facing').forEach(function (el) { el.remove(); });
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
      var wantExhausted = unit.player === _currentPlayer && unit.actionsRemaining <= 0;
      var wantLowHp     = unit.hp <= Math.ceil(unit.maxHp / 2) && unit.hp < unit.maxHp;
      el.classList.toggle('selected',  wantSelected);
      el.classList.toggle('exhausted', wantExhausted);
      el.classList.toggle('low-hp',    wantLowHp);

      // Force animation start on new elements (handles GIF delay)
      if (isNew) {
        el.style.animationPlayState = 'running';
        void el.offsetWidth;
      }

      // Counter-rotate the inner wrapper
      var inner = el.querySelector('.unit-inner');
      if (inner) inner.style.transform = '';

      // AP tag: show for own units with actions, hide when selected or exhausted
      var apTag = el.querySelector('.unit-ap-tag');
      if (apTag) {
        var showTag = unit.player === _currentPlayer && !wantSelected && !wantExhausted;
        apTag.style.display = showTag ? '' : 'none';
        apTag.textContent = unit.actionsRemaining + '/2';
      }

      _updateHpPips(el, unit);
      _updateStatusIcons(el, unit);
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
        if (sc) sc.classList.add('sel-cell');
      }
    }

    // Place ">" facing chevron on each unit (outside .unit-inner so board-rotation bakes in)
    _units.forEach(function (unit) {
      var unitEl = _unitEls[unit.id];
      if (!unitEl) return;
      var fi = unitEl.querySelector('.unit-facing');
      if (!fi) {
        fi = document.createElement('span');
        fi.className = 'unit-facing facing-p' + unit.player;
        fi.textContent = '>';
        unitEl.appendChild(fi);
      }
      var offset = 16;
      var flip = _boardRot === 180 ? -1 : 1;
      var tx = flip * (_FDC[unit.facing] || 0) * offset;
      var ty = flip * (_FDR[unit.facing] || 0) * offset;
      fi.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) rotate(' + ((_FROT[unit.facing] || 0) + _boardRot) + 'deg)';
    });

    // Rotate the board and compass
    var mapRoot = document.getElementById('map-root');
    if (mapRoot) {
      mapRoot.style.transform = 'rotate(' + _boardRot + 'deg)';
      var cellRot = _boardRot ? 'rotate(' + (-_boardRot) + 'deg)' : '';
      mapRoot.querySelectorAll('.cell').forEach(function (cell) { cell.style.transform = cellRot; });
    }
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
        document.querySelectorAll('.twp-unit[data-unit-type="' + type + '"] .unit-inner img.unit-sprite').forEach(function(img) {
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

    /* inner wrapper — counter-rotates independently of the bob animation */
    var inner = document.createElement('div');
    inner.className = 'unit-inner';

    var img = document.createElement('img');
    img.className = 'unit-sprite';
    img.src = _cachedSprites[unit.type] || UNIT_SPRITE[unit.type] || UNIT_SPRITE.Infantry;
    img.alt = unit.type;
    img.draggable = false;
    inner.appendChild(img);

    /* HP pip bar */
    var hpBar = document.createElement('div');
    hpBar.className = 'unit-hp';
    for (var i = 0; i < unit.maxHp; i++) {
      var pip = document.createElement('div');
      pip.className = 'hp-pip' + (i >= unit.hp ? ' lost' : '');
      hpBar.appendChild(pip);
    }
    inner.appendChild(hpBar);

    /* AP remaining tag — hidden when selected or no actions */
    var apTag = document.createElement('span');
    apTag.className = 'unit-ap-tag';
    apTag.textContent = unit.actionsRemaining + '/2';
    apTag.style.display = 'none';
    inner.appendChild(apTag);

    /* Effect badges container (trench · formation) */
    var effBox = document.createElement('div');
    effBox.className = 'unit-effects';
    inner.appendChild(effBox);

    el.appendChild(inner);

    /* Facing chevron — outside inner so board-rotation bakes in automatically */
    var fi = document.createElement('span');
    fi.className = 'unit-facing facing-p' + unit.player;
    fi.textContent = '>';
    el.appendChild(fi);

    return el;
  }

  function _updateStatusIcons(el, unit) {
    var effBox = el.querySelector('.unit-effects');
    if (!effBox) return;
    effBox.innerHTML = '';
    if (unit.trenched) {
      var tb = document.createElement('div');
      tb.className = 'effect-badge eb-trench' + (unit.trenched === 'perm' ? ' eb-perm' : '');
      tb.title = unit.trenched === 'perm' ? 'Permanent Trench (+1 def)' : 'Entrenched (Inf +2 / Cav +1.5 def)';
      var ti = document.createElement('img');
      ti.src = '../assets/game-icons/trench.png'; ti.alt = 'TRENCH';
      tb.appendChild(ti); effBox.appendChild(tb);
    }
    if (unit.formationPartnerId) {
      var fb = document.createElement('div');
      fb.className = 'effect-badge eb-formation';
      fb.title = 'Formation — combined DEF, no move, no counter';
      var fi2 = document.createElement('img');
      fi2.src = '../assets/game-icons/formation.png'; fi2.alt = 'FORM';
      fb.appendChild(fi2); effBox.appendChild(fb);
    }
  }

  function _updateHpPips(el, unit) {
    var hpBar = el.querySelector('.unit-hp');
    if (!hpBar) return;
    var pips = hpBar.querySelectorAll('.hp-pip');
    pips.forEach(function (pip, i) {
      pip.className = 'hp-pip' + (i >= unit.hp ? ' lost' : '');
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
    b('twp-btn-rotate', function () {
      var sel = _selectedId ? _units.find(function (u) { return u.id === _selectedId; }) : null;
      if (sel && sel.player === _currentPlayer && sel.actionsRemaining > 0) {
        var order = ['N', 'E', 'S', 'W'];
        var nextFacing = order[(order.indexOf(sel.facing) + 1) % 4];
        _mutate(sel.id, { facing: nextFacing });
        _pushLog({ kind: 'mv', text: SHORT[sel.type] + ' P' + sel.player + ' rotates → ' + nextFacing + '.' });
        _renderAllUnits(); _renderDossier();
      } else {
        _setMode('rotate');
      }
    });

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
    _tutEmit('mode-' + m);
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

    // Selection info — rich sel-card
    var infoEl = document.getElementById('twp-selection-info');
    if (infoEl) {
      var sel = _selectedId ? _units.find(function (u) { return u.id === _selectedId; }) : null;
      if (!sel) {
        infoEl.innerHTML = '<div class="sel-card"><div class="sel-empty">No unit selected.<br>Click a token on the map.</div></div>';
      } else {
        var defEff  = window.Combat.effectiveDefense(sel, _biomeAt, _units);
        var stats   = window.Combat.UNIT_STATS[sel.type];
        var biome   = _biomeAt(sel.row, sel.col);
        var bLabel  = { P:'PLAIN', F:'FOREST', M:'MOUNTAIN', S:'SWAMP' }[biome] || 'PLAIN';
        var terrDef = (window.Combat.TERRAIN_DEF && window.Combat.TERRAIN_DEF[biome] && window.Combat.TERRAIN_DEF[biome][sel.type]) || 0;
        var ranks   = ['','PRIVATE','CORPORAL','CAPTAIN','COLONEL'];
        var lvl     = sel.level || 1;
        var rank    = ranks[lvl] || 'PRIVATE';
        var lowHp   = sel.hp <= Math.ceil(sel.maxHp / 2);

        var pipsHtml = '';
        for (var pi = 0; pi < sel.maxHp; pi++) {
          pipsHtml += '<div class="pip' + (pi >= sel.hp ? ' lost' : '') + '"></div>';
        }

        var effs = [];
        if (sel.trenched) {
          var isPerm = sel.trenched === 'perm';
          var tDef   = isPerm ? 1 : (stats.trench ? (sel.type === 'Infantry' ? 2 : 1.5) : 0);
          effs.push('<div class="eff-row active-trench">' +
            '<div class="eff-icon"><img src="../assets/game-icons/trench.png" alt="trench"></div>' +
            '<div><div class="eff-name">' + (isPerm ? 'Permanent Trench' : 'Trench (basic)') + '</div>' +
            '<div class="eff-desc">+' + tDef + ' DEF' + (isPerm ? ' · permanent' : ' · vanishes on move') + '</div></div></div>');
        }
        if (sel.formationPartnerId) {
          effs.push('<div class="eff-row active-formation">' +
            '<div class="eff-icon"><img src="../assets/game-icons/formation.png" alt="formation"></div>' +
            '<div><div class="eff-name">Formation</div>' +
            '<div class="eff-desc">Combined DEF · no move · no counter</div></div></div>');
        }
        if (lowHp) {
          effs.push('<div class="eff-row active-low-hp">' +
            '<div class="eff-icon"><span class="eff-icon-glyph">!</span></div>' +
            '<div><div class="eff-name">Critical HP</div><div class="eff-desc">Below half health.</div></div></div>');
        }
        if (sel.actionsRemaining <= 0 && sel.player === _currentPlayer) {
          effs.push('<div class="eff-row active-exhausted">' +
            '<div class="eff-icon"><span class="eff-icon-glyph" style="color:var(--olive)">×</span></div>' +
            '<div><div class="eff-name">Exhausted</div><div class="eff-desc">No actions remaining.</div></div></div>');
        }

        var sprSrc = _cachedSprites[sel.type] || UNIT_SPRITE[sel.type] || '';
        infoEl.innerHTML =
          '<div class="sel-card">' +
            '<div class="sel-head">' +
              '<div class="sel-portrait ' + (sel.player === 1 ? 'p1' : 'p2') + '">' +
                '<img src="' + sprSrc + '" alt="' + sel.type + '">' +
              '</div>' +
              '<div>' +
                '<div class="sel-name">' + sel.type.toUpperCase() + '</div>' +
                '<div class="sel-class"><span class="sel-rank lvl-' + lvl + '">L' + lvl + ' · ' + rank + '</span></div>' +
                '<div class="sel-class" style="margin-top:3px;">Facing ' + sel.facing + ' · ' + bLabel + (terrDef > 0 ? ' (+' + terrDef + ' DEF)' : '') + '</div>' +
              '</div>' +
              '<span class="sel-stamp-mini ' + (sel.player === 1 ? 'p1' : 'p2') + '">P' + sel.player + '</span>' +
            '</div>' +
            '<div class="sel-stats">' +
              '<div class="sel-stat"><div class="sel-stat-label">HP</div>' +
                '<div class="sel-stat-val nb">' + sel.hp + '<span class="small">/' + sel.maxHp + '</span></div>' +
                '<div class="sel-hp-bar' + (lowHp ? ' low' : '') + '">' + pipsHtml + '</div></div>' +
              '<div class="sel-stat"><div class="sel-stat-label">Actions</div>' +
                '<div class="sel-stat-val">' + sel.actionsRemaining + '<span class="small">/2</span></div></div>' +
              '<div class="sel-stat"><div class="sel-stat-label">Reach</div>' +
                '<div class="sel-stat-val">' + stats.reach + '</div></div>' +
              '<div class="sel-stat"><div class="sel-stat-label">STR</div>' +
                '<div class="sel-stat-val nb">' + stats.strength + '</div></div>' +
              '<div class="sel-stat"><div class="sel-stat-label">DEF</div>' +
                '<div class="sel-stat-val nb">' + defEff.total.toFixed(1) + '</div></div>' +
              '<div class="sel-stat"><div class="sel-stat-label">Move</div>' +
                '<div class="sel-stat-val">' + stats.movement.ortho + '<span class="small">/' + stats.movement.diag + '</span></div></div>' +
            '</div>' +
            '<div class="sel-effects">' +
              '<div class="sel-effects-label">Active Effects</div>' +
              (effs.length ? effs.join('') : '<div class="sel-empty-effects">// none active</div>') +
            '</div>' +
          '</div>';
      }
    }

    // Mode buttons
    var sel2  = _selectedId ? _units.find(function (u) { return u.id === _selectedId; }) : null;
    var noAct = !sel2 || sel2.actionsRemaining <= 0;
    var inFormation = !!(sel2 && sel2.formationPartnerId);
    var hasAtk = sel2 && _units.some(function (t) { return t.player !== sel2.player && window.Combat.canAttack(sel2, t); });
    var ap = _getAP();
    _btnState('twp-btn-move',   _mode === 'move',   noAct || ap < 1 || inFormation);
    _btnState('twp-btn-attack', _mode === 'attack', noAct || !hasAtk || ap < 2);
    _btnState('twp-btn-rotate', _mode === 'rotate', false);

    // AP counter widget
    var apCountEl = document.getElementById('twp-ap-count');
    if (apCountEl) {
      apCountEl.textContent = ap;
      apCountEl.classList.toggle('twp-ap-low',   ap > 0 && ap <= 5);
      apCountEl.classList.toggle('twp-ap-empty', ap === 0);
    }
    var apWidgetEl = document.getElementById('twp-ap-widget');
    if (apWidgetEl) {
      apWidgetEl.classList.toggle('twp-ap-p1', _currentPlayer === 1);
      apWidgetEl.classList.toggle('twp-ap-p2', _currentPlayer === 2);
    }

    var hintEl = document.getElementById('twp-mode-hint');
    if (hintEl) {
      if (ap === 0) {
        hintEl.textContent = 'No action points — end your turn or rotate (free).';
      } else if (inFormation) {
        hintEl.textContent = 'Formation — cannot move. Rotate or attack only.';
      } else if (_mode === 'move') {
        hintEl.textContent = 'Move: 1 pt · Cyan = legal · Light units can stack = Formation.';
      } else if (_mode === 'attack') {
        hintEl.textContent = ap < 2 ? 'Need 2 pts to attack.' : (hasAtk ? 'Attack: 2 pts · Red = in reach · They counter!' : 'No enemies in reach.');
      } else {
        hintEl.textContent = 'Rotate: free · Click any cell for new facing direction.';
      }
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
