const ENTITY_COLLECTIONS = {
  PERSON: "people",
  EXPERIENCE: "experiences",
  FACT: "facts",
  LINK: "links",
};

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

export function entityReferenceTitle(index, id, type, ticket) {
  if (ticket?.entityId === id && (!type || type === ticket.entityType)) return ticket.name || `Untitled ${ticket.entityType}`;
  const match = index.entities.get(id);
  if (!match || (type && match.type !== type)) return `Unavailable ${type || "entity"}`;
  const name = match.entity[`${match.type.toLowerCase()}Name`]?.trim();
  return name || (match.type === "LINK" && match.entity.linkType) || `Untitled ${match.type}`;
}

const REFERENCE_TYPES = {
  personId: "PERSON",
  personIds: "PERSON",
  parentExperienceIds: "EXPERIENCE",
  experienceIds: "EXPERIENCE",
  linkIds: "LINK",
};

export function detailEntityReferences(index, field, detail, ticket) {
  const { key, list } = field;
  if (!REFERENCE_TYPES[key] && key !== "relatedIds") return null;
  const value = detail[key];
  const ids = list ? value ?? [] : value ? [value] : [];
  return ids.map((id) => {
    const type = index.entities.get(id)?.type;
    return {
      id,
      type: !REFERENCE_TYPES[key] || type === REFERENCE_TYPES[key] ? type : undefined,
      title: entityReferenceTitle(index, id, REFERENCE_TYPES[key], ticket),
    };
  });
}

export function detailDisplayValue(index, field, detail, ticket) {
  const references = detailEntityReferences(index, field, detail, ticket);
  return references
    ? references.length ? references.map(({ title }) => title).join(", ") : field.list ? "None" : "Not set"
    : detail[field.key] || "Not set";
}

export function relatedLinkIds(index, entityId, detail) {
  return [...new Set([...(detail.linkIds ?? []), ...(index.linksByEntity.get(entityId) ?? [])])];
}
