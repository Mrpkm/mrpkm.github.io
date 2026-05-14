function MatchPlayer({ agents, phase }) {
  const accessLabel = phase === 'play'
    ? 'write-only'
    : phase === 'reflection'
      ? 'reflection-readable'
      : 'locked';

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Independent Match Players</h3>
        <span className="muted">{phase === 'play' ? 'running' : 'paused'}</span>
      </div>
      <div className="panel-body match-grid">
        {agents.map((agent) => (
          <article className="match-card" key={agent.id}>
            <strong>{agent.name}</strong>
            <div className="muted">Runtime: {agent.status}</div>
            <div>Matches played: {agent.matchesPlayed}</div>
            <div>Latest result: {agent.lastResult || 'waiting'}</div>
            <div className="muted">Data access: {accessLabel}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
