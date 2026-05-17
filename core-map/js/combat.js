/* combat.js — Pure combat logic for the 2-player engagement mode.
   Works with the core-map 12×11 grid (1-indexed rows/cols).
   Biomes: 'P' plain · 'F' forest · 'M' mountain · 'S' swamp
*/
(function () {
  'use strict';

  var UNIT_STATS = {
    Infantry:  { hp: 4, movement: { ortho: 2, diag: 1 }, reach: 1,  strength: 1,   defense: 0,   trench: true  },
    Cavalry:   { hp: 3, movement: { ortho: 2, diag: 2 }, reach: 2,  strength: 0.5, defense: 1,   trench: true  },
    Tanks:     { hp: 8, movement: { ortho: 3, diag: 0 }, reach: 4,  strength: 3,   defense: 3,   trench: false },
    Motorized: { hp: 6, movement: { ortho: 3, diag: 2 }, reach: 3,  strength: 2,   defense: 1,   trench: false },
    Artillery: { hp: 2, movement: { ortho: 1, diag: 1 }, reach: 10, strength: 3,   defense: 0.5, trench: false,
                 ignoresTactics: true, hasFalloff: true },
  };

  /* Trench defense bonuses — basic (3+ turns) and permanent (6+ turns) */
  var TRENCH_DEF      = { Infantry: 2,   Cavalry: 1.5 };
  var TRENCH_DEF_PERM = { Infantry: 1,   Cavalry: 1   };

  var TERRAIN_DEF = {
    P: { Infantry: 0,   Cavalry: 0,   Tanks: 0,   Motorized: 0,   Artillery: 0   },
    F: { Infantry: 1.5, Cavalry: 1.5, Tanks: 1.5, Motorized: 1.5, Artillery: 0   },
    M: { Infantry: 2,   Cavalry: 2,   Tanks: 0,   Motorized: 0,   Artillery: 0   },
    S: { Infantry: 1,   Cavalry: 1,   Tanks: 0.5, Motorized: 0.5, Artillery: 1   },
  };

  var TERRAIN_ENTRY = {
    P: function ()     { return true; },
    F: function (type) { return type !== 'Artillery'; },
    M: function (type) { return type === 'Infantry' || type === 'Cavalry'; },
    S: function ()     { return true; },
  };

  var TERRAIN_MOVE_PENALTY = {
    F: { Infantry: 1, Cavalry: 1, Tanks: 1, Motorized: 1, Artillery: 0 },
    S: { Infantry: 1, Cavalry: 1, Tanks: 0, Motorized: 0, Artillery: 1 },
  };

  var BIOME_LABEL = { P: 'PLAIN', F: 'FOREST', M: 'MOUNTAIN', S: 'SWAMP' };

  /* Light unit types that can form a formation */
  var LIGHT_TYPES = ['Infantry', 'Cavalry'];

  /* ── Geometry ─────────────────────────────── */
  function cheb(r1,c1,r2,c2) { return Math.max(Math.abs(r2-r1), Math.abs(c2-c1)); }
  function manh(r1,c1,r2,c2) { return Math.abs(r2-r1) + Math.abs(c2-c1); }
  function isDiag(r1,c1,r2,c2)  { return Math.abs(r2-r1) !== 0 && Math.abs(c2-c1) !== 0; }
  function isOrtho(r1,c1,r2,c2) { return (r1===r2 && c1!==c2) || (c1===c2 && r1!==r2); }

  function isOrthoNeighbor(r1,c1,r2,c2) { return manh(r1,c1,r2,c2) === 1; }

  /* ── Movement ─────────────────────────────── */
  function canMoveTo(unit, tr, tc, units, biomeAt, gridRows, gridCols) {
    if (tr < 1 || tr > gridRows || tc < 1 || tc > gridCols) return false;

    /* Formation units cannot move */
    if (unit.formationPartnerId) return false;

    var biome = biomeAt(tr, tc);
    if (!TERRAIN_ENTRY[biome](unit.type)) return false;

    /* Check occupancy — formation entry is the only allowed stack */
    var occs = units.filter(function (u) { return u.row === tr && u.col === tc; });
    if (occs.length >= 2) return false;
    if (occs.length === 1) {
      var occ = occs[0];
      /* Only allow if: same player, both light types, neither already in formation */
      if (occ.player !== unit.player) return false;
      if (LIGHT_TYPES.indexOf(unit.type) === -1) return false;
      if (LIGHT_TYPES.indexOf(occ.type) === -1) return false;
      if (occ.formationPartnerId) return false;
      /* Fall through — formation stacking allowed, range check still applies */
    }

    var stats = UNIT_STATS[unit.type];
    var dr = Math.abs(tr - unit.row), dc = Math.abs(tc - unit.col);

    /* Artillery on swamp: 1-square 8-direction only */
    if (unit.type === 'Artillery' && biome === 'S') return Math.max(dr, dc) === 1;

    var orthoMax = stats.movement.ortho;
    var diagMax  = stats.movement.diag;
    var pen = (TERRAIN_MOVE_PENALTY[biome] && TERRAIN_MOVE_PENALTY[biome][unit.type]) || 0;
    if (pen) { orthoMax = Math.max(0, orthoMax - pen); diagMax = Math.max(0, diagMax - pen); }

    if (isDiag(unit.row, unit.col, tr, tc))  return Math.max(dr, dc) <= diagMax;
    if (isOrtho(unit.row, unit.col, tr, tc)) return (dr + dc) <= orthoMax;
    return false;
  }

  /* ── Attack reachability ──────────────────── */
  function canAttack(attacker, target) {
    if (attacker.player === target.player) return false;
    return cheb(attacker.row, attacker.col, target.row, target.col) <= UNIT_STATS[attacker.type].reach;
  }

  /* ── Direction relative to defender's facing ─ */
  function getAttackDirection(attacker, defender) {
    var dr = attacker.row - defender.row;
    var dc = attacker.col - defender.col;
    var fMap = { N:{r:-1,c:0}, S:{r:1,c:0}, E:{r:0,c:1}, W:{r:0,c:-1} };
    var F = fMap[defender.facing] || {r:-1, c:0};
    var magB = Math.hypot(dr, dc) || 1;
    var dot  = (F.r * dr + F.c * dc) / (Math.hypot(F.r, F.c) * magB);
    var ang  = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    if (ang <= 45)  return 'FRONT';
    if (ang >= 135) return 'REAR';
    return 'SIDE';
  }

  /* ── Encirclement: all 4 ortho neighbours are enemies ─ */
  function isEncircled(defender, units) {
    function enemy(r, c) {
      var u = units.find(function (x) { return x.row === r && x.col === c; });
      return u && u.player !== defender.player;
    }
    return enemy(defender.row-1, defender.col)
        && enemy(defender.row+1, defender.col)
        && enemy(defender.row,   defender.col-1)
        && enemy(defender.row,   defender.col+1);
  }

  /* ── Double-attack: another friendly is ortho-adjacent to defender ─
     Formation is immune to double-attack (§ 4.2). */
  function hasDoubleAttack(attacker, defender, units) {
    if (defender.formationPartnerId) return false;
    return units.some(function (u) {
      return u.player === attacker.player && u.id !== attacker.id &&
             isOrthoNeighbor(u.row, u.col, defender.row, defender.col);
    });
  }

  /* ── Effective defense ─────────────────────────────────────────────
     units (optional) — needed to resolve formation partner bonus.
     Supports trench tiers: true = basic (+2/+1.5), 'perm' = permanent (+1). */
  function effectiveDefense(defender, biomeAt, units) {
    var base  = UNIT_STATS[defender.type].defense;
    var biome = biomeAt(defender.row, defender.col);
    var terr  = (TERRAIN_DEF[biome] && TERRAIN_DEF[biome][defender.type]) || 0;

    var tr = 0;
    if (defender.trenched === 'perm') {
      tr = TRENCH_DEF_PERM[defender.type] || 0;
    } else if (defender.trenched) {
      tr = TRENCH_DEF[defender.type] || 0;
    }

    /* Formation: combined defense = both units' base defense values (§ 4.2) */
    var form = 0;
    if (units && defender.formationPartnerId) {
      var partner = units.find(function (u) { return u.id === defender.formationPartnerId; });
      if (partner) form = UNIT_STATS[partner.type].defense;
    }

    return { base: base, terr: terr, tr: tr, form: form, total: base + terr + tr + form };
  }

  /* ── Roll attack ──────────────────────────── */
  function rollAttack(attacker, defender, units, biomeAt) {
    var aStats = UNIT_STATS[attacker.type];
    var direction = getAttackDirection(attacker, defender);
    var roll = Math.floor(Math.random() * 6) + 1;
    var ignoresTactics = !!aStats.ignoresTactics;
    var orthoAttack = isOrthoNeighbor(attacker.row, attacker.col, defender.row, defender.col);

    var strBonus = 0, strMods = [];
    if (!ignoresTactics) {
      if (direction === 'SIDE') { strBonus += 0.5; strMods.push('SIDE +0.5'); }
      if (direction === 'REAR') { strBonus += 1;   strMods.push('REAR +1');   }
      if (hasDoubleAttack(attacker, defender, units)) { strBonus += 1; strMods.push('DOUBLE +1'); }
      if (orthoAttack && isEncircled(defender, units)) { strBonus += 3; strMods.push('ENCIRCLE +3'); }
      var aBiome = biomeAt(attacker.row, attacker.col);
      if (aBiome === 'F') { strBonus += 1; strMods.push('FOREST +1'); }
      if (aBiome === 'M') { strBonus -= 1; strMods.push('MOUNTAIN -1'); }
    }

    if (aStats.hasFalloff) {
      var dist = cheb(attacker.row, attacker.col, defender.row, defender.col);
      if (dist > 8) { strBonus -= 0.5; strMods.push('FALLOFF -0.5'); }
    }

    var defEff   = effectiveDefense(defender, biomeAt, units);
    var defBonus = 0, defMods = [];
    if (defEff.terr > 0) defMods.push((BIOME_LABEL[biomeAt(defender.row, defender.col)] || '') + ' +' + defEff.terr);
    if (defEff.tr   > 0) defMods.push('TRENCH +' + defEff.tr);
    if (defEff.form > 0) defMods.push('FORM +' + defEff.form);
    if (!ignoresTactics) {
      if (direction === 'SIDE') { defBonus -= 0.5; defMods.push('SIDE -0.5'); }
      if (direction === 'REAR') { defBonus -= 1;   defMods.push('REAR -1');   }
      if (orthoAttack && isEncircled(defender, units)) { defBonus -= 2; defMods.push('ENCIRCLE -2'); }
    }

    var atkPwr = roll + aStats.strength + strBonus;
    var defVal = defEff.total + defBonus;
    var damage = Math.max(1, Math.floor(atkPwr - defVal));

    return {
      roll: roll, direction: direction,
      atkPwr: atkPwr, defVal: defVal, damage: damage,
      strMods: strMods, defMods: defMods,
    };
  }

  window.Combat = {
    UNIT_STATS:       UNIT_STATS,
    LIGHT_TYPES:      LIGHT_TYPES,
    canMoveTo:        canMoveTo,
    canAttack:        canAttack,
    rollAttack:       rollAttack,
    effectiveDefense: effectiveDefense,
  };
})();
