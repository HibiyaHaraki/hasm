import { translateTicket } from "./ticketLanguage";

const ENTITY_COLLECTIONS = {
  PERSON: "people",
  EXPERIENCE: "experiences",
  FACT: "facts",
  LINK: "links",
};

// [REQ-04-RULE-018] [REQ-04-RULE-019] Builds the id->entity title lookup and the
// LINK-endpoint reverse index from the already loaded model, without another workspace load.
export function createEntityReferenceIndex(model) {
  const entities = new Map();
  const linksByEntity = new Map();
  for (const [type, collection] of Object.entries(ENTITY_COLLECTIONS)) {
    for (const entity of model?.[collection] ?? []) {
      const id = entity[`${type.toLowerCase()}Id`];
      entities.set(id, { type, entity });
      if (type === "LINK") {
        for (const endpoint of new Set(entity.relatedIds ?? [])) {
          if (!linksByEntity.has(endpoint)) linksByEntity.set(endpoint, []);
          linksByEntity.get(endpoint).push(id);
        }
      }
    }
  }
  return { entities, linksByEntity, available: Boolean(model) };
}

// [REQ-04-RULE-018] Resolves a human-readable entity title with explicit
// unavailable/untitled fallbacks instead of opaque UUIDs.
export function entityReferenceTitle(index, id, type, ticket, t = translateTicket) {
  if (ticket?.entityId === id && (!type || type === ticket.entityType)) return ticket.name || t("Untitled {type}", { type: ticket.entityType });
  const match = index.entities.get(id);
  if (!match || (type && match.type !== type)) return t("Unavailable {type}", { type: type || t("entity") });
  const name = match.entity[`${match.type.toLowerCase()}Name`]?.trim();
  return name || (match.type === "LINK" && match.entity.linkType) || t("Untitled {type}", { type: match.type });
}

const REFERENCE_TYPES = {
  personId: "PERSON",
  personIds: "PERSON",
  parentExperienceIds: "EXPERIENCE",
  experienceIds: "EXPERIENCE",
  linkIds: "LINK",
};

// [REQ-04-RULE-018] [REQ-04-RULE-020] Maps a typed detail field to its resolved entity
// references (id, type, title) used for readable labels and ticket navigation links.
export function detailEntityReferences(index, field, detail, ticket, t = translateTicket) {
  const { key, list } = field;
  if (!REFERENCE_TYPES[key] && key !== "relatedIds") return null;
  const value = detail[key];
  const ids = list ? value ?? [] : value ? [value] : [];
  return ids.map((id) => {
    const type = index.entities.get(id)?.type;
    return {
      id,
      type: !REFERENCE_TYPES[key] || type === REFERENCE_TYPES[key] ? type : undefined,
      title: entityReferenceTitle(index, id, REFERENCE_TYPES[key], ticket, t),
    };
  });
}

// [REQ-04-RULE-018] Reading-mode display value showing titles (never raw UUIDs) with
// explicit None/Not set fallbacks.
export function detailDisplayValue(index, field, detail, ticket) {
  const references = detailEntityReferences(index, field, detail, ticket);
  return references
    ? references.length ? references.map(({ title }) => title).join(", ") : field.list ? "None" : "Not set"
    : detail[field.key] || "Not set";
}

// [REQ-04-RULE-019] [REQ-04-RULE-028] Deduplicated union of explicit linkIds and LINKs
// referencing the entity in either endpoint position.
export function relatedLinkIds(index, entityId, detail) {
  return [...new Set([...(detail.linkIds ?? []), ...(index.linksByEntity.get(entityId) ?? [])])];
}
