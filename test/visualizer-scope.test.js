import { describe, expect, it } from "vitest";
import { countModelEntities, isEmptyScope, listExperienceOptions, listPersonOptions, scopeModel } from "../src/hasm_visualizer/modelScope.js";
import { limitRenderedNodes } from "../src/hasm_visualizer/threeCommitGraph.js";

const camelCaseModel = {
  people: [
    { personId: "person-1", personName: "Ada" },
    { personId: "person-2", personName: "Bob" },
  ],
  experiences: [
    { experienceId: "exp-root", personId: "person-1", experienceName: "Root", parentExperienceIds: [] },
    { experienceId: "exp-child", personId: "person-1", experienceName: "Child", parentExperienceIds: ["exp-root"] },
    { experienceId: "exp-other", personId: "person-2", experienceName: "Other", parentExperienceIds: [] },
  ],
  facts: [
    { factId: "fact-root", experienceIds: ["exp-root"], personIds: ["person-1"] },
    { factId: "fact-child", experienceIds: ["exp-child"], personIds: ["person-1"] },
    { factId: "fact-other", experienceIds: ["exp-other"], personIds: ["person-2"] },
  ],
  links: [
    { linkId: "link-in", relatedIds: ["fact-root", "fact-child"] },
    { linkId: "link-out", relatedIds: ["fact-root", "fact-other"] },
  ],
};

const snakeCaseModel = {
  people: [{ person_id: "person-1", person_name: "Ada" }],
  experiences: [{ experience_id: "exp-1", person_id: "person-1", experience_name: "Research", parent_experience_ids: [] }],
  facts: [{ fact_id: "fact-1", experience_ids: ["exp-1"], person_ids: ["person-1"] }],
  links: [],
};

describe("EVAL-03 visualizer scope selection", () => {
  it("TC-03-SCOPE-001 returns the model unchanged for an empty scope", () => {
    expect(isEmptyScope({ personIds: [], experienceIds: [] })).toBe(true);
    expect(scopeModel(camelCaseModel, { personIds: [], experienceIds: [] })).toBe(camelCaseModel);
    expect(countModelEntities(camelCaseModel)).toBe(10);
  });

  it("TC-03-SCOPE-002 narrows to a PERSON and keeps only fully contained links", () => {
    const scoped = scopeModel(camelCaseModel, { personIds: ["person-1"], experienceIds: [] });

    expect(scoped.people.map((person) => person.personId)).toEqual(["person-1"]);
    expect(scoped.experiences.map((experience) => experience.experienceId)).toEqual(["exp-root", "exp-child"]);
    expect(scoped.facts.map((fact) => fact.factId)).toEqual(["fact-root", "fact-child"]);
    // link-out reaches fact-other, which is outside the scope.
    expect(scoped.links.map((link) => link.linkId)).toEqual(["link-in"]);
  });

  it("TC-03-SCOPE-003 keeps ancestors and descendants of a selected EXPERIENCE", () => {
    const fromChild = scopeModel(camelCaseModel, { personIds: [], experienceIds: ["exp-child"] });
    expect(fromChild.experiences.map((experience) => experience.experienceId).sort()).toEqual(["exp-child", "exp-root"]);

    const fromRoot = scopeModel(camelCaseModel, { personIds: [], experienceIds: ["exp-root"] });
    expect(fromRoot.experiences.map((experience) => experience.experienceId).sort()).toEqual(["exp-child", "exp-root"]);
  });

  it("TC-03-SCOPE-004 offers EXPERIENCE options filtered by the PERSON selection", () => {
    expect(listPersonOptions(camelCaseModel).map((option) => option.label)).toEqual(["Ada", "Bob"]);
    expect(listExperienceOptions(camelCaseModel, []).map((option) => option.id)).toEqual(["exp-root", "exp-child", "exp-other"]);
    expect(listExperienceOptions(camelCaseModel, ["person-2"]).map((option) => option.id)).toEqual(["exp-other"]);
  });

  it("TC-03-SCOPE-005 reads the snake_case shape used by the bundled sample packages", () => {
    const scoped = scopeModel(snakeCaseModel, { personIds: ["person-1"], experienceIds: [] });
    expect(scoped.experiences).toHaveLength(1);
    expect(scoped.facts).toHaveLength(1);
  });
});

describe("EVAL-03 visualizer render budget", () => {
  const payloadWith = (factCount) => ({
    nodes3d: [
      { id: "exp-1", entityType: "EXPERIENCE" },
      ...Array.from({ length: factCount }, (_value, index) => ({ id: `fact-${index}`, entityType: "FACT" })),
    ],
    lines3d: [],
  });

  it("TC-03-BUDGET-001 passes a payload within budget through untouched", () => {
    const payload = payloadWith(10);
    const result = limitRenderedNodes(payload, 4000);
    expect(result.payload).toBe(payload);
    expect(result.warning).toBe("");
  });

  it("TC-03-BUDGET-002 trims FACT nodes beyond the budget and reports the remainder", () => {
    const result = limitRenderedNodes(payloadWith(100), 51);
    expect(result.payload.nodes3d).toHaveLength(51);
    expect(result.payload.nodes3d.filter((node) => node.entityType === "EXPERIENCE")).toHaveLength(1);
    expect(result.warning).toContain("Showing 50 of 100 FACT nodes");
    expect(result.warning).toContain("remaining 50");
  });
});
