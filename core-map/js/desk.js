(function () {
  'use strict';

  // Demo briefing: Plain doctrine, 14 units, mixed terrain (12×11)
  var DEMO_CODE = [
    '# Pre-Game Briefing',
    '**Doctrine:** Plain',
    '**War-point budget:** 200',
    '**Spent:** 118 (units 112 · xp 6 · bonuses 0)',
    '**Remaining:** 82',
    '',
    '## Starting Army (free)',
    '- Infantry: ×3',
    '',
    '## Bought Units',
    '- Infantry: ×4',
    '- Cavalry: ×2',
    '- Tanks: ×2',
    '- Artillery: ×1',
    '- Motorized: ×2',
    '',
    '## Experience Upgrades',
    '- INFANTRY: 1× L2 (Corporal)',
    '- CAVALRY: 1× L2 (Corporal)',
    '',
    '## Spawn-State Bonuses',
    '- *(none)*',
    '',
    '## Map Coordinates',
    '- 1,1=P; 1,2=P; 1,3=P; 1,4=P; 1,5=P; 1,6=P; 1,7=P; 1,8=P; 1,9=P; 1,10=P; 1,11=P',
    '- 2,1=P; 2,2=P; 2,3=F; 2,4=F; 2,5=P; 2,6=P; 2,7=P; 2,8=F; 2,9=F; 2,10=P; 2,11=P',
    '- 3,1=P; 3,2=F; 3,3=F; 3,4=F; 3,5=P; 3,6=P; 3,7=P; 3,8=F; 3,9=F; 3,10=F; 3,11=P',
    '- 4,1=P; 4,2=M; 4,3=M; 4,4=F; 4,5=F; 4,6=P; 4,7=F; 4,8=F; 4,9=M; 4,10=M; 4,11=P',
    '- 5,1=P; 5,2=M; 5,3=M; 5,4=M; 5,5=P; 5,6=P; 5,7=P; 5,8=M; 5,9=M; 5,10=M; 5,11=P',
    '- 6,1=P; 6,2=P; 6,3=P; 6,4=M; 6,5=S; 6,6=P; 6,7=S; 6,8=M; 6,9=P; 6,10=P; 6,11=P',
    '- 7,1=P; 7,2=P; 7,3=P; 7,4=P; 7,5=S; 7,6=S; 7,7=S; 7,8=P; 7,9=P; 7,10=P; 7,11=P',
    '- 8,1=P; 8,2=P; 8,3=P; 8,4=S; 8,5=S; 8,6=P; 8,7=S; 8,8=S; 8,9=P; 8,10=P; 8,11=P',
    '- 9,1=P; 9,2=P; 9,3=F; 9,4=F; 9,5=P; 9,6=P; 9,7=P; 9,8=F; 9,9=F; 9,10=P; 9,11=P',
    '- 10,1=P; 10,2=F; 10,3=F; 10,4=F; 10,5=P; 10,6=P; 10,7=P; 10,8=F; 10,9=F; 10,10=F; 10,11=P',
    '- 11,1=P; 11,2=P; 11,3=F; 11,4=F; 11,5=P; 11,6=P; 11,7=P; 11,8=F; 11,9=F; 11,10=P; 11,11=P',
    '- 12,1=P; 12,2=P; 12,3=P; 12,4=P; 12,5=P; 12,6=P; 12,7=P; 12,8=P; 12,9=P; 12,10=P; 12,11=P',
    '',
    '## Deployed Positions',
    '- Infantry: 12,1 · 12,2 · 12,3 · 12,9 · 12,10 · 12,11',
    '- Infantry L2: 11,5',
    '- Cavalry: 11,3',
    '- Cavalry L2: 11,9',
    '- Tanks: 11,4 · 11,8',
    '- Artillery: 11,6',
    '- Motorized: 11,2 · 11,10',
  ].join('\n');

  // Seed "last-status" chip from localStorage
  var last = localStorage.getItem('last_briefing');
  var lastStatus = document.getElementById('last-status');
  if (lastStatus && last) lastStatus.textContent = 'ON FILE';

  // Auto-launch 2-player mode when arriving from the menu (?mode=2player)
  if (window.location.search.indexOf('mode=2player') !== -1) {
    localStorage.setItem('twp_setup_phase', '1');
    window.location.href = '../src/tools/pregame-setup.html';
  }

  // Wire cmd-card clicks
  document.querySelectorAll('.cmd-card[data-action]').forEach(function (card) {
    card.addEventListener('click', function () {
      _handleAction(card.dataset.action);
    });
  });

  // Keyboard shortcuts F1–F6
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    var map = { F1: '2player', F2: 'ai', F3: 'paste', F4: 'setup', F5: 'last', F6: 'builder' };
    if (map[e.key]) { e.preventDefault(); _handleAction(map[e.key]); }
  });

  function _handleAction(action) {
    var ta  = document.getElementById('paste-textarea');
    var btn = document.getElementById('btn-load');

    switch (action) {
      case '2player':
        localStorage.setItem('twp_setup_phase', '1');
        window.location.href = '../src/tools/pregame-setup.html';
        break;

      case 'ai':
        // Open the standalone tactical sandbox
        window.open('../tactical-engagement.html', '_blank');
        break;

      case 'paste':
        ta.focus();
        break;

      case 'demo':
        ta.value = DEMO_CODE;
        btn.click();
        break;

      case 'setup':
        window.location.href = '../src/tools/pregame-setup.html';
        break;

      case 'rules':
        window.open('../docs/rules/game_core.md', '_blank');
        break;

      case 'last':
        var saved = localStorage.getItem('last_briefing');
        if (saved) {
          ta.value = saved;
          btn.click();
        }
        break;

      case 'builder':
        window.location.href = '../src/menu/map-builder.html';
        break;
    }
  }

  window.Desk = {};
})();
