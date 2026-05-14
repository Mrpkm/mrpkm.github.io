const { useEffect, useState } = React;

function useAgentStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/status').then((res) => res.json()).then(setStatus);
    const events = new EventSource('/api/events');
    events.onmessage = (event) => setStatus(JSON.parse(event.data));
    return () => events.close();
  }, []);

  return status;
}

function App() {
  const status = useAgentStatus();

  const start = async () => {
    const res = await fetch('/api/cycles/start', { method: 'POST' });
    // The server owns the loop; this only refreshes the UI immediately.
    window.__lastAgentStatus = await res.json();
  };

  const stop = async () => {
    await fetch('/api/cycles/stop', { method: 'POST' });
  };

  if (!status) {
    return <div className="app-shell">Loading agent system...</div>;
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="title-block">
          <h1>AI Agent Learning Loop</h1>
          <p>Four isolated players, shared reflection, one improving markdown journal.</p>
        </div>
        <div className="controls">
          <button className="button" onClick={start}>Start Cycle</button>
          <button className="button secondary" onClick={stop}>Stop</button>
        </div>
      </div>

      <LearningDashboard status={status} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
