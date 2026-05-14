(function () {
  'use strict';

  var UNIT_ICONS = {
    Infantry:  '../assets/game-icons/infantry.png',
    Cavalry:   '../assets/game-icons/cavalry.png',
    Tanks:     '../assets/game-icons/tank.png',
    Motorized: '../assets/game-icons/motorized.png',
    Artillery: '../assets/game-icons/artillery.png',
  };
  var DOCTRINE_ICONS = {
    Plain:                '../assets/game-icons/plain.png',
    Blitzkrieg:           '../assets/game-icons/blitzkrieg.png',
    'Superior Firepower': '../assets/game-icons/superior_firepower.png',
  };

  var _advisorWired = false;

  function _wireAdvisor() {
    if (_advisorWired) return;
    _advisorWired = true;

    var out = document.getElementById('advisor-output');

    function _showAdvice(data, label) {
      if (!out) return;
      if (!data) {
        out.innerHTML = '<span style="color:#888;">Bridge offline — start the server first.</span>';
        return;
      }
      if (data.error) {
        out.innerHTML = '<span style="color:#e2b65a;">Error: ' + (data.message || data.error) + '</span>';
        return;
      }
      // /advise response
      if (data.recommendation && data.recommendation.reasoning) {
        var rec = data.recommendation;
        var notes = (data.strategicNotes || []).map(function (n) { return '• ' + n; }).join('<br>');
        out.innerHTML =
          '<b>' + label + '</b> — ' + rec.type.toUpperCase() + ' (P:' + rec.priority + ')<br>' +
          rec.reasoning +
          (notes ? '<br><span style="color:#888;">' + notes + '</span>' : '');
        return;
      }
      // /think response
      if (data.response) {
        var r = data.response;
        var body = r.assessment || '';
        if (r.recommendation) body += '<br><b>' + (r.recommendation.action || '') + '</b> ' + (r.recommendation.unitId || '') + ' — ' + (r.recommendation.reasoning || '');
        if (r.riskLevel) body += ' <span style="color:#e2b65a;">[' + r.riskLevel.toUpperCase() + ']</span>';
        out.innerHTML = '<b>' + label + '</b><br>' + body;
        return;
      }
      out.innerHTML = '<b>' + label + '</b><br><pre style="font-size:10px;white-space:pre-wrap;">' + JSON.stringify(data, null, 2) + '</pre>';
    }

    var btnAdvise = document.getElementById('btn-advise');
    if (btnAdvise) {
      btnAdvise.addEventListener('click', function () {
        if (!window.OrchestrationBridge || !window.OrchestrationBridge.isOnline()) {
          if (out) out.innerHTML = '<span style="color:#e2b65a;">Bridge offline. Run: cd orchestration-bridge &amp;&amp; npm start</span>';
          return;
        }
        if (out) out.textContent = '…computing…';
        window.OrchestrationBridge.getAiAdvice().then(function (data) { _showAdvice(data, 'LOCAL AI'); });
      });
    }

    var btnClaude = document.getElementById('btn-claude');
    if (btnClaude) {
      btnClaude.addEventListener('click', function () {
        if (!window.OrchestrationBridge || !window.OrchestrationBridge.isOnline()) {
          if (out) out.innerHTML = '<span style="color:#e2b65a;">Bridge offline. Run: cd orchestration-bridge &amp;&amp; npm start</span>';
          return;
        }
        if (out) out.textContent = '…asking Claude…';
        window.OrchestrationBridge.thinkWithClaude().then(function (data) { _showAdvice(data, 'CLAUDE'); });
      });
    }
  }

  function render(state) {
    if (!state) return;
    _wireAdvisor();

    var dName  = document.getElementById('d-doctrine-name');
    var dAlias = document.getElementById('d-doctrine-alias');
    var dImg   = document.getElementById('d-doctrine-img');
    if (dName)  dName.textContent  = state.doctrine.name;
    if (dAlias) dAlias.textContent = state.doctrine.alias ? '(' + state.doctrine.alias + ')' : '';
    if (dImg)   dImg.src = DOCTRINE_ICONS[state.doctrine.name] || UNIT_ICONS.Infantry;

    var sticker = document.getElementById('mc-doctrine-sticker');
    if (sticker) {
      var src = DOCTRINE_ICONS[state.doctrine.name] || '';
      sticker.innerHTML =
        '<span class="doctrine-sticker">' +
        (src ? '<img src="' + src + '" alt="">' : '') +
        state.doctrine.name +
        '</span>';
    }

    var wp  = state.warPoints;
    var elB = document.getElementById('d-wp-budget');
    var elS = document.getElementById('d-wp-spent');
    var elL = document.getElementById('d-wp-left');
    if (elB) elB.textContent = wp.budget;
    if (elS) elS.textContent = wp.spent.total;
    if (elL) elL.textContent = wp.remaining;

    var inv = document.getElementById('d-inventory');
    if (inv) {
      inv.innerHTML = '';
      var entries = Object.entries(state.inventory || {});
      if (!entries.length) {
        inv.innerHTML = '<div class="inv-row"><span class="nm" style="font-style:italic;color:var(--olive)">No units in field.</span></div>';
      } else {
        entries.forEach(function (pair) {
          var name = pair[0], count = pair[1];
          var row = document.createElement('div');
          row.className = 'inv-row';
          var ico = UNIT_ICONS[name] || UNIT_ICONS.Infantry;
          row.innerHTML =
            '<img class="ico" src="' + ico + '" alt="">' +
            '<span class="nm">' + name + '</span>' +
            '<span class="ct">\xd7' + count + '</span>';
          inv.appendChild(row);
        });
      }
    }

    var mcCoord = document.getElementById('mc-coords');
    if (mcCoord) mcCoord.textContent = state.grid.rows + '\xd7' + state.grid.cols + ' \xb7 HCRAFT';

    _renderSelection(state);
  }

  function _renderSelection(state) {
    var card = document.getElementById('d-selection');
    if (!card) return;
    var id = state.selectedUnitId;
    if (!id) {
      card.innerHTML = '<div class="sel-empty">No unit selected. Click a token on the map.</div>';
      return;
    }
    var u = state.units.find(function (x) { return x.id === id; });
    if (!u) {
      card.innerHTML = '<div class="sel-empty">Unit lost from roster.</div>';
      return;
    }
    var ico = UNIT_ICONS[u.type] || UNIT_ICONS.Infantry;
    var lvl  = u.level > 1 ? ' L' + u.level : '';
    var rank = u.rank ? ' \xb7 ' + u.rank : '';
    card.innerHTML =
      '<div class="sel-title" style="display:flex;align-items:center;gap:6px;">' +
        '<img src="' + ico + '" style="width:16px;height:16px;image-rendering:pixelated;">' +
        u.type + lvl +
      '</div>' +
      '<div style="font-family:\'VT323\',monospace;font-size:14px;color:var(--olive);letter-spacing:1px;">' +
        '@ ROW ' + u.row + ' \xb7 COL ' + u.col + rank +
      '</div>' +
      '<div style="margin-top:4px;font-size:11px;">Legal destinations highlighted in cyan. Attack targets marked in red.</div>' +
      _renderCombatSummary(state.lastCombat);
  }

  function _renderCombatSummary(result) {
    if (!result || result.error) return '';
    if (result.action !== 'combat') return '';
    var killed = result.killed ? ' \xb7 TARGET DESTROYED' : '';
    var counter = result.counterAttack && result.counterAttack.triggered
      ? '<br>Counter: ' + result.counterAttack.damage + ' dmg'
      : '';
    return '<div class="combat-summary">Last attack: ' + result.direction +
      ' / ' + result.damage + ' dmg' + killed + counter + '</div>';
  }

  window.Dossier = { render: render };
})();
