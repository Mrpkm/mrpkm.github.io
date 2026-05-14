function ReflectionEngine({ phase, insights }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Reflection Engine</h3>
        <span className="muted">{phase === 'reflection' ? 'memory unlocked' : 'locked'}</span>
      </div>
      <div className="panel-body">
        <p className="muted">
          The server enforces the isolation boundary: play can append match events only, while reflection can read every agent log and the prior journal.
        </p>
        <div className="agent-list">
          {(insights.length ? insights : ['No insights yet. Complete a play phase to generate shared learning.']).map((insight, index) => (
            <div className="insight-card" key={`${index}-${insight}`}>{insight}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
