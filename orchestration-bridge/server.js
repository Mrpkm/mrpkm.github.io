const express = require('express');
const path = require('path');
const controller = require('./lib/puppeteer-controller');
const sessions = require('./lib/session-store');
const { createSampleGameState } = require('./lib/sample-state');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Allow requests from any local origin (file://, port 8080, etc.)
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PORT = process.env.PORT || 3400;

// ─── Health ────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  try {
    const result = await controller.callFunction('engineReady');
    res.json({ bridge: 'ok', engine: result });
  } catch (err) {
    res.status(503).json({ bridge: 'error', message: err.message });
  }
});

// ─── Sessions ──────────────────────────────────────────────────────

app.post('/sessions', (req, res) => {
  const gameState = req.body.gameState || createSampleGameState();
  const id = sessions.createSession(gameState);
  res.status(201).json({ sessionId: id, gameState });
});

app.get('/sessions', (req, res) => {
  res.json(sessions.listSessions());
});

app.get('/sessions/:id', (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.delete('/sessions/:id', (req, res) => {
  const ok = sessions.deleteSession(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Session not found' });
  res.json({ deleted: true });
});

// ─── Game State Analysis ───────────────────────────────────────────

app.post('/sessions/:id/analyze', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const result = await controller.callFunction('analyzeGameState', session.gameState);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/validate', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const result = await controller.callFunction('validateGameState', session.gameState);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Unit Queries ──────────────────────────────────────────────────

app.get('/sessions/:id/units/:unitId/moves', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const result = await controller.callFunction('getLegalMoves', session.gameState, req.params.unitId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sessions/:id/units/:unitId/targets', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const result = await controller.callFunction('getAttackTargets', session.gameState, req.params.unitId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Actions ───────────────────────────────────────────────────────

app.post('/sessions/:id/move', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { unitId, toRow, toCol } = req.body;
  if (!unitId || toRow == null || toCol == null) {
    return res.status(400).json({ error: 'Required: unitId, toRow, toCol' });
  }

  try {
    const result = await controller.callFunction('executeMove', session.gameState, unitId, toRow, toCol);
    if (result.error) return res.status(400).json(result);

    const state = JSON.parse(JSON.stringify(session.gameState));
    for (const player of state.players) {
      const unit = player.units.find(u => u.id === unitId);
      if (unit) {
        unit.row = toRow;
        unit.col = toCol;
        unit.movedThisTurn = true;
        unit.trenchTurns = 0;
        unit.stillTurns = 0;
        unit.actionsRemaining = Math.max(0, (unit.actionsRemaining || 2) - 1);
        break;
      }
    }
    sessions.updateState(req.params.id, state);
    result.updatedState = state;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/attack', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { attackerUnitId, defenderUnitId, diceRoll } = req.body;
  if (!attackerUnitId || !defenderUnitId) {
    return res.status(400).json({ error: 'Required: attackerUnitId, defenderUnitId' });
  }

  try {
    const result = await controller.callFunction('resolveCombat', session.gameState, attackerUnitId, defenderUnitId, diceRoll);
    if (result.error) return res.status(400).json(result);

    const state = JSON.parse(JSON.stringify(session.gameState));
    for (const player of state.players) {
      const attacker = player.units.find(u => u.id === attackerUnitId);
      if (attacker) {
        attacker.actionsRemaining = Math.max(0, (attacker.actionsRemaining || 2) - 1);
        if (result.xpGained) attacker.level = (attacker.level || 0) + 1;
        if (result.stateUpdates?.attackerHp != null) attacker.currentHp = result.stateUpdates.attackerHp;
        if (result.stateUpdates?.attackerKilled) {
          player.units = player.units.filter(u => u.id !== attackerUnitId);
        }
        break;
      }
    }
    for (const player of state.players) {
      const defender = player.units.find(u => u.id === defenderUnitId);
      if (defender) {
        defender.currentHp = result.stateUpdates.defenderHp;
        if (result.stateUpdates?.defenderActionsRemaining != null) {
          defender.actionsRemaining = result.stateUpdates.defenderActionsRemaining;
        }
        if (result.killed) {
          player.units = player.units.filter(u => u.id !== defenderUnitId);
        }
        break;
      }
    }
    sessions.updateState(req.params.id, state);
    result.updatedState = state;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/rotate', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const { unitId, facing } = req.body;
  if (!unitId || !facing) {
    return res.status(400).json({ error: 'Required: unitId, facing (N/E/S/W)' });
  }

  try {
    const result = await controller.callFunction('rotateUnit', session.gameState, unitId, facing);
    if (result.error) return res.status(400).json(result);

    const state = JSON.parse(JSON.stringify(session.gameState));
    for (const player of state.players) {
      const unit = player.units.find(u => u.id === unitId);
      if (unit) { unit.facing = facing; break; }
    }
    sessions.updateState(req.params.id, state);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/end-turn', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const result = await controller.callFunction('endTurn', session.gameState);
    if (result.error) return res.status(400).json(result);

    const newState = sessions.applyUpdates(req.params.id, result);
    result.updatedState = newState;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Strategic AI ──────────────────────────────────────────────────

app.post('/sessions/:id/advise', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    const result = await controller.callFunction('getNextStrategicAction', session.gameState);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Claude AI — built into Artifact (usage-based billing) ─────────

app.get('/claude/status', async (req, res) => {
  try {
    const ready = await controller.callFunction('engineReady');
    const usage = await controller.callFunction('getApiUsage');
    res.json({
      apiBuiltIn: ready.apiBuiltIn || false,
      usage: usage,
      billing: 'Covered by claude.ai host Pro subscription (no API key needed)',
      note: 'The Artifact calls the Anthropic API via the claude.ai proxy — authentication is handled automatically.',
      models: {
        default: 'claude-sonnet-4-20250514',
        fast: 'claude-haiku-4-5-20251001',
        deep: 'claude-opus-4-6'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/claude/usage', async (req, res) => {
  try {
    const usage = await controller.callFunction('getApiUsage');
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/think', async (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const options = {
    model: req.body.model,
    maxTokens: req.body.maxTokens,
    question: req.body.question
  };

  try {
    const result = await controller.callFunction('thinkWithClaude', session.gameState, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Static game files (replaces Python http.server) ──────────────
// Serves the whole project root so http://localhost:3400/core-map/ works.
// Must come AFTER all API routes so API paths take priority.
app.use(express.static(path.resolve(__dirname, '..')));

// ─── Direct engine call (escape hatch) ─────────────────────────────

app.post('/engine/call', async (req, res) => {
  const { functionName, args } = req.body;
  if (!functionName) return res.status(400).json({ error: 'Required: functionName' });

  try {
    const result = await controller.callFunction(functionName, ...(args || []));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Startup ───────────────────────────────────────────────────────

async function start() {
  console.log('[bridge] Launching Puppeteer and loading Artifact...');
  await controller.launch();

  app.listen(PORT, () => {
    console.log('[bridge] Server running on http://localhost:' + PORT);
    console.log('[bridge] Game UI  →  http://localhost:' + PORT + '/core-map/');
    console.log('[bridge] Endpoints:');
    console.log('  GET  /health');
    console.log('  POST /sessions                    — create game session');
    console.log('  GET  /sessions                    — list sessions');
    console.log('  GET  /sessions/:id                — get session state');
    console.log('  POST /sessions/:id/analyze        — analyze board');
    console.log('  POST /sessions/:id/validate       — validate state');
    console.log('  GET  /sessions/:id/units/:uid/moves   — legal moves');
    console.log('  GET  /sessions/:id/units/:uid/targets — attack targets');
    console.log('  POST /sessions/:id/move           — execute move');
    console.log('  POST /sessions/:id/attack         — resolve combat');
    console.log('  POST /sessions/:id/rotate         — rotate facing');
    console.log('  POST /sessions/:id/end-turn       — end turn');
    console.log('  POST /sessions/:id/advise         — AI recommendation (local heuristic)');
    console.log('  POST /sessions/:id/think          — Claude reasoning (built-in proxy API)');
    console.log('  GET  /claude/status                — API status');
    console.log('  GET  /claude/usage                 — token usage this session');
    console.log('  POST /engine/call                 — direct engine call');
    console.log('\n[bridge] Claude API: built-in via claude.ai proxy (no API key needed)');
  });
}

process.on('SIGINT', async () => {
  console.log('\n[bridge] Shutting down...');
  await controller.shutdown();
  process.exit(0);
});

start().catch(err => {
  console.error('[bridge] Fatal:', err);
  process.exit(1);
});
