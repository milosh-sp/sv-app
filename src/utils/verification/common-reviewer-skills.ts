import type { ComboboxOption } from "@/components/ui/combobox";

function normalizeKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Predefined skills reviewers can be assigned. Grouped in source for readability. */
export const COMMON_REVIEWER_SKILLS = [
  // Languages
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C#",
  "Go",
  "Rust",
  "SQL",
  "HTML",
  "CSS",
  // Frameworks & runtimes
  "React",
  "Vue",
  "Angular",
  "Node.js",
  "Next.js",
  "Django",
  "Spring",
  ".NET",
  // Cloud & DevOps
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "CI/CD",
  // Data & databases
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "TensorFlow",
  "PyTorch",
  // Other
  "Git",
  "Linux",
  "Agile",
  "REST APIs",
  "Microservices",
] as const satisfies readonly string[];

/** Extra normalized spellings mapped to canonical catalog labels. */
export const SKILL_ALIASES: Record<string, (typeof COMMON_REVIEWER_SKILLS)[number]> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ecmascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  py: "Python",
  python3: "Python",
  golang: "Go",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  nextjs: "Next.js",
  "next.js": "Next.js",
  reactjs: "React",
  "react.js": "React",
  vuejs: "Vue",
  "vue.js": "Vue",
  angularjs: "Angular",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  k8s: "Kubernetes",
  kube: "Kubernetes",
  csharp: "C#",
  "c#": "C#",
  dotnet: ".NET",
  ".net": ".NET",
  cicd: "CI/CD",
  "ci/cd": "CI/CD",
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  googlecloud: "GCP",
  tf: "Terraform",
  graphql: "GraphQL",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  rest: "REST APIs",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  microservice: "Microservices",
};

const normalizedKeyToCanonical = new Map<string, string>();

for (const skill of COMMON_REVIEWER_SKILLS) {
  normalizedKeyToCanonical.set(normalizeKey(skill), skill);
}

for (const [aliasKey, canonical] of Object.entries(SKILL_ALIASES)) {
  normalizedKeyToCanonical.set(aliasKey, canonical);
}

/** Compound labels that must not prefix-resolve to a shorter catalog skill. */
const COMPOUND_SKILL_BLOCKLIST = new Set(["react native", "react-native"]);

const PREFIX_DELIMITERS = [" ", "/", "(", "-"] as const;

const sortedPrefixKeys = [...normalizedKeyToCanonical.keys()].sort((a, b) => b.length - a.length);

function lookupExact(normalized: string): string | undefined {
  return normalizedKeyToCanonical.get(normalized);
}

function isBlocklistedCompound(normalized: string): boolean {
  return COMPOUND_SKILL_BLOCKLIST.has(normalized);
}

function lookupByPrefix(normalized: string): string | undefined {
  for (const key of sortedPrefixKeys) {
    if (normalized === key) {
      return normalizedKeyToCanonical.get(key);
    }

    for (const delimiter of PREFIX_DELIMITERS) {
      if (normalized.startsWith(`${key}${delimiter}`)) {
        return normalizedKeyToCanonical.get(key);
      }
    }
  }

  return undefined;
}

function splitFirstSegment(trimmed: string): string | undefined {
  const first = trimmed.split(/[\s/(,]+/)[0]?.trim();
  return first || undefined;
}

export function resolveCanonicalSkillLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const normalized = normalizeKey(trimmed);

  const exact = lookupExact(normalized);
  if (exact) return exact;

  if (isBlocklistedCompound(normalized)) return trimmed;

  const prefixMatch = lookupByPrefix(normalized);
  if (prefixMatch) return prefixMatch;

  const firstSegment = splitFirstSegment(trimmed);
  if (firstSegment && firstSegment !== trimmed) {
    const segmentNormalized = normalizeKey(firstSegment);
    const segmentExact = lookupExact(segmentNormalized);
    if (segmentExact) return segmentExact;

    if (!isBlocklistedCompound(segmentNormalized)) {
      const segmentPrefix = lookupByPrefix(segmentNormalized);
      if (segmentPrefix) return segmentPrefix;
    }
  }

  return trimmed;
}

/** Normalized key used for reviewer ↔ request skill equality checks. */
export function getSkillMatchKey(label: string): string {
  const canonical = resolveCanonicalSkillLabel(label);
  return normalizeKey(canonical);
}

const catalogKeySet = new Set(COMMON_REVIEWER_SKILLS.map((skill) => normalizeKey(skill)));

export function isCommonReviewerSkill(skill: string): boolean {
  return catalogKeySet.has(normalizeKey(skill));
}

/** Merge catalog skills with legacy extras not in the catalog. */
export function buildReviewerSkillOptions(extraSkills: string[] = []): ComboboxOption<string>[] {
  const seen = new Set<string>();
  const options: ComboboxOption<string>[] = [];

  for (const skill of COMMON_REVIEWER_SKILLS) {
    const key = getSkillMatchKey(skill);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: skill, label: skill });
  }

  for (const skill of extraSkills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const key = getSkillMatchKey(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: resolveCanonicalSkillLabel(trimmed), label: resolveCanonicalSkillLabel(trimmed) });
  }

  return options;
}
