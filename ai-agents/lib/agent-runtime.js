const STRATEGIES = [
  'secure center terrain before committing armor',
  'probe flanks with cavalry and preserve artillery',
  'rotate damaged infantry out of contact early',
  'concentrate fire on one isolated defender',
];

function makeAgents(keys) {
  return keys.map((apiKey, index) => ({
    id: `agent-${index + 1}`,
    name: `Agent ${index + 1}`,
    apiKey,
    status: apiKey ? 'ready' : 'missing-key',
    matchesPlayed: 0,
    lastResult: null,
    lastStrategy: null,
  }));
}

function simulateMatch(agent, cycle) {
  const strategy = STRATEGIES[(agent.matchesPlayed + cycle + Number(agent.id.split('-')[1])) % STRATEGIES.length];
  const score = Math.sin((agent.matchesPlayed + 1) * (cycle + 2)) + Math.random();
  const result = score > 0.75 ? 'win' : score < -0.1 ? 'loss' : 'draw';
  const turns = 6 + Math.floor(Math.random() * 8);

  return {
    id: `${agent.id}-cycle-${cycle}-match-${agent.matchesPlayed + 1}`,
    agentId: agent.id,
    strategy,
    result,
    turns,
    highlights: [
      `Turn ${Math.max(1, Math.floor(turns / 2))}: ${strategy}.`,
      result === 'win'
        ? 'Converted positional advantage into a late attack.'
        : result === 'loss'
          ? 'Lost tempo after overextending one unit group.'
          : 'Reached parity but lacked a finishing tactic.',
    ],
  };
}

module.exports = { makeAgents, simulateMatch };
