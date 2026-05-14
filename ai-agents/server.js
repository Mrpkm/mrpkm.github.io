require('dotenv').config();

const express = require('express');
const path = require('path');
const { makeAgents } = require('./lib/agent-runtime');
const { CycleRunner } = require('./lib/cycle-runner');
const { SharedMemory } = require('./lib/shared-memory');

const app = express();
const PORT = Number(process.env.PORT || 3500);

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const agentKeys = [
  process.env.GITHUB_AGENT_1_KEY,
  process.env.GITHUB_AGENT_2_KEY,
  process.env.GITHUB_AGENT_3_KEY,
  process.env.GITHUB_AGENT_4_KEY,
];

const sharedMemory = new SharedMemory({
  dataDir: path.join(__dirname, 'data'),
});

const runner = new CycleRunner({
  agents: makeAgents(agentKeys),
  sharedMemory,
  endpoint: process.env.GITHUB_MODELS_ENDPOINT || 'https://models.github.ai/inference/chat/completions',
  model: process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4o-mini',
  apiVersion: process.env.GITHUB_API_VERSION || '2026-03-10',
  bridgeBaseUrl: process.env.ORCHESTRATION_BRIDGE_URL || 'http://localhost:3400',
  playMs: Number(process.env.PLAY_SESSION_MS || 60 * 60 * 1000),
  reflectionMs: Number(process.env.REFLECTION_SESSION_MS || 10 * 60 * 1000),
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/assets', express.static(path.resolve(__dirname, '..', 'assets')));

app.get('/api/status', (req, res) => {
  res.json(runner.status());
});

app.post('/api/cycles/start', (req, res) => {
  res.json(runner.start());
});

app.post('/api/integrations/core-map/start', (req, res) => {
  if (!req.body?.gameState) {
    return res.status(400).json({ error: 'Required: gameState' });
  }

  runner.configureRealGame(req.body.gameState);
  res.json(runner.start());
});

app.post('/api/integrations/core-map/ai-opponent-turn', async (req, res) => {
  if (!req.body?.bridgeSessionId) {
    return res.status(400).json({ error: 'Required: bridgeSessionId' });
  }

  try {
    const result = await runner.playQueuedOpponentTurn(req.body.bridgeSessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/integrations/core-map/assign-opponent', (req, res) => {
  if (!req.body?.bridgeSessionId) {
    return res.status(400).json({ error: 'Required: bridgeSessionId' });
  }

  res.json(runner.assignQueuedOpponent(req.body.bridgeSessionId));
});

app.post('/api/cycles/stop', (req, res) => {
  runner.stop();
  res.json(runner.status());
});

app.get('/api/learning-journal', (req, res) => {
  res.type('text/markdown').send(sharedMemory.readJournal());
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = () => res.write(`data: ${JSON.stringify(runner.status())}\n\n`);
  send();
  runner.on('status', send);

  req.on('close', () => {
    runner.off('status', send);
  });
});

app.listen(PORT, () => {
  console.log(`[ai-agents] Dashboard running on http://localhost:${PORT}`);
  console.log('[ai-agents] Journal path: ' + path.join(__dirname, 'data', 'learning-journal.md'));
});
