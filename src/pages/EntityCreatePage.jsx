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

const ENTITY_TYPES = ["PERSON", "EXPERIENCE", "FACT", "LINK"];

function parseUuidList(raw) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function EntityCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.state?.path;
  const model = location.state?.model;

  const [entityType, setEntityType] = useState("PERSON");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [personForm, setPersonForm] = useState({
    name: "",
    description: "",
    securityLevel: "1",
    createRootStream: true,
  });
  const [experienceForm, setExperienceForm] = useState({
    name: "",
    description: "",
    securityLevel: "1",
    parentExperienceIds: "",
  });
  const [factForm, setFactForm] = useState({
    name: "",
    description: "",
    securityLevel: "1",
    startTime: "",
    endTime: "",
    experienceIds: "",
  });
  const [linkForm, setLinkForm] = useState({
    linkType: "references",
    description: "",
    securityLevel: "1",
    origin: "",
    target: "",
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

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatusMessage("");

    try {
      if (entityType === "PERSON") {
        await createPerson(path, {
          personName: personForm.name,
          personDescription: personForm.description,
          securityLevel: Number(personForm.securityLevel),
          createLifeExperience: Boolean(personForm.createRootStream),
        });
      }

      if (entityType === "EXPERIENCE") {
        await createExperience(path, {
          experienceName: experienceForm.name,
          experienceDescription: experienceForm.description,
          securityLevel: Number(experienceForm.securityLevel),
          parentExperienceIds: parseUuidList(experienceForm.parentExperienceIds),
        });
      }

      if (entityType === "FACT") {
        await createFact(path, {
          factName: factForm.name,
          factDescription: factForm.description,
          securityLevel: Number(factForm.securityLevel),
          startTime: factForm.startTime || null,
          endTime: factForm.endTime || null,
          experienceIds: parseUuidList(factForm.experienceIds),
        });
      }

      if (entityType === "LINK") {
        const [originEntityType, originEntityId] = (linkForm.origin || ":").split(":");
        const [targetEntityType, targetEntityId] = (linkForm.target || ":").split(":");
        await createLink(path, {
          linkType: linkForm.linkType,
          linkDescription: linkForm.description,
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
      setStatusMessage(error?.message || "Entity creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="entity-create-page">
      <section className="entity-create-panel">
        <p className="sequence-label">HASM / SEQ-08</p>
        <h1>Create New Entity</h1>
        <p className="selection-copy">Use a dedicated creation page so each entity form can evolve independently.</p>

        <div className="entity-type-row" role="tablist" aria-label="Entity creation type">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={entityType === type ? "entity-type-chip active" : "entity-type-chip"}
              onClick={() => setEntityType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <form className="entity-create-form" onSubmit={submit} noValidate>
          {entityType === "PERSON" ? <CreatePersonForm value={personForm} onChange={setPersonForm} /> : null}
          {entityType === "EXPERIENCE" ? <CreateExperienceForm value={experienceForm} onChange={setExperienceForm} /> : null}
          {entityType === "FACT" ? <CreateFactForm value={factForm} onChange={setFactForm} /> : null}
          {entityType === "LINK" ? (
            <CreateLinkForm
              value={linkForm}
              onChange={setLinkForm}
              entityOptions={entityOptions}
            />
          ) : null}

          <div className="entity-create-actions">
            <button type="button" onClick={() => navigate("/visualizer", { state: location.state })}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : `Create ${entityType}`}
            </button>
          </div>

          {statusMessage ? <p className="validation-message">{statusMessage}</p> : null}
        </form>
      </section>
    </main>
  );
}

export default EntityCreatePage;
