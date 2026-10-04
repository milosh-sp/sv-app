import { describe, expect, it } from "vite-plus/test";

import type { SkillItem } from "./skills";

import {
  deriveSkillKeywordId,
  expandSkillItemsForVerification,
  findSkillCategoryForVerificationId,
  findVerifiableSkillUnit,
  normalizeReviewerSkills,
  normalizeSkillLabel,
  reviewerCanReviewSkill,
} from "./skills";

const parentId = "019bef5a-93e4-7746-ad39-622f9d41da55";

const categoryWithKeywords: SkillItem = {
  id: parentId,
  hidden: false,
  icon: "cpu",
  name: "Programming Languages",
  proficiency: "Expert",
  level: 5,
  keywords: ["C#", "C++", "Python"],
};

const standaloneSkill: SkillItem = {
  id: "019bef5a-93e4-7746-ad39-5a52dcf50ed4",
  hidden: false,
  icon: "code",
  name: "Unity Engine",
  proficiency: "Expert",
  level: 5,
  keywords: [],
};

describe("deriveSkillKeywordId", () => {
  it("returns a stable UUID for the same parent and keyword", () => {
    const id1 = deriveSkillKeywordId(parentId, "C#");
    const id2 = deriveSkillKeywordId(parentId, "C#");
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is case-insensitive for keyword normalization", () => {
    expect(deriveSkillKeywordId(parentId, "C#")).toBe(deriveSkillKeywordId(parentId, " c# "));
  });

  it("differs across parent items for the same keyword", () => {
    const otherParent = "019bef5a-93e4-7746-ad39-5e8bb7cacbc8";
    expect(deriveSkillKeywordId(parentId, "C#")).not.toBe(deriveSkillKeywordId(otherParent, "C#"));
  });
});

describe("expandSkillItemsForVerification", () => {
  it("expands keywords into individual verifiable units", () => {
    const units = expandSkillItemsForVerification([categoryWithKeywords]);
    expect(units).toHaveLength(3);
    expect(units[0]).toEqual({
      itemId: deriveSkillKeywordId(parentId, "C#"),
      itemLabel: "C#",
      parentItemId: parentId,
      parentItemLabel: "Programming Languages",
    });
  });

  it("uses item id and name when there are no keywords", () => {
    const units = expandSkillItemsForVerification([standaloneSkill]);
    expect(units).toHaveLength(1);
    expect(units[0]).toEqual({
      itemId: standaloneSkill.id,
      itemLabel: "Unity Engine",
      parentItemId: standaloneSkill.id,
      parentItemLabel: "Unity Engine",
    });
  });

  it("skips hidden items", () => {
    const hidden: SkillItem = { ...categoryWithKeywords, hidden: true };
    expect(expandSkillItemsForVerification([hidden])).toHaveLength(0);
  });

  it("dedupes keywords that normalize to the same value", () => {
    const item: SkillItem = {
      ...categoryWithKeywords,
      keywords: ["C#", " c# ", "C++", ""],
    };

    const units = expandSkillItemsForVerification([item]);
    expect(units).toHaveLength(2);
    expect(units.map((unit) => unit.itemLabel)).toEqual(["C#", "C++"]);
    expect(new Set(units.map((unit) => unit.itemId)).size).toBe(2);
  });
});

describe("findVerifiableSkillUnit", () => {
  it("returns a consistent label when duplicate-normalized keywords exist", () => {
    const item: SkillItem = {
      ...categoryWithKeywords,
      keywords: [" c# ", "C#"],
    };
    const keywordId = deriveSkillKeywordId(parentId, "C#");
    const unit = findVerifiableSkillUnit([item], keywordId);

    expect(unit?.itemLabel).toBe("c#");
  });

  it("resolves a keyword-derived id", () => {
    const keywordId = deriveSkillKeywordId(parentId, "Python");
    const unit = findVerifiableSkillUnit([categoryWithKeywords], keywordId);
    expect(unit?.itemLabel).toBe("Python");
  });

  it("rejects a parent id when keywords exist", () => {
    expect(findVerifiableSkillUnit([categoryWithKeywords], parentId)).toBeUndefined();
  });
});

describe("findSkillCategoryForVerificationId", () => {
  it("returns parent and skill labels", () => {
    const keywordId = deriveSkillKeywordId(parentId, "C++");
    expect(findSkillCategoryForVerificationId([categoryWithKeywords], keywordId)).toEqual({
      parentItemLabel: "Programming Languages",
      itemLabel: "C++",
    });
  });
});

describe("normalizeSkillLabel", () => {
  it("trims and lowercases", () => {
    expect(normalizeSkillLabel("  JavaScript ")).toBe("javascript");
  });
});

describe("normalizeReviewerSkills", () => {
  it("trims, dedupes case-insensitively, and drops empty values", () => {
    expect(normalizeReviewerSkills([" C# ", "c#", "", "Python"])).toEqual(["C#", "Python"]);
  });

  it("canonicalizes aliases and dedupes equivalent skills", () => {
    expect(normalizeReviewerSkills(["js", "JavaScript", "Javascript"])).toEqual(["JavaScript"]);
  });
});

describe("reviewerCanReviewSkill", () => {
  it("matches assigned skills case-insensitively", () => {
    expect(reviewerCanReviewSkill(["C#", "Python"], "c#")).toBe(true);
    expect(reviewerCanReviewSkill(["C#"], "JavaScript")).toBe(false);
  });

  it("matches alias and spelling variants", () => {
    expect(reviewerCanReviewSkill(["JavaScript"], "Javascript")).toBe(true);
    expect(reviewerCanReviewSkill(["JavaScript"], "JS")).toBe(true);
    expect(reviewerCanReviewSkill(["Node.js"], "Nodejs")).toBe(true);
    expect(reviewerCanReviewSkill(["TypeScript"], "TS")).toBe(true);
  });

  it("matches legacy custom skills by normalized key", () => {
    expect(reviewerCanReviewSkill(["LegacySkill"], "legacyskill")).toBe(true);
  });

  it("matches compound JavaScript labels", () => {
    expect(reviewerCanReviewSkill(["JavaScript"], "JavaScript ES6/ES7")).toBe(true);
    expect(reviewerCanReviewSkill(["JavaScript"], "JS (ES6+)")).toBe(true);
  });

  it("does not match React Native to React-only assignment", () => {
    expect(reviewerCanReviewSkill(["React"], "React Native")).toBe(false);
  });

  it("does not match Java to JavaScript assignment", () => {
    expect(reviewerCanReviewSkill(["JavaScript"], "Java")).toBe(false);
  });

  it("matches verification screenshot skill labels", () => {
    expect(reviewerCanReviewSkill(["Flutter & Dart"], "Flutter & Dart")).toBe(true);
    expect(reviewerCanReviewSkill(["AI Chatbot Development"], "AI Chatbot Development")).toBe(true);
    expect(reviewerCanReviewSkill(["Product Management"], "Product Management")).toBe(true);
    expect(reviewerCanReviewSkill(["Strategic Planning"], "Strategic Planning")).toBe(true);
    expect(reviewerCanReviewSkill(["Business Development"], "Business Development")).toBe(true);
    expect(reviewerCanReviewSkill(["REST API Integration"], "REST API Integration")).toBe(true);
    expect(reviewerCanReviewSkill(["REST APIs"], "REST API Integration")).toBe(true);
    expect(reviewerCanReviewSkill(["CI/CD Pipelines"], "CI/CD Pipelines")).toBe(true);
    expect(reviewerCanReviewSkill(["CI/CD"], "CI/CD Pipelines")).toBe(true);
  });
});
