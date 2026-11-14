import { useMemo } from "react";
import { Button } from "react-bootstrap";
import { ExperienceMultiSelect } from "../../../hasm_visualizer/ExperienceMultiSelect";
import { dismissEntityPreview } from "../../entityTicket/EntityInfoPreview";
import { translateTicket } from "../../entityTicket/ticketLanguage";

// [REQ-04-RULE-017] Shared searchable, removable-badge EXPERIENCE selector used by both
// entity creation and detail editing, with an explicit Clear action.
// [REQ-04-RULE-027] Choices participate in the shared entity information preview.
// [REQ-07-RULE-006] Selected badges rely on readable theme foreground tokens.
function ExperienceSelect({ controlId, label, value, onChange, experiences, disabled = false, t = translateTicket }) {
  const options = useMemo(() => experiences.map((experience) => ({
    id: experience.experienceId,
    label: experience.experienceName?.trim() || t("Untitled EXPERIENCE"),
  })), [experiences, t]);
  return (
    <>
      <ExperienceMultiSelect id={controlId} label={label} options={options} value={value} onChange={onChange}
        disabled={disabled} entityPreview onDismiss={dismissEntityPreview}
        searchLabel={t("Search {label}", { label })}
        searchPlaceholder={t("Search experiences")} placeholder={t("Select experiences")}
        emptyLabel={t("No EXPERIENCE available")} noMatchesLabel={t("No matching experiences.")}
        unavailableLabel={t("Unavailable EXPERIENCE")}
        removeLabel={(title) => t("Remove {title}", { title })} />
      <p id={`${controlId}-help`} className="selection-copy mb-1">
        {t("Search experiences, then select or remove them. Hover or focus a choice for entity information.")}
      </p>
      <Button type="button" variant="outline-secondary" className="btn-hasm-outline"
        disabled={disabled || value.length === 0} onClick={() => onChange([])}>
        {t("Clear {label}", { label })}
      </Button>
    </>
  );
}

export default ExperienceSelect;
