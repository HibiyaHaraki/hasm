import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { openUrl } from "@tauri-apps/plugin-opener";
import "./ExternalLinksEditor.css";

export function isExternalUrl(value) {
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && Boolean(url.hostname)
      && !url.username && !url.password && !/\s/.test(value);
  } catch {
    return false;
  }
}

export function externalLinkSite(value) {
  if (!isExternalUrl(value)) return { name: "Web page", icon: "web" };
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const belongsTo = (domain) => host === domain || host.endsWith(`.${domain}`);
  if (belongsTo("x.com") || belongsTo("twitter.com")) return { name: "X", icon: "x" };
  if (host === "maps.app.goo.gl" || host === "maps.google.com"
    || (belongsTo("google.com") && /^\/maps(?:\/|$)/.test(url.pathname))) {
    return { name: "Google Maps", icon: "maps" };
  }
  if (belongsTo("google.com")) return { name: "Google", icon: "google" };
  return { name: "Web page", icon: "web" };
}

function SiteIcon({ site }) {
  return (
    <span className="external-link-icon" role="img" aria-label={`${site.name} icon`}>
      {site.icon === "x" ? "X" : site.icon === "google" ? "G" : (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
          {site.icon === "maps" ? (
            <><path d="M12 22S4 14 4 9a8 8 0 0 1 16 0c0 5-8 13-8 13Z" /><circle cx="12" cy="9" r="3" /></>
          ) : (
            <><circle cx="12" cy="12" r="10" /><ellipse cx="12" cy="12" rx="4" ry="10" /><path d="M2 12h20M4 6h16M4 18h16" /></>
          )}
        </svg>
      )}
    </span>
  );
}

export function ExternalLinkPreview({ url, children }) {
  const [error, setError] = useState("");
  const site = externalLinkSite(url);
  async function open(event) {
    event.preventDefault();
    setError("");
    try {
      await openUrl(url);
    } catch (failure) {
      setError(failure?.message || String(failure));
    }
  }
  return (
    <>
      <a className="external-link-preview" href={url} target="_blank" rel="noopener noreferrer"
        onClick={open}>
        {children ?? <><SiteIcon site={site} /><span>{site.name}: {url}</span></>}
      </a>
      {error ? <p role="alert">Could not open external link: {error}</p> : null}
    </>
  );
}

export function ExternalLinksView({ value, onEdit, disabled }) {
  return value.length ? (
    <ul className="external-links-read">
      {value.map((url, index) => (
        <li key={`${index}-${url}`}>
          <Button id={`ticket-link-read-${index}`} className="ticket-content-trigger external-link-value" disabled={disabled}
            aria-label={`Edit external link ${index + 1}`} onClick={onEdit}>
            <SiteIcon site={externalLinkSite(url)} /><span>{url}</span>
          </Button>
          {isExternalUrl(url) ? <ExternalLinkPreview url={url}>
            <span className="visually-hidden">Open link {index + 1}: </span>Open
          </ExternalLinkPreview> : <p role="alert">Invalid external URL: {url}</p>}
        </li>
      ))}
    </ul>
  ) : (
    <Button id="ticket-links-read" className="ticket-content-trigger" disabled={disabled} onClick={onEdit}
      aria-label="Edit external links">No external links</Button>
  );
}

export function ExternalLinksEditor({ value, onChange, disabled = false, autoFocus = false }) {
  return (
    <fieldset className="external-links" disabled={disabled}>
      <legend>External links</legend>
      <p className="external-links-help">Related pages, SNS messages, or maps. Use a full HTTP(S) URL.</p>
      {value.map((url, index) => {
        const valid = isExternalUrl(url);
        return (
          <div className="external-link-row" key={index}>
            <Form.Group controlId={`external-link-${index}`} className="external-link-field">
              <Form.Label>Link {index + 1}</Form.Label>
              <Form.Control type="url" required value={url} isInvalid={!valid} autoFocus={autoFocus && index === 0}
                aria-describedby={!valid ? `external-link-error-${index}` : undefined}
                onChange={(event) => onChange(value.map((item, position) => position === index ? event.target.value : item))} />
              {!valid ? <Form.Control.Feedback type="invalid" id={`external-link-error-${index}`}>Enter an absolute HTTP(S) URL without credentials or whitespace.</Form.Control.Feedback> : null}
            </Form.Group>
            <Button type="button" className="btn-hasm-outline" variant="outline-secondary"
              aria-label={`Remove link ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove</Button>
            {valid ? <ExternalLinkPreview url={url} /> : null}
          </div>
        );
      })}
      <Button type="button" className="btn-hasm-outline" variant="outline-secondary" autoFocus={autoFocus && value.length === 0}
        onClick={() => onChange([...value, ""])}>Add link</Button>
    </fieldset>
  );
}
