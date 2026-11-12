import { Form } from "react-bootstrap";
import { translateTicket } from "../features/entityTicket/ticketLanguage";

export default function DateInput({ id, value, onChange, disabled = false, autoFocus = false, t = translateTicket }) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(T.*)?$/);
  const date = match?.[1] || "";
  const parsed = date && new Date(`${date}T00:00:00.000Z`);
  const validDate = date && !date.startsWith("0000-") && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === date;
  const warning = Boolean(value && !validDate);
  const suffix = validDate && match?.[2];
  const hintId = `${id}-date-hint`;
  return (
    <>
      <Form.Control type="date" min="0001-01-01" max="9999-12-31"
        autoFocus={autoFocus} disabled={disabled} value={validDate ? date : ""}
        aria-describedby={warning || suffix ? hintId : undefined}
        onChange={(event) => onChange(event.target.value ? event.target.value + (match?.[2] || "") : "")} />
      {warning || suffix ? <Form.Text id={hintId}>
        {warning ? t("Saved date cannot be shown in the calendar: {value}. Select a date to replace it.", { value })
          : t("Existing time and timezone retained: {time}", { time: suffix })}
      </Form.Text> : null}
    </>
  );
}
