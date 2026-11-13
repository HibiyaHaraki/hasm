import { createEntityReferenceIndex, relatedLinkIds } from "./EntityReferences";

// [REQ-04-RULE-023] Extracts the ticket-scoped graph model (FACT placements, ancestor
// reflections, adjacent timeline events, LINK endpoints, descended PERSON EXPERIENCEs)
// without mutating or reloading the workspace, terminating on cyclic ancestry.
// SEQ-MD-04: extract relationships before layout; never expand LINKs transitively.
export function extractEntityGraphModel(model, entityType, entityId, detail) {
  if (!model) return null;
  const collection = { PERSON: "people", EXPERIENCE: "experiences", FACT: "facts", LINK: "links" }[entityType];
  const idKey = `${entityType.toLowerCase()}Id`;
  const original = (model[collection] ?? []).find((entity) => entity[idKey] === entityId);
  const current = {
    ...original,
    ...detail,
    [idKey]: entityId,
  };
  const source = {
    ...model,
    [collection]: original
      ? model[collection].map((entity) => entity[idKey] === entityId ? current : entity)
      : [...(model[collection] ?? []), current],
  };
  const index = createEntityReferenceIndex(source);
  const experiences = new Set();
  const facts = new Set();
  const people = new Set();
  const links = new Set();
  const children = new Map();
  for (const experience of source.experiences ?? []) {
    for (const parent of experience.parentExperienceIds ?? []) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(experience.experienceId);
    }
  }
  const descend = (seeds) => {
    const visited = new Set();
    const pending = [...seeds];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      experiences.add(id);
      pending.push(...(children.get(id) ?? []));
    }
  };
  const ancestors = (seeds) => {
    const visited = new Set();
    const pending = [...seeds];
    while (pending.length) {
      const id = pending.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      experiences.add(id);
      pending.push(...(index.entities.get(id)?.entity.parentExperienceIds ?? []));
    }
    return visited;
  };
  const addEndpoint = (id) => {
    const match = index.entities.get(id);
    if (match?.type === "FACT") facts.add(id);
    if (match?.type === "EXPERIENCE") experiences.add(id);
    if (match?.type === "PERSON") people.add(id);
  };
  const orderedFacts = [...(source.facts ?? [])].sort((left, right) => {
    const a = left.occurredAt ?? "";
    const b = right.occurredAt ?? "";
    return (a < b ? -1 : a > b ? 1 : 0) || left.factId.localeCompare(right.factId);
  });
  const factsByExperience = new Map();
  for (const fact of orderedFacts) {
    for (const id of fact.experienceIds ?? []) {
      if (!factsByExperience.has(id)) factsByExperience.set(id, []);
      factsByExperience.get(id).push(fact);
    }
  }

  if (entityType === "PERSON") {
    people.add(entityId);
    descend((source.experiences ?? [])
      .filter((experience) => experience.personId === entityId || experience.experienceId === current.lifeExperienceId)
      .map((experience) => experience.experienceId));
    for (const fact of orderedFacts) {
      if ((fact.experienceIds ?? []).some((id) => experiences.has(id))) facts.add(fact.factId);
    }
  } else if (entityType === "EXPERIENCE") {
    experiences.add(entityId);
    for (const id of current.parentExperienceIds ?? []) experiences.add(id);
    for (const id of children.get(entityId) ?? []) experiences.add(id);
    for (const fact of orderedFacts) {
      if ((fact.experienceIds ?? []).includes(entityId)) facts.add(fact.factId);
    }
  } else if (entityType === "FACT") {
    facts.add(entityId);
    const branches = ancestors(current.experienceIds ?? []);
    const timelines = new Map([...branches].map((id) => [id, []]));
    for (const fact of orderedFacts) {
      const visited = new Set();
      const pending = [...(fact.experienceIds ?? [])];
      while (pending.length) {
        const id = pending.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        timelines.get(id)?.push(fact);
        pending.push(...(index.entities.get(id)?.entity.parentExperienceIds ?? []));
      }
    }
    for (const timeline of timelines.values()) {
      const position = timeline.findIndex((fact) => fact.factId === entityId);
      if (position > 0) facts.add(timeline[position - 1].factId);
      if (position >= 0 && position + 1 < timeline.length) facts.add(timeline[position + 1].factId);
    }
  }

  if (entityType !== "PERSON") {
    const related = entityType === "LINK" ? [entityId] : relatedLinkIds(index, entityId, current);
    for (const id of related) {
      const relationship = index.entities.get(id);
      if (relationship?.type !== "LINK") continue;
      links.add(id);
      for (const endpoint of relationship.entity.relatedIds ?? []) addEndpoint(endpoint);
    }
  }
  for (const fact of source.facts ?? []) {
    if (facts.has(fact.factId)) for (const id of fact.experienceIds ?? []) experiences.add(id);
  }
  // EXPERIENCE LINK endpoints need a recorded timeline point for the shared renderer.
  for (const id of experiences) {
    const timeline = factsByExperience.get(id) ?? [];
    if (timeline.some((fact) => facts.has(fact.factId))) continue;
    const anchor = timeline.at(-1);
    if (anchor) facts.add(anchor.factId);
  }
  for (const fact of source.facts ?? []) {
    if (!facts.has(fact.factId)) continue;
    for (const id of fact.personIds ?? []) people.add(id);
    ancestors(fact.experienceIds ?? []);
  }
  ancestors([...experiences]);
  for (const experience of source.experiences ?? []) {
    if (experiences.has(experience.experienceId) && experience.personId) people.add(experience.personId);
  }
  return {
    ...source,
    people: (source.people ?? []).filter((person) => people.has(person.personId)),
    experiences: (source.experiences ?? []).filter((experience) => experiences.has(experience.experienceId)),
    facts: (source.facts ?? []).filter((fact) => facts.has(fact.factId)),
    links: (source.links ?? []).filter((link) => links.has(link.linkId)),
  };
}
