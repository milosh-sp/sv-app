import type { ComboboxOption } from "@/components/ui/combobox";

import { techSkills } from "./tech-skills";

function normalizeKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Skills not covered by the tech catalog (product/business + legacy short forms). */
const SUPPLEMENTAL_REVIEWER_SKILLS = [
  "Node.js",
  ".NET",
  "Spring",
  "Go",
  "GCP",
  "Vue",
  "Agile",
  "REST APIs",
  "CI/CD",
  "Flutter & Dart",
  "REST API Integration",
  "CI/CD Pipelines",
  "AI Chatbot Development",
  "Product Management",
  "Strategic Planning",
  "Business Development",
] as const;

function dedupeSkillLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;

    const key = normalizeKey(trimmed);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

/** Predefined skills reviewers can be assigned. */
export const COMMON_REVIEWER_SKILLS: readonly string[] = Object.freeze(
  dedupeSkillLabels(["", ...techSkills.map((skill) => skill.label), ...SUPPLEMENTAL_REVIEWER_SKILLS]).sort((a, b) =>
    a.localeCompare(b),
  ),
);

/** Extra normalized spellings mapped to canonical catalog labels. */
const MANUAL_SKILL_ALIASES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ecmascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  py: "Python",
  python3: "Python",
  golang: "Go",
  "go (golang)": "Go",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  nextjs: "Next.js",
  "next.js": "Next.js",
  reactjs: "React",
  "react.js": "React",
  vuejs: "Vue.js",
  vue: "Vue.js",
  "vue.js": "Vue.js",
  angularjs: "Angular",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  k8s: "Kubernetes (K8s)",
  kube: "Kubernetes (K8s)",
  kubernetes: "Kubernetes (K8s)",
  csharp: "C#",
  "c#": "C#",
  dotnet: ".NET",
  ".net": ".NET",
  cicd: "CI/CD",
  "ci/cd": "CI/CD",
  "ci/cd pipelines": "CI/CD",
  aws: "AWS",
  azure: "Microsoft Azure",
  gcp: "GCP",
  "google cloud platform (gcp)": "GCP",
  googlecloud: "GCP",
  tf: "Terraform",
  graphql: "GraphQL",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  rest: "REST APIs",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  "rest api integration": "REST APIs",
  microservice: "Microservices",
  spring: "Spring Framework",
  agile: "Agile/Scrum",
  "agile/scrum": "Agile",
};

function buildTechSkillIdAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};

  for (const { id, label } of techSkills) {
    const idKey = id.toLowerCase();
    const labelKey = normalizeKey(label);
    if (idKey !== labelKey && !(idKey in MANUAL_SKILL_ALIASES)) {
      aliases[idKey] = label;
    }
  }

  return aliases;
}

export const SKILL_ALIASES: Record<string, string> = {
  ...buildTechSkillIdAliases(),
  ...MANUAL_SKILL_ALIASES,
};

const normalizedKeyToCanonical = new Map<string, string>();

for (const skill of COMMON_REVIEWER_SKILLS) {
  normalizedKeyToCanonical.set(normalizeKey(skill), skill);
}

for (const [aliasKey, canonical] of Object.entries(SKILL_ALIASES)) {
  normalizedKeyToCanonical.set(aliasKey, canonical);
}

/** Compound labels that must not prefix-resolve to a shorter catalog skill. */
const PREFIX_DELIMITERS = [" ", "/", "(", "-"] as const;

const sortedPrefixKeys = [...normalizedKeyToCanonical.keys()].sort((a, b) => b.length - a.length);

function lookupExact(normalized: string): string | undefined {
  return normalizedKeyToCanonical.get(normalized);
}

function lookupByPrefix(normalized: string): string | undefined {
  for (const key of sortedPrefixKeys) {
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

  const prefixMatch = lookupByPrefix(normalized);
  if (prefixMatch) return prefixMatch;

  const firstSegment = splitFirstSegment(trimmed);
  if (firstSegment && firstSegment !== trimmed) {
    const segmentNormalized = normalizeKey(firstSegment);
    const segmentExact = lookupExact(segmentNormalized);
    if (segmentExact) return segmentExact;
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
    const key = normalizeKey(skill);
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
