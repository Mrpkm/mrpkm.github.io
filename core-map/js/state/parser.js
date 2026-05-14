(function () {
  'use strict';

  function ParseError(message) {
    this.name = 'ParseError';
    this.message = message;
  }
  ParseError.prototype = Object.create(Error.prototype);

  const XP_CLASS_TO_TYPE = {
    INFANTRY: 'Infantry',
    CAVALRY:  'Cavalry',
    HEAVY:    'Tanks',
    SPECIAL:  'Artillery',
  };

  const VALID_BIOMES = new Set(['P', 'F', 'M', 'S']);
  const GRID_ROWS = 12;
  const GRID_COLS = 11;

  let _unitCounter = 0;
  function _nextId() {
    return 'u_' + String(++_unitCounter).padStart(4, '0');
  }

  function parsePreGameCode(markdownString) {
    _unitCounter = 0;
    const lines = markdownString.split('\n').map(function(l) { return l.replace(/\r$/, ''); });

    const headerIdx = lines.findIndex(function(l) { return l.trim() === '# Pre-Game Briefing'; });
    if (headerIdx === -1) throw new ParseError('Missing "# Pre-Game Briefing" header line');

    const sections = {};
    let current = '__header__';
    sections[current] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        current = line.slice(3).trim();
        sections[current] = [];
      } else {
        sections[current].push(line);
      }
    }

    const hdr = sections['__header__'] || [];
    const doctrine  = _parseDoctrine(hdr);
    const warPoints = _parseWarPoints(hdr);
    const inventory = _parseInventory(sections['Starting Army (free)'], sections['Bought Units']);
    const xpRanks   = _parseXpUpgrades(sections['Experience Upgrades']);
    const bonuses   = _parseBonuses(sections['Spawn-State Bonuses']);
    const grid      = _parseMapCoordinates(sections['Map Coordinates']);
    const units     = _parseDeployedPositions(sections['Deployed Positions'], xpRanks);

    return { doctrine, warPoints, inventory, bonuses, grid, units };
  }

  function _parseDoctrine(hdr) {
    const line = hdr.find(function(l) { return l.startsWith('**Doctrine:**'); });
    if (!line) throw new ParseError('Missing **Doctrine:** line in header');
    const m = line.match(/\*\*Doctrine:\*\*\s+(.+?)(?:\s+\*\((.+?)\)\*\s*)?$/);
    if (!m) throw new ParseError('Malformed Doctrine line: ' + line.trim());
    return { name: m[1].trim(), alias: m[2] ? m[2].trim() : null };
  }

  function _parseWarPoints(hdr) {
    const budgetLine    = hdr.find(function(l) { return l.startsWith('**War-point budget:**'); });
    const spentLine     = hdr.find(function(l) { return l.startsWith('**Spent:**'); });
    const remainingLine = hdr.find(function(l) { return l.startsWith('**Remaining:**'); });

    if (!budgetLine)    throw new ParseError('Missing **War-point budget:** line');
    if (!spentLine)     throw new ParseError('Missing **Spent:** line');
    if (!remainingLine) throw new ParseError('Missing **Remaining:** line');

    const budget = _parseInt(budgetLine.replace(/\*\*War-point budget:\*\*\s*/, ''), 'War-point budget');
    const sm = spentLine.match(/\*\*Spent:\*\*\s+(\d+)\s+\(units (\d+)\s*·\s*xp (\d+)\s*·\s*bonuses (\d+)\)/);
    if (!sm) throw new ParseError('Malformed Spent line: ' + spentLine.trim());
    const spent = { total: parseInt(sm[1]), units: parseInt(sm[2]), xp: parseInt(sm[3]), bonuses: parseInt(sm[4]) };
    const remaining = _parseInt(remainingLine.replace(/\*\*Remaining:\*\*\s*/, ''), 'Remaining');
    return { budget, spent, remaining };
  }

  function _parseInventory(freeLines, boughtLines) {
    const inventory = {};
    function absorb(lines) {
      if (!lines) return;
      lines.forEach(function(line) {
        const t = line.trim();
        if (!t.startsWith('- ')) return;
        const body = t.slice(2);
        if (body.startsWith('*') || body.startsWith('**')) return;
        const m = body.match(/^(.+?):\s+×(\d+)/);
        if (!m) return;
        const name = m[1].trim();
        inventory[name] = (inventory[name] || 0) + parseInt(m[2]);
      });
    }
    absorb(freeLines);
    absorb(boughtLines);
    return inventory;
  }

  function _parseXpUpgrades(xpLines) {
    const xpRanks = {};
    if (!xpLines) return xpRanks;
    xpLines.forEach(function(line) {
      const t = line.trim();
      if (!t.startsWith('- ')) return;
      const body = t.slice(2);
      if (body.startsWith('*')) return;
      const m = body.match(/^([A-Z]+):\s+(.+)$/);
      if (!m) return;
      const typeName = XP_CLASS_TO_TYPE[m[1].trim()];
      if (!typeName) return;
      if (!xpRanks[typeName]) xpRanks[typeName] = {};
      m[2].split(/,\s*/).forEach(function(part) {
        const pm = part.trim().match(/(\d+)×\s+L(\d+)\s+\((.+?)\)/);
        if (!pm) return;
        xpRanks[typeName][parseInt(pm[2])] = pm[3].trim();
      });
    });
    return xpRanks;
  }

  function _parseBonuses(bonusLines) {
    if (!bonusLines) return [];
    const bonuses = [];
    bonusLines.forEach(function(line) {
      const t = line.trim();
      if (!t.startsWith('- ')) return;
      const body = t.slice(2);
      if (body === '*(none)*' || body.startsWith('*')) return;
      bonuses.push(body);
    });
    return bonuses;
  }

  function _parseMapCoordinates(mapLines) {
    if (!mapLines || !mapLines.length) throw new ParseError('Missing "Map Coordinates" section');
    const cellMap = {};
    mapLines.forEach(function(line) {
      const t = line.trim();
      if (!t.startsWith('- ')) return;
      t.slice(2).split(/;\s*/).forEach(function(entry) {
        const raw = entry.trim();
        if (!raw) return;
        const em = raw.match(/^(\d+),(\d+)=([A-Z])$/);
        if (!em) throw new ParseError('Malformed map coordinate: "' + raw + '"');
        if (!VALID_BIOMES.has(em[3])) throw new ParseError('Unknown biome "' + em[3] + '" at ' + em[1] + ',' + em[2]);
        const key = em[1] + ',' + em[2];
        if (cellMap[key] !== undefined) throw new ParseError('Duplicate map cell: ' + key);
        cellMap[key] = em[3];
      });
    });
    const cells = [];
    for (let row = 1; row <= GRID_ROWS; row++) {
      for (let col = 1; col <= GRID_COLS; col++) {
        const key = row + ',' + col;
        if (cellMap[key] === undefined) throw new ParseError('Missing map cell: ' + key);
        cells.push({ row: row, col: col, biome: cellMap[key] });
      }
    }
    return { rows: GRID_ROWS, cols: GRID_COLS, cells: cells };
  }

  function _parseDeployedPositions(deployLines, xpRanks) {
    if (!deployLines) return [];
    const units = [];
    deployLines.forEach(function(line) {
      const t = line.trim();
      if (!t.startsWith('- ')) return;
      const body = t.slice(2);
      if (body.startsWith('*')) return;
      const colonIdx = body.indexOf(':');
      if (colonIdx === -1) throw new ParseError('Malformed deployed-positions line: "' + body + '"');
      const label = body.slice(0, colonIdx).trim();
      const coordsPart = body.slice(colonIdx + 1).trim();
      const labelMatch = label.match(/^(.+?)\s+L(\d+)$/);
      const type  = labelMatch ? labelMatch[1].trim() : label.trim();
      const level = labelMatch ? parseInt(labelMatch[2]) : 1;
      const rank  = (level > 1 && xpRanks[type] && xpRanks[type][level]) ? xpRanks[type][level] : null;
      coordsPart.split(/\s*·\s*/).forEach(function(coord) {
        const cm = coord.trim().match(/^(\d+),(\d+)$/);
        if (!cm) throw new ParseError('Malformed coordinate "' + coord.trim() + '" for unit "' + label + '"');
        const row = parseInt(cm[1]), col = parseInt(cm[2]);
        if (row < 1 || row > GRID_ROWS || col < 1 || col > GRID_COLS) {
          throw new ParseError('Unit "' + label + '" at ' + row + ',' + col + ' is outside the grid');
        }
        units.push({ id: _nextId(), type: type, level: level, rank: rank, row: row, col: col, owner: 'player' });
      });
    });
    return units;
  }

  function _parseInt(str, fieldName) {
    const n = parseInt(str.trim());
    if (isNaN(n)) throw new ParseError('Non-integer value for ' + fieldName + ': "' + str.trim() + '"');
    return n;
  }

  window.Parser = { ParseError: ParseError, parsePreGameCode: parsePreGameCode };
})();
