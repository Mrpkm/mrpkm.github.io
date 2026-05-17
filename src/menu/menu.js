  // Default label positions (above each item) — tweakable
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "labelSize": 21,
    "rec_x": 741,
    "rec_y": 268,
    "patch_x": 293,
    "patch_y": 449,
    "new_x": 199,
    "new_y": 601,
    "play_x": 773,
    "play_y": 493,
    "setup_x": 1190,
    "setup_y": 442,
    "rules_x": 1196,
    "rules_y": 601,
    "poly_records": "530,221 953,217 941,316 536,326",
    "poly_patch": "143,387 461,364 473,479 125,537",
    "poly_whatsnew": "75,578 480,506 517,639 93,680",
    "poly_play": "505,330 1009,333 1072,683 461,683",
    "poly_setup": "1053,364 1308,404 1271,544 1047,510",
    "poly_recon": "1071,523 1090,523 1090,542 1071,542",
    "poly_rules": "1040,523 1371,551 1346,680 1072,673",
    "custom_items": "[]"
  }/*EDITMODE-END*/;

  const POLY_IDS = ['records','patch','whatsnew','play','setup','recon','rules'];
  const POLY_LABELS = {
    records:  'RECORDS box',
    patch:    'PATCH NOTES box',
    whatsnew: "WHAT'S NEW? box",
    play:     'PLAY GAME box',
    setup:    'PRE-GAME SETUP box',
    recon:    'RECON box (extra)',
    rules:    'GAME RULES box',
  };

  // Apply tweak values to label DOM
  function applyTweaks(t) {
    const map = {
      'lbl-records':  [t.rec_x, t.rec_y],
      'lbl-patch':    [t.patch_x, t.patch_y],
      'lbl-whatsnew': [t.new_x, t.new_y],
      'lbl-play':     [t.play_x, t.play_y],
      'lbl-setup':    [t.setup_x, t.setup_y],
      'lbl-rules':    [t.rules_x, t.rules_y],
    };
    Object.entries(map).forEach(([id, [x,y]]) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        el.style.fontSize = t.labelSize + 'px';
      }
    });
    POLY_IDS.forEach(id => {
      const el = document.getElementById('poly-' + id);
      const pts = t['poly_' + id];
      if (el && pts) el.setAttribute('points', pts);
    });
    renderCustomItems(t);
  }

  // Custom user-added items (boxes + labels). Stored as JSON string in tweaks.
  function getCustomItems(t) {
    try { return JSON.parse(t.custom_items || '[]'); } catch { return []; }
  }
  function renderCustomItems(t) {
    const overlay = document.getElementById('overlay');
    const scene = document.getElementById('scene');
    if (!overlay || !scene) return;
    // remove existing custom polys + labels
    overlay.querySelectorAll('.custom-hit').forEach(el => el.remove());
    scene.querySelectorAll('.custom-lbl').forEach(el => el.remove());
    const items = getCustomItems(t);
    items.forEach(it => {
      const ns = 'http://www.w3.org/2000/svg';
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('class', 'hit custom-hit');
      poly.setAttribute('points', it.poly);
      poly.dataset.cid = it.id;
      poly.addEventListener('click', () => alert(it.title + '\n\n' + (it.body || '(no description)')));
      overlay.appendChild(poly);

      const lbl = document.createElement('div');
      lbl.className = 'lbl custom-lbl';
      lbl.textContent = it.title;
      lbl.style.left = it.lx + 'px';
      lbl.style.top  = it.ly + 'px';
      lbl.style.fontSize = (it.size || t.labelSize) + 'px';
      scene.appendChild(lbl);
    });
  }
  applyTweaks(TWEAK_DEFAULTS);

  // Scale scene to fit viewport
  function fit() {
    const scene = document.getElementById('scene');
    const sx = window.innerWidth / 1408;
    const sy = window.innerHeight / 768;
    scene.style.transform = `scale(${Math.min(sx, sy)})`;
  }
  fit();
  window.addEventListener('resize', fit);

  const labelMap = {
    records:   'Game History',
    patch:     'Patch Notes',
    whatsnew:  "What's New?",
    play:      'Play Game',
    setup:     'Pre-Game Setup',
    rules:     'Field Manual — How to Play?',
  };
  const cursorLabel = document.getElementById('cursor-label');
  document.querySelectorAll('.hit').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursorLabel.textContent = '▸ ' + labelMap[el.dataset.key];
      cursorLabel.classList.add('show');
    });
    el.addEventListener('mouseleave', () => cursorLabel.classList.remove('show'));
    el.addEventListener('click', () => openPanel(el.dataset.key));
  });
  document.addEventListener('mousemove', (e) => {
    cursorLabel.style.left = (e.clientX + 16) + 'px';
    cursorLabel.style.top  = (e.clientY + 16) + 'px';
  });

  const hint = document.getElementById('hint');
  document.addEventListener('click', () => hint.classList.add('fade'), { once: true });

  // Expose for tweak panel
  window.__applyTweaks = applyTweaks;
  window.__TWEAK_DEFAULTS = TWEAK_DEFAULTS;

  // Panels
  const modalRoot = document.getElementById('modal-root');

  function closePanel() {
    modalRoot.classList.remove('open');
    modalRoot.innerHTML = '';
  }

  modalRoot.addEventListener('click', (e) => { if (e.target === modalRoot) closePanel(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  function panel(html) {
    modalRoot.innerHTML = `
      <div class="panel" role="document">
        <button class="close" aria-label="Close">&#x2715;</button>
        ${html}
      </div>`;
    modalRoot.classList.add('open');
    modalRoot.querySelector('.close').addEventListener('click', closePanel);
  }

  const panels = {
    patch: () => panel(`
      <header>
        <h2>Patch Notes</h2>
        <span class="stamp">v0.1.5.0</span>
      </header>
      <p class="meta">v0.1.5.0 &mdash; Almost Live!</p>
      <div class="patch">
        <h3>New Screens &amp; Design</h3>
        <ul>
          <li><span class="tag add">ADD</span>Entry screen (index.html) redesigned — classified dossier with animated CTA button and bottom ticker.</li>
          <li><span class="tag add">ADD</span>Map Builder completely redesigned with real PNG tiles, proper tool tray, facing compass rose, and deployment zone overlays.</li>
          <li><span class="tag add">ADD</span>Field Manual &mdash; interactive 8-section rules tutorial with live mini-boards, drill progress tracking, and completion screen. Replaces the static text rules.</li>
        </ul>
        <h3>Gameplay Fixes</h3>
        <ul>
          <li><span class="tag fix">FIX</span>Deploy button is now fully disabled (not just warned) when no units are placed on the map. Cannot be clicked at all without at least one unit.</li>
          <li><span class="tag fix">FIX</span>Game-over overlay now shows &ldquo;Go Back to HQ&rdquo; as the only action, navigating cleanly back to the Command Desk.</li>
          <li><span class="tag fix">FIX</span>Restore Last Map button is now blurred and marked &ldquo;Coming Soon&rdquo; — same treatment as the AI Game button.</li>
        </ul>
        <h3>Visuals</h3>
        <ul>
          <li><span class="tag add">ADD</span>Player 1 units now show a blue tint (opposite of their red zone) — both sides are now visually distinct by zone color.</li>
          <li><span class="tag add">ADD</span>Conquered territory: when a unit crosses into the enemy&apos;s zone, that tile gets a pulsing color overlay indicating occupied ground.</li>
          <li><span class="tag add">ADD</span>Quick-start tutorial shown at the beginning of each 2-player game — 3 step overlay highlighting Move, Attack, and End Turn buttons. Always skippable.</li>
        </ul>
        <h3>Previous (v1.5.0)</h3>
        <ul>
          <li><span class="tag add">ADD</span>Red/Blue zone territory overlays on the map.</li>
          <li><span class="tag add">ADD</span>End-game breakthrough win condition (reach the enemy start row).</li>
          <li><span class="tag add">ADD</span>AI Game and Restore Map buttons marked &ldquo;Coming Soon&rdquo;.</li>
          <li><span class="tag add">ADD</span>War-point economy display in the Briefing Dossier.</li>
          <li><span class="tag fix">FIX</span>Rotate mode fixed &middot; actions can&apos;t go below 0 &middot; unit animations start immediately.</li>
        </ul>
      </div>
    `),

    whatsnew: () => panel(`
      <header>
        <h2>What's New?</h2>
        <span class="stamp">v0.1.5.0</span>
      </header>
      <p class="meta">Field bulletin &mdash; v0.1.5.0 &ldquo;Almost Live!&rdquo;</p>

      <div class="letter urgent">
        <div class="from"><span><strong>NEW</strong> &middot; Entry Screen Redesign</span><span>v0.1.5.0</span></div>
        <div>The landing page is now a proper classified dossier &mdash; animated CTA button,
          scanline vignette, ticker at the bottom, and corner glow halos. First impressions matter.</div>
      </div>

      <div class="letter urgent">
        <div class="from"><span><strong>NEW</strong> &middot; Map Builder Redesign</span><span>v0.1.5.0</span></div>
        <div>The tactical map editor has been overhauled with real PNG terrain tiles, a proper
          tool tray with facing compass rose, deployment zone overlays, and a blurred desk background.</div>
      </div>

      <div class="letter urgent">
        <div class="from"><span><strong>NEW</strong> &middot; Interactive Field Manual</span><span>v0.1.5.0</span></div>
        <div>The old static rule text is replaced by a full 8-section interactive tutorial:
          The Objective, Move a Unit, Attack &amp; Odds, Terrain, Ranks, Doctrines, War Points, and the Dossier.
          Each section has a live mini-board drill and progress tracking.</div>
      </div>

      <div class="letter">
        <div class="from"><span>Quick-Start In-Game Tutorial</span><span>v0.1.5.0</span></div>
        <div>At the start of every 2-player battle a 3-step overlay highlights the Move, Attack,
          and End Turn buttons. Skippable any time. New commanders will know where to look.</div>
      </div>

      <div class="letter">
        <div class="from"><span>Unit Colors &amp; Conquered Territory</span><span>v0.1.5.0</span></div>
        <div>Player 1&rsquo;s units now show a blue tint (opposite of their red zone) to match
          Player 2&rsquo;s existing red treatment. When a unit crosses into enemy ground, the tile
          gets a pulsing color overlay indicating captured territory.</div>
      </div>

      <div class="letter">
        <div class="from"><span>Fixes &amp; Guards</span><span>v0.1.5.0</span></div>
        <div>Deploy button fully disabled (not just warned) with zero units. Game-over overlay
          now navigates back to HQ. Restore Last Map marked &ldquo;Coming Soon&rdquo;.</div>
      </div>
    `),

    play: () => {
      var lastOnFile = !!localStorage.getItem('last_briefing');
      // Inline SVG preview: the exact demo-map terrain (12 rows × 11 cols) with
      // deployed unit positions. Rendered blurred as the Demonstration Map card background.
      var demoSvg = `<svg width="100%" height="100%" viewBox="0 0 11 12" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><rect width="11" height="12" fill="#8ab86a"/><g fill="#3a6b3a"><rect x="2" y="1" width="1" height="1"/><rect x="3" y="1" width="1" height="1"/><rect x="7" y="1" width="1" height="1"/><rect x="8" y="1" width="1" height="1"/><rect x="1" y="2" width="1" height="1"/><rect x="2" y="2" width="1" height="1"/><rect x="3" y="2" width="1" height="1"/><rect x="7" y="2" width="1" height="1"/><rect x="8" y="2" width="1" height="1"/><rect x="9" y="2" width="1" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="4" y="3" width="1" height="1"/><rect x="6" y="3" width="1" height="1"/><rect x="7" y="3" width="1" height="1"/><rect x="2" y="8" width="1" height="1"/><rect x="3" y="8" width="1" height="1"/><rect x="7" y="8" width="1" height="1"/><rect x="8" y="8" width="1" height="1"/><rect x="1" y="9" width="1" height="1"/><rect x="2" y="9" width="1" height="1"/><rect x="3" y="9" width="1" height="1"/><rect x="7" y="9" width="1" height="1"/><rect x="8" y="9" width="1" height="1"/><rect x="9" y="9" width="1" height="1"/><rect x="2" y="10" width="1" height="1"/><rect x="3" y="10" width="1" height="1"/><rect x="7" y="10" width="1" height="1"/><rect x="8" y="10" width="1" height="1"/></g><g fill="#9a9080"><rect x="1" y="3" width="1" height="1"/><rect x="2" y="3" width="1" height="1"/><rect x="8" y="3" width="1" height="1"/><rect x="9" y="3" width="1" height="1"/><rect x="1" y="4" width="1" height="1"/><rect x="2" y="4" width="1" height="1"/><rect x="3" y="4" width="1" height="1"/><rect x="7" y="4" width="1" height="1"/><rect x="8" y="4" width="1" height="1"/><rect x="9" y="4" width="1" height="1"/><rect x="3" y="5" width="1" height="1"/><rect x="7" y="5" width="1" height="1"/></g><g fill="#6b7a45"><rect x="4" y="5" width="1" height="1"/><rect x="6" y="5" width="1" height="1"/><rect x="4" y="6" width="1" height="1"/><rect x="5" y="6" width="1" height="1"/><rect x="6" y="6" width="1" height="1"/><rect x="3" y="7" width="1" height="1"/><rect x="4" y="7" width="1" height="1"/><rect x="6" y="7" width="1" height="1"/><rect x="7" y="7" width="1" height="1"/></g><path stroke="rgba(0,0,0,0.18)" stroke-width="0.03" fill="none" d="M1,0 L1,12 M2,0 L2,12 M3,0 L3,12 M4,0 L4,12 M5,0 L5,12 M6,0 L6,12 M7,0 L7,12 M8,0 L8,12 M9,0 L9,12 M10,0 L10,12 M0,1 L11,1 M0,2 L11,2 M0,3 L11,3 M0,4 L11,4 M0,5 L11,5 M0,6 L11,6 M0,7 L11,7 M0,8 L11,8 M0,9 L11,9 M0,10 L11,10 M0,11 L11,11"/><g fill="rgba(200,55,55,0.9)"><circle cx="10.5" cy="0.5" r="0.35"/><circle cx="9.5" cy="0.5" r="0.35"/><circle cx="8.5" cy="0.5" r="0.35"/><circle cx="2.5" cy="0.5" r="0.35"/><circle cx="1.5" cy="0.5" r="0.35"/><circle cx="0.5" cy="0.5" r="0.35"/><circle cx="9.5" cy="1.5" r="0.35"/><circle cx="8.5" cy="1.5" r="0.35"/><circle cx="7.5" cy="1.5" r="0.35"/><circle cx="6.5" cy="1.5" r="0.35"/><circle cx="5.5" cy="1.5" r="0.35"/><circle cx="3.5" cy="1.5" r="0.35"/><circle cx="2.5" cy="1.5" r="0.35"/><circle cx="1.5" cy="1.5" r="0.35"/></g><g fill="rgba(60,130,255,0.9)"><circle cx="0.5" cy="11.5" r="0.35"/><circle cx="1.5" cy="11.5" r="0.35"/><circle cx="2.5" cy="11.5" r="0.35"/><circle cx="8.5" cy="11.5" r="0.35"/><circle cx="9.5" cy="11.5" r="0.35"/><circle cx="10.5" cy="11.5" r="0.35"/><circle cx="1.5" cy="10.5" r="0.35"/><circle cx="2.5" cy="10.5" r="0.35"/><circle cx="3.5" cy="10.5" r="0.35"/><circle cx="4.5" cy="10.5" r="0.35"/><circle cx="5.5" cy="10.5" r="0.35"/><circle cx="7.5" cy="10.5" r="0.35"/><circle cx="8.5" cy="10.5" r="0.35"/><circle cx="9.5" cy="10.5" r="0.35"/></g></svg>`;

      panel(`
        <header>
          <h2>Play Game</h2>
          <span class="stamp">Tactical</span>
        </header>
        <p class="meta">Select an operation mode to begin</p>

        <div class="cmd-grid-playable">
          <div class="cmd-card-p primary" id="card-load">
            <span class="ckey">F1</span>
            <h4>&#9658; 2 Player Game</h4>
            <div class="cdesc">Launch a live two-player battle on the tactical map.</div>
            <span class="cstat">LAUNCH</span>
          </div>
          <div class="cmd-card-p" id="card-setup-play">
            <span class="ckey">F3</span>
            <h4>&#9658; Pre-Game Setup</h4>
            <div class="cdesc">Pick a doctrine, spend war-points, place your army on the half-board.</div>
            <span class="cstat">OPEN SETUP</span>
          </div>
          <div class="cmd-card-p" id="card-builder-play">
            <span class="ckey">F6</span>
            <h4>&#9658; Tactical Map Editor</h4>
            <div class="cdesc">Place terrain, decorations and unit tokens before sealing the briefing.</div>
            <span class="cstat">OPEN BUILDER</span>
          </div>
        </div>

        <div class="cmd-section-label">Upcoming Operations</div>

        <div class="cmd-grid-upcoming">
          <div class="cmd-card-p-wrapper">
            <div class="cmd-card-p coming-soon-p">
              <h4>&#9733; AI Game</h4>
              <div class="cdesc">Tactical sandbox &mdash; full rules engine, NATO symbols, AI opponent.</div>
              <span class="cstat">LAUNCH</span>
            </div>
            <div class="coming-soon-badge-p">COMING SOON</div>
          </div>
          <div class="cmd-card-p-wrapper">
            <div class="cmd-card-p coming-soon-p">
              <span class="ckey">F5</span>
              <h4>&#9658; Restore Last Map</h4>
              <div class="cdesc">Re-open the briefing you most recently loaded from the field safe.</div>
              <span class="cstat">${lastOnFile ? 'ON FILE' : 'NONE ON FILE'}</span>
            </div>
            <div class="coming-soon-badge-p">COMING SOON</div>
          </div>
          <div class="cmd-card-p-wrapper">
            <div class="cmd-card-p demo-preview coming-soon-p">
              <div class="card-preview" aria-hidden="true">${demoSvg}</div>
              <span class="ckey">F2</span>
              <h4>&#9658; Demonstration Map</h4>
              <div class="cdesc">Load a sealed practice briefing &mdash; Plain doctrine, 14 units, mixed terrain.</div>
              <span class="cstat">LOAD DEMO</span>
            </div>
            <div class="coming-soon-badge-p">COMING SOON</div>
          </div>
        </div>
      `);

      document.getElementById('card-load').addEventListener('click', () => {
        window.location.href = '../tools/pregame-setup.html';
      });
      document.getElementById('card-setup-play').addEventListener('click', () => {
        window.location.href = '../tools/pregame-setup.html';
      });
      document.getElementById('card-builder-play').addEventListener('click', () => {
        window.location.href = 'map-builder.html';
      });
    },

    rules: () => { window.location.href = 'field-manual.html'; },

    _rules_old_DELETED: () => panel(`
      <header>
        <h2>DELETED</h2>
      <p class="meta">Consolidated ruleset &mdash; base rules functionally closed</p>

      <div class="rules-tabs" id="rules-tabs">
        <button class="rules-tab active" data-rsec="core">Core</button>
        <button class="rules-tab" data-rsec="units">Units</button>
        <button class="rules-tab" data-rsec="combat">Combat</button>
        <button class="rules-tab" data-rsec="economy">Economy</button>
        <button class="rules-tab" data-rsec="ui">UI</button>
        <button class="rules-tab" data-rsec="open">Open</button>
      </div>

      <!-- ============ CORE ============ -->
      <div class="rules-section active" data-rsec="core">
        <h3>1.1 Platform &amp; Style</h3>
        <p>Digital, chess-like tactical game with WWII doctrines. The computer
        manages all state &mdash; turn counts, XP, hidden state, facings, doctrine
        effects, cumulative still-penalties.</p>

        <h3>1.2 Win Condition &mdash; Capture the Enemy HQ</h3>
        <ul>
          <li><strong>HQ placement:</strong> bottom-left and top-right corners (symmetric).</li>
          <li><strong>Reach:</strong> 3 squares in every direction.</li>
          <li><strong>Damage trigger:</strong> enemy within reach &rarr; HQ takes damage.</li>
          <li><strong>Capture (either path):</strong>
            <ul>
              <li><strong>Occupation</strong> &mdash; unit stays in reach for <strong>5 turns</strong>.</li>
              <li><strong>Damage</strong> &mdash; <strong>20</strong> cumulative damage to HQ.</li>
            </ul>
          </li>
        </ul>

        <h3>1.3 Dice &amp; Damage</h3>
        <p>All combat rolls use <code>1d6</code>. Half-point bonuses are valid.
        Final damage clamped to a <strong>minimum of 1</strong>, except the Blitzkrieg
        Corporal-tank bounce rule which can produce up to &minus;3.</p>

        <h3>1.4 Board</h3>
        <ul>
          <li>Square grid, <strong>8-direction movement</strong> (4 ortho + 4 diagonal).</li>
          <li><strong>Maps are handcrafted</strong> &mdash; board size, shape, terrain authored per map.</li>
          <li>Four terrain types: grasslands, swamp, forest, mountains.</li>
        </ul>

        <h3>1.5 Facing</h3>
        <p>Every unit tracks one of <strong>4 facings (N/S/E/W)</strong>.
        Default at spawn: both sides face each other. Rotation is <strong>free</strong>,
        anytime, multiple times per turn. No reactive turn when hit from rear.</p>

        <h3>1.6 Turn Structure &mdash; IGOUGO</h3>
        <p>One player takes their full turn, then the other. Each unit can
        <strong>move or attack 2 times per turn</strong>, freely split.</p>

        <h3>1.7 Design Philosophy</h3>
        <ul>
          <li><strong>Two layers:</strong> tactical (per-unit) + strategic (doctrine).</li>
          <li><strong>Fragility by design</strong> &mdash; base units die quickly; modifiers (positioning, terrain, trench, formation, XP, doctrine) keep them alive.</li>
          <li><strong>Doctrines define your game</strong> &mdash; different army, placement, signature rules.</li>
        </ul>

        <h3>1.8 Turn Limit &amp; Tiebreak</h3>
        <p><strong>Hard cap: 1000 turns.</strong> If neither HQ has fallen by the limit,
        the side with <strong>more remaining HQ HP</strong> wins. Equal HP = draw.
        No mid-game reinforcements; leftover war points forfeit.</p>
      </div>

      <!-- ============ UNITS ============ -->
      <div class="rules-section" data-rsec="units">
        <h3>2.1 Unit Roster</h3>
        <table>
          <tr><th>Unit</th><th>HP</th><th>Movement</th><th>Reach</th><th>Str</th><th>Def</th></tr>
          <tr><td>Infantry</td><td class="num">4</td><td>2 ortho / 1 diag</td><td>1 sq</td><td class="num">1</td><td class="num">0</td></tr>
          <tr><td>Cavalry</td><td class="num">3</td><td>2 in all 8 dirs</td><td>2 sq</td><td class="num">0.5</td><td class="num">1</td></tr>
          <tr><td>Tanks</td><td class="num">8</td><td>3 ortho / 0 diag*</td><td>4 ortho / 3 diag</td><td class="num">3</td><td class="num">3</td></tr>
          <tr><td>Motorized Inf.</td><td class="num">6</td><td>3 ortho / 2 diag</td><td>3 sq</td><td class="num">2</td><td class="num">1</td></tr>
          <tr><td>Artillery</td><td class="num">2</td><td>1 ortho / 1 diag</td><td>6 sq*</td><td class="num">3</td><td class="num">0.5</td></tr>
        </table>
        <p style="font-size:11px;">*Overridable by doctrine. Tanks are the only unit with asymmetric attack reach.</p>

        <h3>2.4 Movement Style &mdash; Jump-Based</h3>
        <p>Select any tile inside your footprint. Intermediate tiles don't block;
        friendlies/enemies between origin and destination are ignored.</p>

        <h3>2.5 Terrain</h3>
        <table>
          <tr><th>Terrain</th><th>Inf/Cav</th><th>Tank/Mot.</th><th>Artillery</th><th>Trench?</th></tr>
          <tr><td>Grasslands</td><td>normal</td><td>normal</td><td>normal</td><td>Inf+Cav</td></tr>
          <tr><td>Swamp</td><td>&minus;1 mvmt, +1 def</td><td>+0.5 def</td><td>&minus;1 mvmt, 1 sq only</td><td><strong>No</strong></td></tr>
          <tr><td>Forest</td><td>&minus;1 mvmt, +1.5 def</td><td>&minus;1 mvmt, +1.5 def</td><td><strong>Cannot enter</strong></td><td>Inf+Cav</td></tr>
          <tr><td>Mountains</td><td>+2 def</td><td><strong>Cannot enter</strong></td><td><strong>Cannot enter</strong></td><td>Inf+Cav</td></tr>
        </table>
        <p>Attacking <em>from</em> mountains: <strong>&minus;1 strength</strong> (all units).</p>

        <h3>3 Progression &mdash; Corporal / Captain / Colonel</h3>
        <p>XP gained by defeating a <strong>stronger</strong> enemy (higher rank, higher raw strength, or under doctrine modifiers).</p>

        <h4>Infantry</h4>
        <p>L1: +1 str, +1 def &middot; L2: +1 HP, +1 def &middot; L3: +1 str, +1 def</p>
        <h4>Cavalry</h4>
        <p>L1: +1 str, +1 def &middot; L2: +1 def, mvmt &rarr; 4/4 &middot; L3: +1 str, +1 def</p>
        <h4>Tank / Motorized (shared)</h4>
        <p>L1: +1 ortho square (cost: &minus;1 atk stamina this turn, no-move next turn) &middot;
        L2: +1 attack stamina (cost: no attack next turn) &middot;
        L3: wait 1 turn &rarr; +2 def next turn.</p>
        <h4>Artillery</h4>
        <p>L1: +1 reach &middot; L2: +2 str within 5 squares &middot; L3: +1 ortho movement.</p>

        <h3>4 Formation</h3>
        <ul>
          <li>Two <strong>light units</strong> (Inf + Inf, Inf + Cav, Cav + Cav) stack on one square.</li>
          <li><strong>Heavy units cannot form</strong> formations.</li>
          <li>Combined defense, immune to double attack &mdash; but cannot move or counter together.</li>
          <li>Each stacked unit rotates independently.</li>
        </ul>

        <h3>6 Facing &mdash; 3/2/3 Mapping</h3>
        <p>For a unit facing North: <strong>Front</strong> = N/NW/NE &middot; <strong>Side</strong> = E/W &middot; <strong>Rear</strong> = S/SW/SE.</p>

        <h3>8 Doctrines</h3>
        <p>One per army. Both players pick from the same pool. Same-doctrine matchups allowed. No unit is doctrine-locked.</p>

        <h4>Plain (vanilla)</h4>
        <p>14 starting units, player-composed up to 5 per class. Tanks: 2 ortho / 0 diag.
        No signature rule. Budget: <strong>30 pts</strong>.</p>

        <h4>Blitzkrieg &mdash; &ldquo;Tanks must keep moving&rdquo;</h4>
        <p>Free army: 6 Tanks, 4 Motorized, 4 Infantry. Tanks: 4 ortho / 0 diag.
        Each still turn = <strong>&minus;1 cumulative def</strong> (resets on move).
        Budget: <strong>25 pts</strong>.</p>

        <h4>Superior Firepower &mdash; &ldquo;Long-range overwhelm&rdquo;</h4>
        <p>Free army: 6 Artillery, 4 Cavalry, 4 Infantry. Artillery range: 12 sq with
        <strong>&minus;0.5 str falloff after square 8</strong>. Tanks (if bought): 2 ortho / 1 diag, no still-penalty.
        Budget: <strong>35 pts</strong>.</p>

        <h3>8.1.1 Starting Placement</h3>
        <p>Board halved; each player freely places their army within their half.
        All starting units repositionable. HQs sit in assigned corners.</p>
      </div>

      <!-- ============ COMBAT ============ -->
      <div class="rules-section" data-rsec="combat">
        <h3>5.1 Combat Sequence</h3>
        <ol>
          <li>Check distance vs. attacker's reach.</li>
          <li>Determine attack direction vs. defender's facing.</li>
          <li>Apply attacker bonuses (&sect;5.2).</li>
          <li>Roll <code>1d6</code> &mdash; base wound.</li>
          <li>Apply defender bonuses (&sect;5.3).</li>
          <li>Damage = <code>(roll + atk_str + atk_bonuses) &minus; (def + def_bonuses)</code>.</li>
          <li>Floor: minimum <strong>1</strong> (Blitzkrieg bounce excepted).</li>
        </ol>

        <h3>5.4 Net Effect of Positional Attacks</h3>
        <table>
          <tr><th>Direction</th><th>Str</th><th>Def</th><th>Net Swing</th></tr>
          <tr><td>Frontal</td><td>+0</td><td>+0</td><td class="num">+0</td></tr>
          <tr><td>Side</td><td>+0.5</td><td>&minus;0.5</td><td class="num">+1</td></tr>
          <tr><td>Rear</td><td>+1</td><td>&minus;1</td><td class="num">+2</td></tr>
          <tr><td>Encirclement (ortho)</td><td>+3</td><td>&minus;2</td><td class="num">+5</td></tr>
          <tr><td>Encirclement (diag)</td><td>+0</td><td>+0</td><td class="num">+0</td></tr>
        </table>

        <h3>5.5 Encirclement</h3>
        <p>Trigger: all 4 orthogonal neighbors are enemies. Only <strong>orthogonal attackers</strong> get the bonus.</p>
        <p><strong>Tank exception:</strong> 2+ tanks reach-hugging the target from orthogonal directions also triggers encirclement.</p>

        <h3>5.6 Trench &mdash; Three-Tier Escalation</h3>
        <p>Triggers after a unit doesn't move for <strong>3 turns</strong>. Infantry: +2 def &middot; Cavalry: +1.5 def. Inf/Cav only; not allowed in swamp.</p>
        <ul>
          <li><strong>3 turns then exit:</strong> trench vanishes.</li>
          <li><strong>4 turns then exit:</strong> trench remains; another Inf/Cav can occupy and use it (cycle resets each 4-turn hold).</li>
          <li><strong>6 turns held:</strong> permanent for the rest of the game, but reduced to <strong>+1 def</strong> for both unit types.</li>
        </ul>

        <h3>5.7 Range Falloff</h3>
        <p>Some ranged units lose strength with distance.
        Currently used by Superior Firepower artillery: full power 1&ndash;8, &minus;0.5 str after, max 12.</p>

        <h3>5.9 Counter-Attack</h3>
        <ul>
          <li>Defender auto-rolls <strong>D6</strong> on being attacked, <em>if</em> they have &ge;1 attack-stamina remaining.</li>
          <li>If attacker is <strong>fully exhausted</strong>, defender gets a <strong>bonus D6</strong> scaling 0.5 str/pip (1&rarr;+0.5 &hellip; 6&rarr;+3.0).</li>
        </ul>

        <h3>5.9 Bounce Rule (Blitzkrieg)</h3>
        <p>Corporal-rank Blitzkrieg tanks unable to move with 1 attack-stamina left
        may roll up to <strong>&minus;3 attack</strong> &mdash; the only legal exception to the
        minimum-1 damage floor.</p>

        <h3>5.10 Heavy-Unit Tactics Applicability</h3>
        <table>
          <tr><th>Tactic</th><th>Tanks</th><th>Motorized</th><th>Artillery</th></tr>
          <tr><td>Side / Rear bonus</td><td>via reach</td><td>standard</td><td>&mdash;</td></tr>
          <tr><td>Double attack</td><td>via reach</td><td>standard</td><td>&mdash;</td></tr>
          <tr><td>Encirclement</td><td>2-tank reach-hug</td><td>standard</td><td>&mdash;</td></tr>
          <tr><td>Formation</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
          <tr><td>Trench</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>
          <tr><td>Terrain atk bonus</td><td>standard</td><td>standard</td><td>&mdash;</td></tr>
          <tr><td>Terrain def bonus</td><td>standard</td><td>standard</td><td>standard</td></tr>
        </table>
        <p class="callout"><strong>Tank reach-as-adjacency:</strong> a tank's 4-ortho/3-diag attack reach counts as adjacency for positional tactics. Diagonal still does not count.</p>
        <p class="callout"><strong>Artillery &mdash; no positional tactics at all.</strong> Doctrine effects (range, level-2 close-range) still apply; terrain defense bonuses while standing on tiles still apply.</p>

        <h3>7 Tactics Quick Reference</h3>
        <table>
          <tr><th>Tactic</th><th>Effect</th></tr>
          <tr><td>Frontal</td><td>+0</td></tr>
          <tr><td>Side</td><td>+0.5 str / &minus;0.5 def</td></tr>
          <tr><td>Rear</td><td>+1 str / &minus;1 def</td></tr>
          <tr><td>Trench (Inf)</td><td>+2 def</td></tr>
          <tr><td>Trench (Cav)</td><td>+1.5 def</td></tr>
          <tr><td>Double attack (ortho)</td><td>+1 str</td></tr>
          <tr><td>Encirclement (ortho)</td><td>+3 str / &minus;2 def</td></tr>
          <tr><td>Encirclement (2+ tanks)</td><td>+3 str / &minus;2 def</td></tr>
          <tr><td>Formation</td><td>Combined def, immobile, immune to double atk</td></tr>
          <tr><td>Terrain bonus</td><td>+1 str OR def (artillery: def only)</td></tr>
          <tr><td>Bad-terrain attack</td><td>&minus;1 str (mountains, all units)</td></tr>
          <tr><td>Rotate unit</td><td><strong>Free</strong></td></tr>
        </table>
      </div>

      <!-- ============ ECONOMY ============ -->
      <div class="rules-section" data-rsec="economy">
        <h3>E.1 War Points &mdash; Pre-Game Budget</h3>
        <p>The economy is <strong>pre-game only</strong>. No mid-game production, income, or upkeep.</p>
        <table>
          <tr><th>Doctrine</th><th>Budget</th></tr>
          <tr><td>Plain</td><td class="num">30 pts</td></tr>
          <tr><td>Blitzkrieg</td><td class="num">25 pts</td></tr>
          <tr><td>Superior Firepower</td><td class="num">35 pts</td></tr>
        </table>
        <p>Spend on: (1) extra units, (2) pre-game XP, (3) spawn-state bonuses. Leftover pts forfeit.</p>

        <h3>E.2 Buying Units</h3>
        <table>
          <tr><th>Class</th><th>Cost</th></tr>
          <tr><td>Light (Inf, Cav)</td><td class="num">3 pts</td></tr>
          <tr><td>Heavy (Tanks, Motorized)</td><td class="num">5 pts</td></tr>
          <tr><td>Special (Artillery)</td><td class="num">5 pts</td></tr>
        </table>

        <h4>Doctrine caps on additional units</h4>
        <table>
          <tr><th>Doctrine</th><th>Heavy</th><th>Inf</th><th>Cav</th><th>Special</th></tr>
          <tr><td>Plain</td><td>5</td><td>5</td><td>5</td><td>5</td></tr>
          <tr><td>Blitzkrieg</td><td><strong>0</strong></td><td>4</td><td>2</td><td>2</td></tr>
          <tr><td>Superior FP</td><td>2</td><td>2</td><td>2</td><td>2</td></tr>
        </table>

        <h3>E.3 Pre-Game XP</h3>
        <table>
          <tr><th>Up to&hellip;</th><th>Cost</th><th>Total spent</th></tr>
          <tr><td>1st (Corporal)</td><td>2 pts</td><td>2</td></tr>
          <tr><td>2nd (Captain)</td><td>4 pts</td><td>6</td></tr>
          <tr><td>3rd (Colonel)</td><td>5 pts</td><td>11</td></tr>
        </table>

        <h4>Doctrine XP-upgrade caps</h4>
        <table>
          <tr><th>Doctrine</th><th>Inf</th><th>Cav</th><th>Heavy</th><th>Artillery</th></tr>
          <tr><td>Plain</td><td>up to L2</td><td>up to L2</td><td>up to L2</td><td>up to L2</td></tr>
          <tr><td>Blitzkrieg</td><td>2&times;</td><td><strong>0&times;</strong></td><td>1&times;</td><td><strong>0&times;</strong></td></tr>
          <tr><td>Superior FP</td><td>3&times;</td><td>3&times;</td><td><strong>0&times;</strong></td><td>1&times;</td></tr>
        </table>

        <h3>E.4 Spawn-State Bonuses</h3>
        <table>
          <tr><th>Bonus</th><th>Cost</th><th>Eligible</th></tr>
          <tr><td>Spawn entrenched</td><td>3 pts</td><td>Inf/Cav (any unit that can trench)</td></tr>
          <tr><td>Spawn in formation</td><td>5 pts</td><td>Light units only (2 units)</td></tr>
        </table>

        <h3>E.5 Not in the Economy</h3>
        <ul>
          <li>No mid-game production / resource generation.</li>
          <li>No income, upkeep, or unit cost during play.</li>
          <li>No mid-game purchases &mdash; all spending at setup.</li>
          <li>No reinforcements during play.</li>
        </ul>
      </div>

      <!-- ============ UI ============ -->
      <div class="rules-section" data-rsec="ui">
        <h3>UI &amp; Feedback &mdash; Status</h3>
        <p class="callout">The base ruleset doesn't yet define HUD layouts.
        State ownership is established (the computer holds all of it); display
        rules are partially resolved.</p>

        <h3>Pre-Game Menu (partial resolution, v0.16)</h3>
        <p><strong>Single shared menu</strong> for everything pre-game:</p>
        <ul>
          <li>Doctrine pick (Plain / Blitzkrieg / Superior Firepower)</li>
          <li>War-point spending (units, XP, spawn bonuses)</li>
          <li>Unit placement on the half-board</li>
          <li>Formation pairing</li>
          <li>Entrenchment toggles</li>
          <li>XP allocation per unit</li>
          <li>Initial facing per unit</li>
        </ul>

        <h3>HUD Surfaces (still TBD)</h3>
        <p>Rules implicitly require these to be displayed somewhere:</p>
        <ul>
          <li>Tracked facing direction (per unit)</li>
          <li>Cumulative Blitzkrieg still-penalty counter</li>
          <li>Trench status &amp; tier (3/4/6-turn escalation)</li>
          <li>Experience level (Corporal/Captain/Colonel)</li>
          <li>Active doctrine effects</li>
          <li>HQ HP, capture timer, turn count</li>
          <li>Point-tracker / remaining budget on pre-game menu</li>
        </ul>
      </div>

      <!-- ============ OPEN QUESTIONS ============ -->
      <div class="rules-section" data-rsec="open">
        <h3>Status (v1.5.0) &mdash; Functionally Closed</h3>
        <p>All non-UI open questions are resolved as of v1.5.0. The only items
        remaining live entirely in <span class="doc-name">ui_and_feedback.md</span>.</p>

        <h3>Recently Resolved (v1.5.0)</h3>
        <ul>
          <li><strong>Minimum damage floor:</strong> 1, with the Blitzkrieg bounce exception.</li>
          <li><strong>Rotation timing:</strong> free, anytime, multiple per turn, also pre-game.</li>
          <li><strong>Formation rotation:</strong> each unit rotates independently.</li>
          <li><strong>Front/Side/Rear mapping:</strong> 3/2/3 confirmed (1/2/2/2/1 rejected).</li>
          <li><strong>Default facing:</strong> both sides face each other (overturns N default).</li>
          <li><strong>Starting placement:</strong> half-and-half free placement; all doctrine starting armies repositionable.</li>
          <li><strong>Maps:</strong> handcrafted; no procedural generation.</li>
          <li><strong>Turn limit:</strong> 1000 turns; tiebreak by HQ HP; no reinforcements.</li>
          <li><strong>Tank stamina bookkeeping:</strong> L1 &minus;1 atk this turn + no-move next; L2 no-attack next turn.</li>
          <li><strong>Heavy-unit tactics:</strong> Motorized = full light tactics; Tanks = via reach (2-tank encirclement); Artillery = none.</li>
          <li><strong>Plain doctrine:</strong> confirmed vanilla &mdash; no signature rule beyond slow tank profile.</li>
        </ul>

        <h3>Still Open &mdash; UI Only</h3>
        <ul>
          <li><strong>Pre-game setup interface:</strong> single shared menu confirmed; layout, flow, validation, point-tracker still TBD.</li>
          <li><strong>HUD surfaces:</strong> facing, still-penalty counter, trench tier, XP, doctrine effects, HQ HP, capture timer, turn count.</li>
          <li><strong>In-game research / campaign progression:</strong> can a doctrine ever change mid-match? (Pre-game pick is canonical for base game.)</li>
        </ul>

        <h3>Decisions Log &mdash; Highlights</h3>
        <p style="font-size:11px;">72 numbered decisions in the consolidated rules. A few key ones:</p>
        <ul style="font-size:12px;">
          <li>#22 Fragility is intentional &mdash; creates room for tanks to feel powerful.</li>
          <li>#23 Doctrines are army-defining packages &mdash; units + placement + signature, not just modifiers.</li>
          <li>#26 Doctrines override unit stats, not just stack on top.</li>
          <li>#46 Diagonal does not count as an attack-direction tactic.</li>
          <li>#56 Only 3 doctrines exist in base game (set is closed but expandable).</li>
          <li>#69 Maps are handcrafted (no procedural generation).</li>
        </ul>
      </div>
    `),

    setup: () => { window.location.href = '../tools/pregame-setup.html'; },

    records: () => panel(`
      <header>
        <h2>Game History</h2>
        <span class="stamp">Archives</span>
      </header>
      <p class="meta">Last 8 operations &middot; 5 W &middot; 2 L &middot; 1 D</p>
      <div class="hist-row head">
        <span>Date</span><span>Result</span><span>Operation</span><span>Score</span>
      </div>
      <div class="hist-row"><span>06 JUN</span><span class="res win">WIN</span><span>Carentan Crossroad &mdash; Allied</span><span>2400</span></div>
      <div class="hist-row"><span>05 JUN</span><span class="res win">WIN</span><span>Sainte-M&egrave;re-&Eacute;glise &mdash; Allied</span><span>2150</span></div>
      <div class="hist-row"><span>04 JUN</span><span class="res loss">LOSS</span><span>Cherbourg Defense &mdash; Axis</span><span>980</span></div>
      <div class="hist-row"><span>03 JUN</span><span class="res win">WIN</span><span>Bocage Sweep &mdash; Allied</span><span>2780</span></div>
      <div class="hist-row"><span>02 JUN</span><span class="res draw">DRAW</span><span>Coastal Bombardment</span><span>1500</span></div>
      <div class="hist-row"><span>01 JUN</span><span class="res win">WIN</span><span>Pegasus Bridge &mdash; Allied</span><span>2620</span></div>
      <div class="hist-row"><span>31 MAY</span><span class="res loss">LOSS</span><span>Atlantic Wall &mdash; Axis</span><span>1100</span></div>
      <div class="hist-row"><span>30 MAY</span><span class="res win">WIN</span><span>Paratrooper Drop &mdash; Allied</span><span>2330</span></div>
    `),
  };

  function openPanel(key) {
    const fn = panels[key];
    if (!fn) return;
    fn();
    // wire setup chips
    modalRoot.querySelectorAll('.val').forEach(group => {
      group.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
      });
    });
    // wire rules tabs
    const tabBar = modalRoot.querySelector('#rules-tabs');
    if (tabBar) {
      tabBar.querySelectorAll('.rules-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const target = btn.dataset.rsec;
          tabBar.querySelectorAll('.rules-tab').forEach(b => b.classList.toggle('active', b === btn));
          modalRoot.querySelectorAll('.rules-section').forEach(sec => {
            sec.classList.toggle('active', sec.dataset.rsec === target);
          });
          const scroller = modalRoot.querySelector('.panel');
          if (scroller) scroller.scrollTop = 0;
        });
      });
    }
  }