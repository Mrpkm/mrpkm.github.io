function Timer({ phase, phaseEndsAt, playMs, reflectionMs }) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, (phaseEndsAt || now) - now);
  const total = phase === 'reflection' ? reflectionMs : playMs;
  const pct = total ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Cycle Timer</h2>
        <span className="timer-phase">{phase}</span>
      </div>
      <div className="panel-body">
        <div className="muted">
          {phase === 'play'
            ? 'Match data is write-only until this timer expires.'
            : phase === 'reflection'
              ? 'Shared memory is unlocked for cross-agent analysis.'
              : 'Start a cycle to begin the hourly loop.'}
        </div>
        <div className="timer-value">{formatDuration(remaining)}</div>
        <div style={{ height: 8, borderRadius: 99, background: '#28291d', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#e0bd58' }} />
        </div>
      </div>
    </section>
  );
}

function formatDuration(ms) {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
