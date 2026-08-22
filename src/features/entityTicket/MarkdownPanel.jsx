export function MarkdownPanel({ markdown, refresh, deleted, changed, loading }) {
  return <section className="markdown-panel"><header><h2>Markdown</h2><button className={deleted ? "refresh-danger" : changed ? "refresh-alert" : ""} type="button" onClick={refresh} disabled={loading}>Refresh Markdown</button></header><pre>{markdown}</pre></section>;
}