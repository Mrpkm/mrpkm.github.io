function LearningDashboard({ status }) {
  return (
    <main className="dashboard-grid">
      <aside className="main-stack">
        <Timer
          phase={status.phase}
          phaseEndsAt={status.phaseEndsAt}
          playMs={status.playMs}
          reflectionMs={status.reflectionMs}
        />
        <AIAgentManager agents={status.agents} />
      </aside>

      <section className="main-stack">
        <MatchPlayer agents={status.agents} phase={status.phase} />
        <ReflectionEngine phase={status.phase} insights={status.latestInsights || []} />
        <MarkdownGenerator markdown={status.latestMarkdown} />
      </section>
    </main>
  );
}
