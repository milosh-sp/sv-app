import { describe, expect, it } from "vite-plus/test";

import {
  buildReviewerSkillOptions,
  COMMON_REVIEWER_SKILLS,
  getSkillMatchKey,
  isCommonReviewerSkill,
  resolveCanonicalSkillLabel,
} from "./common-reviewer-skills";
import { normalizeSkillLabel } from "./skills";

describe("COMMON_REVIEWER_SKILLS", () => {
  it("should have no case-insensitive duplicates", () => {
    const seen = new Set<string>();
    for (const skill of COMMON_REVIEWER_SKILLS) {
      const key = normalizeSkillLabel(skill);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("should include canonical JavaScript label", () => {
    expect(isCommonReviewerSkill("JavaScript")).toBe(true);
    expect(isCommonReviewerSkill("javascript")).toBe(true);
  });

  it("should include tech catalog skills", () => {
    expect(isCommonReviewerSkill("Docker")).toBe(true);
    expect(isCommonReviewerSkill("FastAPI")).toBe(true);
    expect(isCommonReviewerSkill("Playwright")).toBe(true);
    expect(COMMON_REVIEWER_SKILLS.length).toBeGreaterThan(500);
  });
});

describe("buildReviewerSkillOptions", () => {
  it("should include catalog skills", () => {
    const options = buildReviewerSkillOptions();
    expect(options.some((opt) => opt.value === "TypeScript")).toBe(true);
  });

  it("should merge legacy extras not in catalog", () => {
    const options = buildReviewerSkillOptions(["LegacySkill"]);
    expect(options.some((opt) => opt.value === "LegacySkill")).toBe(true);
    expect(options.some((opt) => opt.value === "JavaScript")).toBe(true);
  });

  it("should not duplicate skills already in catalog", () => {
    const options = buildReviewerSkillOptions(["javascript", "Python"]);
    const javascriptCount = options.filter((opt) => opt.value === "JavaScript").length;
    expect(javascriptCount).toBe(1);
  });

  it("should include verification screenshot skills in catalog options", () => {
    const screenshotSkills = [
      "Flutter & Dart",
      "REST API Integration",
      "CI/CD Pipelines",
      "AI Chatbot Development",
      "Product Management",
      "Strategic Planning",
      "Business Development",
    ] as const;
    const options = buildReviewerSkillOptions();
    const values = new Set(options.map((opt) => opt.value));

    for (const skill of screenshotSkills) {
      expect(values.has(skill)).toBe(true);
    }
  });
});

describe("resolveCanonicalSkillLabel", () => {
  it("should resolve aliases to catalog labels", () => {
    expect(resolveCanonicalSkillLabel("js")).toBe("JavaScript");
    expect(resolveCanonicalSkillLabel("Javascript")).toBe("JavaScript");
    expect(resolveCanonicalSkillLabel("nodejs")).toBe("Node.js");
  });

  it("should resolve compound and qualified labels", () => {
    expect(resolveCanonicalSkillLabel("JavaScript ES6/ES7")).toBe("JavaScript");
    expect(resolveCanonicalSkillLabel("JS (ES6+)")).toBe("JavaScript");
    expect(resolveCanonicalSkillLabel("Node.js / Express")).toBe("Node.js");
  });

  it("should not conflate Java with JavaScript", () => {
    expect(resolveCanonicalSkillLabel("Java")).toBe("Java");
    expect(resolveCanonicalSkillLabel("Java SE")).toBe("Java");
  });

  it("should not resolve blocklisted compound skills to a shorter catalog skill", () => {
    expect(resolveCanonicalSkillLabel("React Native")).toBe("React Native");
    expect(resolveCanonicalSkillLabel("react-native")).toBe("React Native");
  });

  it("should preserve unknown skills and unknown compounds", () => {
    expect(resolveCanonicalSkillLabel("LegacySkill")).toBe("LegacySkill");
    expect(resolveCanonicalSkillLabel("LegacySkill ES6")).toBe("LegacySkill ES6");
  });

  it("should resolve screenshot skill aliases to canonical catalog labels", () => {
    expect(resolveCanonicalSkillLabel("REST API Integration")).toBe("REST APIs");
    expect(resolveCanonicalSkillLabel("CI/CD Pipelines")).toBe("CI/CD");
  });

  it("should preserve screenshot skills that are canonical catalog entries", () => {
    expect(resolveCanonicalSkillLabel("Flutter & Dart")).toBe("Flutter & Dart");
    expect(resolveCanonicalSkillLabel("AI Chatbot Development")).toBe("AI Chatbot Development");
    expect(resolveCanonicalSkillLabel("Product Management")).toBe("Product Management");
    expect(resolveCanonicalSkillLabel("Strategic Planning")).toBe("Strategic Planning");
    expect(resolveCanonicalSkillLabel("Business Development")).toBe("Business Development");
  });
});

describe("getSkillMatchKey", () => {
  it("should produce the same key for spelling variants", () => {
    expect(getSkillMatchKey("JavaScript")).toBe(getSkillMatchKey("Javascript"));
    expect(getSkillMatchKey("JS")).toBe(getSkillMatchKey("JavaScript"));
    expect(getSkillMatchKey("Nodejs")).toBe(getSkillMatchKey("Node.js"));
  });

  it("should produce the same key for compound JavaScript labels", () => {
    const key = getSkillMatchKey("JavaScript");
    expect(getSkillMatchKey("JS")).toBe(key);
    expect(getSkillMatchKey("Javascript")).toBe(key);
    expect(getSkillMatchKey("JavaScript ES6/ES7")).toBe(key);
    expect(getSkillMatchKey("JS (ES6+)")).toBe(key);
  });

  it("should keep React Native distinct from React", () => {
    expect(getSkillMatchKey("React Native")).not.toBe(getSkillMatchKey("React"));
  });

  it("should fall back to normalized unknown labels", () => {
    expect(getSkillMatchKey("LegacySkill")).toBe("legacyskill");
  });
});
