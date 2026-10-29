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

export function detailDisplayValue(index, field, detail, ticket) {
  const { key, list } = field;
  const value = detail[key];
  if (REFERENCE_TYPES[key] || key === "relatedIds") {
    const ids = list ? value ?? [] : value ? [value] : [];
    return ids.length
      ? ids.map((id) => entityReferenceTitle(index, id, REFERENCE_TYPES[key], ticket)).join(", ")
      : list ? "None" : "Not set";
  }
  return value || "Not set";
}

export function relatedLinkIds(index, entityId, detail) {
  return [...new Set([...(detail.linkIds ?? []), ...(index.linksByEntity.get(entityId) ?? [])])];
}
