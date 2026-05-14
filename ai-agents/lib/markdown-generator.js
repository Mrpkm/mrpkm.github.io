function section(title, body) {
  return `## ${title}\n\n${body.trim()}\n`;
}

function summarizeAgent(agent) {
  const wins = agent.matches.filter((m) => m.result === 'win').length;
  const losses = agent.matches.filter((m) => m.result === 'loss').length;
  const draws = agent.matches.filter((m) => m.result === 'draw').length;
  const last = agent.matches.at(-1);

  return [
    `### ${agent.name}`,
    '',
    `- Matches: ${agent.matches.length}`,
    `- Record: ${wins}W / ${losses}L / ${draws}D`,
    `- Last strategy: ${last?.strategy || 'none recorded'}`,
    `- Last outcome: ${last?.result || 'none recorded'}`,
  ].join('\n');
}

function buildCycleMarkdown({ cycle, startedAt, endedAt, agents, insights, priorMarkdown }) {
  const previousCycles = (priorMarkdown.match(/^# Cycle /gm) || []).length;
  const headline = `# Cycle ${cycle} Learning Report`;
  const metadata = [
    `- Started: ${startedAt}`,
    `- Ended: ${endedAt}`,
    `- Prior cycles in journal: ${previousCycles}`,
    `- Agents reflected: ${agents.length}`,
  ].join('\n');

  const matchSummary = agents.map(summarizeAgent).join('\n\n');
  const sharedInsights = insights.length
    ? insights.map((item) => `- ${item}`).join('\n')
    : '- No shared insight generated.';

  return [
    headline,
    '',
    section('Cycle Metadata', metadata),
    section('Match Summary', matchSummary),
    section('Shared Insights', sharedInsights),
    section('Next Cycle Learning Goals', [
      '- Test the strongest opening from this cycle against varied terrain.',
      '- Track whether early aggression preserves unit health over longer matches.',
      '- Compare loss patterns before committing to a doctrine change.',
    ].join('\n')),
  ].join('\n');
}

module.exports = { buildCycleMarkdown };
