export type Project = { id: string; name: string };
export type ProjectAlias = { project_id: string; alias: string };
export type ProjectMatch = { project: Project; matched: string; score: number; evidence: string };

export function normalizeProjectText(value: string): string {
  return value.replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
const compact = (value: string) => normalizeProjectText(value).replace(/ /g, "");

// English phonetic suggestions are deliberately weaker than exact/confirmed names.
// Other scripts still support exact names and confirmed aliases.
function soundex(word: string): string {
  if (!/^[a-z]+$/.test(word)) return "";
  const groups = ["bfpv", "cgjkqsxz", "dt", "l", "mn", "r"];
  const code = (char: string) => String(groups.findIndex(group => group.includes(char)) + 1);
  let previous = code(word[0]);
  let result = word[0];
  for (const char of word.slice(1)) {
    const next = code(char);
    if (next !== "0" && next !== previous) result += next;
    previous = next;
  }
  return (result + "000").slice(0, 4);
}
function oneEditApart(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function tokens(value: string): string[] {
  // D-R Mind -> dr mind; preserve word boundaries for all other matching.
  return normalizeProjectText(value).replace(/\b([a-z]) ([a-z])\b/g, "$1$2").split(" ").filter(Boolean);
}

export function findProjects(text: string, projects: Project[], aliases: ProjectAlias[]): ProjectMatch[] {
  const input = tokens(text);
  return projects.map(project => {
    let best: ProjectMatch = { project, matched: "", score: 0, evidence: "" };
    for (const name of [project.name, ...aliases.filter(a => a.project_id === project.id).map(a => a.alias)]) {
      const words = tokens(name);
      if (!words.length) continue;
      const offer = (score: number, evidence: string) => {
        if (score > best.score) best = { project, matched: name, score, evidence };
      };
      for (let i = 0; i < input.length; i++) {
        for (let size = 1; size <= Math.min(words.length + 2, input.length - i); size++) {
          const window = input.slice(i, i + size);
          if (window.join(" ") === words.join(" ")) offer(100, "name or confirmed alias");
          else if (window.join("") === words.join("")) offer(92, "word-spacing variation");
          if (size !== words.length || size < 2) continue;
          const different = words.map((word, j) => word === window[j] ? -1 : j).filter(j => j >= 0);
          if (different.length !== 1) continue;
          const at = different[0], a = words[at], b = window[at];
          if ((soundex(a) && soundex(a) === soundex(b)) || oneEditApart(a, b)) offer(76, "possible pronunciation or spelling");
          // Generic weak context: a shared word plus an adjacent mention of 'project'.
          // Never promote this evidence into an automatic selection.
          if (size === 2 && input.slice(Math.max(0, i - 2), i + size + 2).includes("project")) offer(58, "weak project context");
        }
      }
    }
    return best;
  }).filter(match => match.score >= 55).sort((a, b) => b.score - a.score || a.project.id.localeCompare(b.project.id));
}

export function hasAliasConflict(alias: string, projectId: string, projects: Project[], aliases: ProjectAlias[]): boolean {
  const key = compact(alias);
  return projects.some(p => p.id !== projectId && compact(p.name) === key)
    || aliases.some(a => a.project_id !== projectId && compact(a.alias) === key);
}
