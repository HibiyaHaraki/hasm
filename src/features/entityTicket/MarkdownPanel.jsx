import { Button, Card } from "react-bootstrap";
import "./MarkdownPanel.css";

export function MarkdownPanel({ markdown, refresh, deleted, changed, loading }) {
  return (
    <Card className="markdown-panel">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h2 className="mb-0">Markdown</h2>
        <Button
          size="sm"
          className={deleted ? "refresh-danger" : changed ? "refresh-alert" : "btn-hasm-outline"}
          onClick={refresh}
          disabled={loading}
        >
          Refresh Markdown
        </Button>
      </Card.Header>
      <Card.Body>
        <pre className="mb-0">{markdown}</pre>
      </Card.Body>
    </Card>
  );
}