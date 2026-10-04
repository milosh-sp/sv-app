// @vitest-environment node
import type { SQL } from "drizzle-orm";

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const wheres = vi.hoisted(() => ({ value: [] as SQL[] }));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (clause: SQL) => {
          wheres.value.push(clause);
          return { getSQL: () => clause };
        },
      }),
    }),
  },
}));

import {
  hasVerifiedIdentityExists,
  hasVerifiedSkillExperienceOrProjectExists,
  vettedEmployerVisibilityConditions,
} from "./company-vetted-pool";

const dialect = new PgDialect();

function queryOf(value: SQL) {
  return dialect.sqlToQuery(value);
}

describe("vetted employer visibility", () => {
  beforeEach(() => {
    wheres.value = [];
  });

  it("requires a public resume, verified identity, and a verified skill, experience, or project", () => {
    const [isPublic, identity, verifiedItem] = vettedEmployerVisibilityConditions();

    expect(queryOf(isPublic!).sql).toContain('"is_public"');
    expect(queryOf(identity!).sql).toContain("exists");
    expect(queryOf(verifiedItem!).sql).toContain("exists");
    expect(wheres.value).toHaveLength(2);
    expect(queryOf(wheres.value[0]!).params).toEqual(expect.arrayContaining(["identity", "verified"]));
    expect(queryOf(wheres.value[1]!).params).toEqual(
      expect.arrayContaining(["skill", "experience", "project", "verified"]),
    );

    wheres.value = [];
    expect(queryOf(hasVerifiedIdentityExists()).params).toContain("identity");
    expect(queryOf(hasVerifiedSkillExperienceOrProjectExists()).params).toEqual(
      expect.arrayContaining(["skill", "experience", "project"]),
    );
  });
});
