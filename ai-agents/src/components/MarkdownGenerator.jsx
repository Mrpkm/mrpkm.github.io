function MarkdownGenerator({ markdown }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>Markdown Generator</h3>
        <a className="muted" href="/api/learning-journal" target="_blank" rel="noreferrer">open .md</a>
      </div>
      <div className="panel-body">
        <textarea
          className="journal"
          readOnly
          value={markdown || '# Learning journal\n\nComplete one reflection cycle to generate the first report.'}
        />
      </div>
    </section>
  );
}
