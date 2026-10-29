import { useMemo, useState } from "react";
import MarkdownIt from "markdown-it";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button, Card } from "react-bootstrap";
import { isExternalUrl } from "./ExternalLinksEditor";
import { createLogger } from "../../hasm_logger/src/react/logger.js";
import "./MarkdownPanel.css";

const renderer = new MarkdownIt({ html: false, linkify: true });
const logger = createLogger("markdown-preview");

export function MarkdownPanel({ markdown, refresh, edit, deleted, changed, loading }) {
  const html = useMemo(() => renderer.render(markdown), [markdown]);
  const [linkError, setLinkError] = useState("");

  async function openLink(event) {
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (href?.startsWith("#")) return;
    event.preventDefault();
    setLinkError("");
    if (!isExternalUrl(href)) {
      setLinkError("Only absolute HTTP(S) links can be opened from this preview.");
      return;
    }
    try {
      await openUrl(href);
    } catch (error) {
      logger.error("[SEQ-MD-04][PREVIEW] could not open Markdown link", error);
      setLinkError(error?.message || String(error));
    }
  }

  return (
    <Card className="markdown-panel">
      <Card.Header className="d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <h2 className="mb-0">Markdown</h2>
        <div className="d-flex flex-wrap gap-2">
          <Button size="sm" className="btn-hasm-primary" onClick={edit} disabled={loading}>
            Edit Markdown in HASM App
          </Button>
          <Button
            size="sm"
            className={deleted ? "refresh-danger" : changed ? "refresh-alert" : "btn-hasm-outline"}
            onClick={refresh}
            disabled={loading}
          >
            Refresh Markdown
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        <article className="markdown-preview" aria-label="Markdown preview"
          onClick={openLink} dangerouslySetInnerHTML={{ __html: html }} />
        {linkError ? <p role="alert">Could not open Markdown link: {linkError}</p> : null}
      </Card.Body>
    </Card>
  );
}