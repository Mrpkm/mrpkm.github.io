const EventEmitter = require('events');
const { callGitHubModel } = require('./github-models');
const { buildCycleMarkdown } = require('./markdown-generator');
const { simulateMatch } = require('./agent-runtime');
const { RealGameRuntime } = require('./real-game-runtime');

class CycleRunner extends EventEmitter {
  constructor({ agents, sharedMemory, endpoint, model, apiVersion, playMs, reflectionMs, bridgeBaseUrl }) {
    super();
    this.agents = agents;
    this.sharedMemory = sharedMemory;
    this.endpoint = endpoint;
    this.model = model;
    this.apiVersion = apiVersion;
    this.playMs = playMs;
    this.reflectionMs = reflectionMs;
    this.cycle = 0;
    this.phase = 'idle';
    this.phaseEndsAt = null;
    this.startedAt = null;
    this.timers = new Set();
    this.latestMarkdown = sharedMemory.readJournal();
    this.latestInsights = [];
    this.realGame = new RealGameRuntime({ bridgeBaseUrl });
    this.mode = 'standalone';
  }

  status() {
    return {
      cycle: this.cycle,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      playMs: this.playMs,
      reflectionMs: this.reflectionMs,
      agents: this.agents.map(({ apiKey, ...agent }) => agent),
      latestMarkdown: this.latestMarkdown,
      latestInsights: this.latestInsights,
      mode: this.mode,
      realGameReady: this.realGame.hasSeed(),
      queue: this.realGame.queueSnapshot(this.agents),
    };
  }

  configureRealGame(seedState) {
    this.realGame.configure(seedState);
    this.mode = 'real-game';
    this.emit('status', this.status());
  }

  playQueuedOpponentTurn(bridgeSessionId) {
    return this.realGame.playQueuedOpponentTurn({
      agents: this.agents,
      bridgeSessionId,
    });
  }

  assignQueuedOpponent(bridgeSessionId) {
    const agent = this.realGame.assignQueuedAgent(this.agents, bridgeSessionId);
    return {
      agent: {
        id: agent.id,
        name: agent.name,
      },
      bridgeSessionId,
      queue: this.realGame.queueSnapshot(this.agents),
    };
  }

  start() {
    if (this.phase !== 'idle') return this.status();
    this.startPlayPhase();
    return this.status();
  }

  stop() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.phase = 'idle';
    this.phaseEndsAt = null;
    this.sharedMemory.finishCycle();
    this.emit('status', this.status());
  }

  async startPlayPhase() {
    this.cycle += 1;
    this.phase = 'play';
    this.startedAt = new Date().toISOString();
    // Timer logic: play always owns a one-hour countdown in production. When it
    // expires, all match writers stop implicitly because the phase changes.
    this.phaseEndsAt = Date.now() + this.playMs;
    this.sharedMemory.beginCycle(this.cycle, this.agents);
    this.latestInsights = [];

    if (this.mode === 'real-game' && this.realGame.hasSeed()) {
      try {
        await this.realGame.beginCycle(this.agents);
      } catch (err) {
        this.latestInsights = [`Real-game session setup failed: ${err.message}`];
      }
    }

    for (const agent of this.agents) {
      agent.status = agent.apiKey ? 'playing' : 'playing-local-fallback';
      this.scheduleAgentMatch(agent);
    }

    this.schedule(() => this.startReflectionPhase(), this.playMs);
    this.emit('status', this.status());
  }

  async scheduleAgentMatch(agent) {
    if (this.phase !== 'play') return;

    let match;
    try {
      match = this.mode === 'real-game' && this.realGame.hasSeed()
        ? await this.realGame.playAgentStep(agent)
        : simulateMatch(agent, this.cycle);
      if (this.phase !== 'play') return;
      agent.matchesPlayed += 1;
      agent.lastResult = match.result;
      agent.lastStrategy = match.strategy;
      this.sharedMemory.appendMatchEvent(agent.id, match);
    } catch (err) {
      if (this.phase !== 'play') return;
      match = {
        id: `${agent.id}-error-${Date.now()}`,
        agentId: agent.id,
        strategy: 'runtime error',
        result: 'loss',
        turns: 0,
        highlights: [err.message],
      };
      this.sharedMemory.appendMatchEvent(agent.id, match);
    }
    this.emit('status', this.status());

    const delay = 10000 + Math.floor(Math.random() * 20000);
    this.schedule(() => this.scheduleAgentMatch(agent), delay);
  }

  async startReflectionPhase() {
    if (this.phase !== 'play') return;

    this.phase = 'reflection';
    // Timer logic: reflection gets a separate ten-minute countdown. The next
    // hourly play cycle starts only after this window has generated the journal.
    this.phaseEndsAt = Date.now() + this.reflectionMs;
    this.sharedMemory.unlockForReflection();
    for (const agent of this.agents) agent.status = 'reflecting';
    this.emit('status', this.status());

    try {
      await this.reflect();
    } catch (err) {
      this.latestInsights = [`Reflection failed: ${err.message}`];
    }

    this.schedule(() => this.finishReflectionPhase(), this.reflectionMs);
    this.emit('status', this.status());
  }

  async reflect() {
    const snapshot = this.sharedMemory.getReflectionSnapshot();
    const agents = this.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      matches: snapshot.agentLogs.find((log) => log.agentId === agent.id)?.matches || [],
    }));

    const prompt = [
      'Analyze these isolated strategy-game match logs across four agents.',
      'Return five concise shared learnings. Focus on actionable strategy patterns.',
      JSON.stringify({ cycle: this.cycle, agents }, null, 2),
    ].join('\n\n');

    const key = this.agents.find((agent) => agent.apiKey)?.apiKey;
    let insights;
    try {
      const result = await callGitHubModel({
        apiKey: key,
        endpoint: this.endpoint,
        model: this.model,
        apiVersion: this.apiVersion,
        messages: [
          { role: 'system', content: 'You are a strategy-game reflection engine.' },
          { role: 'user', content: prompt },
        ],
      });
      insights = result.content
        .split('\n')
        .map((line) => line.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 5);
    } catch (err) {
      insights = [`GitHub reflection unavailable: ${err.message}`];
    }

    if (!insights.length) {
      insights = [
        'Agents performed best when they preserved damaged units before pursuing kills.',
        'The strongest attacks concentrated fire instead of spreading pressure.',
        'Early center control created more late-game tactical options.',
      ];
    }

    this.latestInsights = insights;
    const markdown = buildCycleMarkdown({
      cycle: this.cycle,
      startedAt: this.startedAt,
      endedAt: new Date().toISOString(),
      agents,
      insights,
      priorMarkdown: snapshot.priorMarkdown,
    });

    this.latestMarkdown = this.sharedMemory.appendMarkdown(markdown);
  }

  finishReflectionPhase() {
    if (this.phase !== 'reflection') return;
    for (const agent of this.agents) agent.status = 'ready';
    this.sharedMemory.finishCycle();
    this.phase = 'idle';
    this.phaseEndsAt = null;
    this.emit('status', this.status());
    this.startPlayPhase();
  }

  schedule(fn, ms) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }
}

module.exports = { CycleRunner };
