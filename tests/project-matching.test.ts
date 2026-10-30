import { describe, expect, it } from "vitest";
import { findProjects, hasAliasConflict, normalizeProjectText } from "../src/lib/project-matching";

const projects = [{ id: "dear", name: "DearMind" }, { id: "atlas", name: "Atlas Notes" }];
describe("project candidates (synthetic fixtures)", () => {
  it("normalizes CamelCase, punctuation, accents and whitespace", () => {
    expect(normalizeProjectText("  CaféMind\n D-R   ")).toBe("cafe mind d r");
  });
  it("preserves non-Latin project names", () => {
    expect(findProjects("आज नया सफर पर चर्चा", [{ id: "hindi", name: "नया सफर" }], [])[0].score).toBe(100);
  });
  it.each(["DearMind", "Dear Mind", "dearmind"])("finds canonical/spacing variant %s", text => {
    expect(findProjects(`Discuss ${text} tomorrow.`, projects, [])[0]).toMatchObject({project: projects[0], score: expect.any(Number)});
  });
  it.each(["Deer Mind", "DR Mind", "D-R Mind"])("offers a weak phonetic candidate for %s", text => {
    expect(findProjects(`Discuss ${text} tomorrow.`, projects, [])[0]).toMatchObject({project: projects[0], score: 76});
  });
  it("uses generic spelling and phonetic evidence for other names", () => {
    expect(findProjects("Discuss Atlas Nots", projects, [])[0]).toMatchObject({project: projects[1], score: 76});
  });
  it("keeps your mind weak and requires project context", () => {
    expect(findProjects("clear your mind", projects, [])).toEqual([]);
    expect(findProjects("your mind project needs review", projects, [])[0].score).toBe(58);
  });
  it("does not match substrings or invent unknown projects", () => {
    expect(findProjects("DearMindful and unlisted initiatives", projects, [])).toEqual([]);
  });
  it("reuses only supplied confirmed aliases", () => {
    const aliases = [{project_id: "atlas", alias: "Star Map"}];
    expect(findProjects("Discuss Star Map", projects, aliases)[0]).toMatchObject({project: projects[1], score: 100});
    expect(findProjects("Discuss Star Map", projects, [])).toEqual([]);
  });
  it("retains ambiguous similarly named projects instead of choosing a UUID", () => {
    const matches = findProjects("Deer Mind", [...projects, {id:"other",name:"DeerMind"}], []);
    expect(matches.map(m=>m.project.id)).toEqual(["other", "dear"]);
  });
  it("preserves alias conflicts as multiple candidates", () => {
    expect(findProjects("Star Map", projects, projects.map(p=>({project_id:p.id,alias:"Star Map"})))).toHaveLength(2);
  });
  it("rejects normalized alias/canonical conflicts with other projects", () => {
    expect(hasAliasConflict("ATLAS-notes", "dear", projects, [])).toBe(true);
    expect(hasAliasConflict("StarMap", "dear", projects, [{project_id:"atlas",alias:"Star Map"}])).toBe(true);
    expect(hasAliasConflict("Dear Mind", "dear", projects, [])).toBe(false);
  });
});
