function AIAgentManager({ agents }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>AI Agent Manager</h2>
        <span className="muted">{agents.length}/4 initialized</span>
      </div>
      <div className="panel-body agent-list">
        {agents.map((agent) => (
          <article className="agent-card" key={agent.id}>
            <strong>
              <span className={`status-dot ${agent.status}`} />
              {agent.name}
            </strong>
            <div className="muted">Status: {agent.status}</div>
            <div className="muted">Matches: {agent.matchesPlayed}</div>
            <div className="muted">Last: {agent.lastResult || 'none'} via {agent.lastStrategy || 'none'}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
