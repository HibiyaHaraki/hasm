import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createExperience,
  createFact,
  createLink,
  createPerson,
  loadHasmModelDb,
} from "../features/hasm/api";
import CreateExperienceForm from "../features/entityCreation/components/CreateExperienceForm";
import CreateFactForm from "../features/entityCreation/components/CreateFactForm";
import CreateLinkForm from "../features/entityCreation/components/CreateLinkForm";
import CreatePersonForm from "../features/entityCreation/components/CreatePersonForm";
import { Button, Container, Form } from "react-bootstrap";
import "../pages/PanelCard.css";
import "./EntityFormPage.css";
import { ExternalLinksEditor, isExternalUrl } from "../features/entityTicket/ExternalLinksEditor";
import { createLogger } from "../hasm_logger/src/react/logger.js";

const ENTITY_TYPES = ["PERSON", "EXPERIENCE", "FACT", "LINK"];
const logger = createLogger("entity-creation");

// [REQ-04-RULE-010] [REQ-04-RULE-011] Entity creation page (SEQ-MD-08): collects the shared
// external `link: string[]` array for every entity type and rejects invalid HTTP(S) URLs
// before any creation invoke is issued.
function EntityCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.state?.path;
  const model = location.state?.model;

  const [entityType, setEntityType] = useState("PERSON");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [personForm, setPersonForm] = useState({
    link: [],
    name: "",
    securityLevel: "1",
    createRootStream: true,
  });
  const [experienceForm, setExperienceForm] = useState({
    link: [],
    name: "",
    securityLevel: "1",
    parentExperienceIds: [],
  });
  const [factForm, setFactForm] = useState({
    link: [],
    name: "",
    securityLevel: "1",
    startTime: "",
    endTime: "",
    experienceIds: [],
  });
  const [linkForm, setLinkForm] = useState({
    link: [],
    linkType: "references",
    securityLevel: "1",
    origin: "",
    target: "",
    originSearch: "",
    targetSearch: "",
  });

  const entityOptions = useMemo(() => {
    if (!model) return [];
    return [
      ...(model.people || []).map((item) => ({ label: `PERSON ${item.personName || item.personId}`, value: `PERSON:${item.personId}` })),
      ...(model.experiences || []).map((item) => ({ label: `EXPERIENCE ${item.experienceName || item.experienceId}`, value: `EXPERIENCE:${item.experienceId}` })),
      ...(model.facts || []).map((item) => ({ label: `FACT ${item.factName || item.factId}`, value: `FACT:${item.factId}` })),
    ];
  }, [model]);

  useEffect(() => {
    if (!path || !model) {
      navigate("/select", { replace: true });
    }
  }, [model, navigate, path]);

  if (!path || !model) return null;
  const activeForm = { PERSON: personForm, EXPERIENCE: experienceForm, FACT: factForm, LINK: linkForm }[entityType];
  const setActiveForm = { PERSON: setPersonForm, EXPERIENCE: setExperienceForm, FACT: setFactForm, LINK: setLinkForm }[entityType];

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    if (activeForm.link.some((url) => !isExternalUrl(url))) {
      setStatusMessage("Each external link must be an absolute HTTP(S) URL without credentials or whitespace.");
      return;
    }
    setSubmitting(true);
    setStatusMessage("");

    try {
      logger.info(`[SEQ-MD-08][CREATE] creating ${entityType} with default Markdown`);
      if (entityType === "PERSON") {
        await createPerson(path, {
          link: personForm.link,
          personName: personForm.name,
          personDescription: "",
          securityLevel: Number(personForm.securityLevel),
          createLifeExperience: Boolean(personForm.createRootStream),
        });
      }

      if (entityType === "EXPERIENCE") {
        await createExperience(path, {
          link: experienceForm.link,
          experienceName: experienceForm.name,
          experienceDescription: "",
          securityLevel: Number(experienceForm.securityLevel),
          parentExperienceIds: experienceForm.parentExperienceIds,
        });
      }

      if (entityType === "FACT") {
        await createFact(path, {
          link: factForm.link,
          factName: factForm.name,
          factDescription: "",
          securityLevel: Number(factForm.securityLevel),
          startTime: factForm.startTime || null,
          endTime: factForm.endTime || null,
          experienceIds: factForm.experienceIds,
        });
      }

      if (entityType === "LINK") {
        const [originEntityType, originEntityId] = (linkForm.origin || ":").split(":");
        const [targetEntityType, targetEntityId] = (linkForm.target || ":").split(":");
        await createLink(path, {
          link: linkForm.link,
          linkType: linkForm.linkType,
          linkDescription: "",
          securityLevel: Number(linkForm.securityLevel),
          originEntityType,
          originEntityId,
          targetEntityType,
          targetEntityId,
        });
      }

      const latestModel = await loadHasmModelDb(path);
      navigate("/visualizer", {
        replace: true,
        state: { path, model: latestModel, isVerified: true },
      });
    } catch (error) {
      logger.error(`[SEQ-MD-08][CREATE] ${entityType} creation or model reload failed`, error);
      setStatusMessage(error?.message || "Entity creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container as="main" fluid className="panel-layout d-flex align-items-center justify-content-center">
      <section className="panel-card panel-card--wide">
        <h1>Create New Entity</h1>
        <p className="selection-copy">A default Markdown description is created automatically. Edit it in HASM Markdown after creation.</p>

        <div className="entity-type-row d-flex flex-wrap gap-2" role="tablist" aria-label="Entity creation type">
          {ENTITY_TYPES.map((type) => (
            <Button
              key={type}
              variant={entityType === type ? undefined : "outline-secondary"}
              className={entityType === type ? "btn-hasm-primary" : "btn-hasm-outline"}
              onClick={() => setEntityType(type)}
            >
              {type}
            </Button>
          ))}
        </div>

        <Form onSubmit={submit} noValidate>
          {entityType === "PERSON" ? <CreatePersonForm value={personForm} onChange={setPersonForm} /> : null}
          {entityType === "EXPERIENCE" ? <CreateExperienceForm value={experienceForm} onChange={setExperienceForm} experiences={model.experiences || []} /> : null}
          {entityType === "FACT" ? <CreateFactForm value={factForm} onChange={setFactForm} experiences={model.experiences || []} /> : null}
          {entityType === "LINK" ? (
            <CreateLinkForm
              value={linkForm}
              onChange={setLinkForm}
              entityOptions={entityOptions}
            />
          ) : null}

          <ExternalLinksEditor value={activeForm.link} onChange={(link) => setActiveForm({ ...activeForm, link })} disabled={submitting} />
          <div className="d-flex justify-content-end gap-2 mt-3">
            <Button variant="outline-secondary" className="btn-hasm-outline" onClick={() => navigate("/visualizer", { state: location.state })}>
              Cancel
            </Button>
            <Button type="submit" className="btn-hasm-primary" disabled={submitting}>
              {submitting ? "Creating..." : `Create ${entityType}`}
            </Button>
          </div>

          {statusMessage ? <p className="validation-message" role="alert">{statusMessage}</p> : null}
        </Form>
      </section>
    </Container>
  );
}

export default EntityCreatePage;
