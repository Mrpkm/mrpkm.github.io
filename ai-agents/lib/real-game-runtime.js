function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function apiJson(baseUrl, urlPath, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const response = await fetch(baseUrl + urlPath, opts);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bridge ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

function mirrorOpponentIfNeeded(gameState) {
  const state = clone(gameState);
  const rows = state.board?.rows || 12;
  const cols = state.board?.cols || 11;
  const player = state.players?.[0];
  const opponent = state.players?.[1];

  if (!player || !opponent || opponent.units?.length) return state;

  opponent.doctrine = opponent.doctrine || player.doctrine || 'Plain';
  opponent.hqHp = opponent.hqHp || 20;
  opponent.hqPosition = opponent.hqPosition || { row: rows, col: cols };
  opponent.units = (player.units || []).map((unit, index) => ({
    ...clone(unit),
    id: `ai_enemy_${index + 1}_${unit.id}`,
    row: rows - unit.row + 1,
    col: cols - unit.col + 1,
    facing: 'N',
    movedThisTurn: false,
    actionsRemaining: 2,
  }));

  return state;
}

class RealGameRuntime {
  constructor({ bridgeBaseUrl }) {
    this.bridgeBaseUrl = bridgeBaseUrl;
    this.seedState = null;
    this.agentSessions = new Map();
    this.liveGameAssignments = new Map();
    this.nextQueuedAgent = 0;
  }

  configure(seedState) {
    this.seedState = mirrorOpponentIfNeeded(seedState);
    this.agentSessions.clear();
  }

  hasSeed() {
    return Boolean(this.seedState);
  }

  async beginCycle(agents) {
    if (!this.seedState) return;
    this.agentSessions.clear();

    await Promise.all(agents.map(async (agent) => {
      const seeded = clone(this.seedState);
      seeded.matchLabel = `${agent.name} real-game cycle`;
      const session = await apiJson(this.bridgeBaseUrl, '/sessions', 'POST', { gameState: seeded });
      this.agentSessions.set(agent.id, session.sessionId);
      agent.realSessionId = session.sessionId;
    }));
  }

  async playAgentStep(agent) {
    const sessionId = this.agentSessions.get(agent.id);
    if (!sessionId) {
      return {
        id: `${agent.id}-no-session-${Date.now()}`,
        agentId: agent.id,
        result: 'draw',
        strategy: 'waiting for real game session',
        turns: 0,
        highlights: ['No real game session is available for this agent.'],
      };
    }

    const advice = await apiJson(this.bridgeBaseUrl, `/sessions/${sessionId}/advise`, 'POST');
    const recommendation = advice.recommendation || { type: 'end_turn', reasoning: 'No recommendation returned.' };
    let actionResult = null;

    if (recommendation.type === 'move' && recommendation.destination) {
      actionResult = await apiJson(this.bridgeBaseUrl, `/sessions/${sessionId}/move`, 'POST', {
        unitId: recommendation.unitId,
        toRow: recommendation.destination.row,
        toCol: recommendation.destination.col,
      });
    } else if (recommendation.type === 'attack' && recommendation.targetId) {
      actionResult = await apiJson(this.bridgeBaseUrl, `/sessions/${sessionId}/attack`, 'POST', {
        attackerUnitId: recommendation.unitId,
        defenderUnitId: recommendation.targetId,
      });
    } else {
      actionResult = await apiJson(this.bridgeBaseUrl, `/sessions/${sessionId}/end-turn`, 'POST');
    }

    const session = await apiJson(this.bridgeBaseUrl, `/sessions/${sessionId}`);
    const state = session.gameState;
    const p0 = state.players?.[0];
    const p1 = state.players?.[1];
    const winner = actionResult.winner;
    const result = winner === 0 ? 'win' : winner === 1 ? 'loss' : 'draw';

    return {
      id: `${agent.id}-real-${Date.now()}`,
      agentId: agent.id,
      result,
      strategy: recommendation.reasoning || recommendation.type,
      turns: state.turnNumber || 1,
      highlights: [
        `Real session ${sessionId}`,
        `Action: ${recommendation.type}`,
        recommendation.reasoning || 'No reasoning supplied.',
        `HQ: ${p0?.hqHp ?? '?'} vs ${p1?.hqHp ?? '?'}`,
      ],
      realGame: {
        sessionId,
        action: recommendation,
        activePlayer: state.activePlayer,
        turnNumber: state.turnNumber,
        unitCounts: {
          player: p0?.units?.length || 0,
          opponent: p1?.units?.length || 0,
        },
      },
    };
  }

  assignQueuedAgent(agents, bridgeSessionId) {
    if (this.liveGameAssignments.has(bridgeSessionId)) {
      return agents[this.liveGameAssignments.get(bridgeSessionId)];
    }

    const index = this.nextQueuedAgent % agents.length;
    this.liveGameAssignments.set(bridgeSessionId, index);
    this.nextQueuedAgent = (this.nextQueuedAgent + 1) % agents.length;
    return agents[index];
  }

  queueSnapshot(agents) {
    return {
      nextAgent: agents[this.nextQueuedAgent % agents.length]?.name,
      assignments: Array.from(this.liveGameAssignments.entries()).map(([sessionId, index]) => ({
        sessionId,
        agentId: agents[index]?.id,
        agentName: agents[index]?.name,
      })),
    };
  }

  async playQueuedOpponentTurn({ agents, bridgeSessionId }) {
    const agent = this.assignQueuedAgent(agents, bridgeSessionId);
    let session = await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}`);
    let state = session.gameState;

    if (state.activePlayer !== 1) {
      const endPlayerTurn = await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}/end-turn`, 'POST');
      state = endPlayerTurn.updatedState || (await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}`)).gameState;
    }

    const actions = [];
    for (let step = 0; step < 2; step += 1) {
      state = (await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}`)).gameState;
      if (state.activePlayer !== 1) break;

      const advice = await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}/advise`, 'POST');
      const recommendation = advice.recommendation || { type: 'end_turn', reasoning: 'No recommendation returned.' };
      let actionResult;

      if (recommendation.type === 'move' && recommendation.destination) {
        actionResult = await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}/move`, 'POST', {
          unitId: recommendation.unitId,
          toRow: recommendation.destination.row,
          toCol: recommendation.destination.col,
        });
      } else if (recommendation.type === 'attack' && recommendation.targetId) {
        actionResult = await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}/attack`, 'POST', {
          attackerUnitId: recommendation.unitId,
          defenderUnitId: recommendation.targetId,
        });
      } else {
        break;
      }

      actions.push({
        type: recommendation.type,
        unitId: recommendation.unitId,
        reasoning: recommendation.reasoning,
        result: actionResult,
      });
    }

    const endAiTurn = await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}/end-turn`, 'POST');
    const updatedState = endAiTurn.updatedState || (await apiJson(this.bridgeBaseUrl, `/sessions/${bridgeSessionId}`)).gameState;

    return {
      agent: {
        id: agent.id,
        name: agent.name,
      },
      bridgeSessionId,
      actions,
      updatedState,
      queue: this.queueSnapshot(agents),
    };
  }
}

module.exports = { RealGameRuntime };
