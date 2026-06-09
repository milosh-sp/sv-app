import { defineRelations } from "drizzle-orm";
import * as pg from "drizzle-orm/pg-core";

import { defaultResumeData, type ResumeData } from "../../schema/resume/data";
import { generateId } from "../../utils/string";

export const user = pg.pgTable(
  "user",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    image: pg.text("image"),
    name: pg.text("name").notNull(),
    email: pg.text("email").notNull().unique(),
    emailVerified: pg.boolean("email_verified").notNull().default(false),
    username: pg.text("username").notNull().unique(),
    displayUsername: pg.text("display_username").notNull().unique(),
    twoFactorEnabled: pg.boolean("two_factor_enabled").notNull().default(false),
    privacyPolicyAcceptedAt: pg.timestamp("privacy_policy_accepted_at", { withTimezone: true }).notNull().defaultNow(),
    privacyPolicyVersion: pg.text("privacy_policy_version"),
    lastActiveAt: pg.timestamp("last_active_at", { withTimezone: true }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.createdAt.asc())],
);

export const session = pg.pgTable(
  "session",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    token: pg.text("token").notNull().unique(),
    ipAddress: pg.text("ip_address"),
    userAgent: pg.text("user_agent"),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.token, t.userId), pg.index().on(t.expiresAt)],
);

export const account = pg.pgTable(
  "account",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    accountId: pg.text("account_id").notNull(),
    providerId: pg.text("provider_id").notNull().default("credential"),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scope: pg.text("scope"),
    idToken: pg.text("id_token"),
    password: pg.text("password"),
    accessToken: pg.text("access_token"),
    refreshToken: pg.text("refresh_token"),
    accessTokenExpiresAt: pg.timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: pg.timestamp("refresh_token_expires_at", { withTimezone: true }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.userId)],
);

export const verification = pg.pgTable(
  "verification",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    identifier: pg.text("identifier").notNull().unique(),
    value: pg.text("value").notNull(),
    expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.identifier)],
);

export const twoFactor = pg.pgTable(
  "two_factor",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    secret: pg.text("secret").notNull(),
    backupCodes: pg.text("backup_codes").notNull(),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.userId), pg.index().on(t.secret)],
);

export const passkey = pg.pgTable(
  "passkey",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: pg.text("name"),
    aaguid: pg.text("aaguid"),
    publicKey: pg.text("public_key").notNull(),
    credentialID: pg.text("credential_id").notNull(),
    counter: pg.integer("counter").notNull(),
    deviceType: pg.text("device_type").notNull(),
    backedUp: pg.boolean("backed_up").notNull().default(false),
    transports: pg.text("transports").notNull(),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.userId)],
);

export const resume = pg.pgTable(
  "resume",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: pg.text("name").notNull(),
    slug: pg.text("slug").notNull(),
    tags: pg.text("tags").array().notNull().default([]),
    isPublic: pg.boolean("is_public").notNull().default(false),
    isLocked: pg.boolean("is_locked").notNull().default(false),
    password: pg.text("password"),
    data: pg
      .jsonb("data")
      .notNull()
      .$type<ResumeData>()
      .$defaultFn(() => defaultResumeData),
    workAuthEuStatus: pg.text("work_auth_eu_status").notNull().default("prefer_not_to_say"),
    workAuthUsaStatus: pg.text("work_auth_usa_status").notNull().default("prefer_not_to_say"),
    workAuthUkStatus: pg.text("work_auth_uk_status").notNull().default("prefer_not_to_say"),
    workAuthEuSponsorshipRequired: pg.text("work_auth_eu_sponsorship_required").notNull().default("unknown"),
    workAuthUsaSponsorshipRequired: pg.text("work_auth_usa_sponsorship_required").notNull().default("unknown"),
    workAuthUkSponsorshipRequired: pg.text("work_auth_uk_sponsorship_required").notNull().default("unknown"),
    workAuthConsentToShare: pg.boolean("work_auth_consent_to_share").notNull().default(false),
    workAuthUpdatedAt: pg.timestamp("work_auth_updated_at", { withTimezone: true }),
    workAuthSearchTokens: pg.text("work_auth_search_tokens").array().notNull().default([]),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [
    pg.unique().on(t.slug, t.userId),
    pg.index().on(t.userId),
    pg.index().on(t.createdAt.asc()),
    pg.index().on(t.userId, t.updatedAt.desc()),
    pg.index().on(t.isPublic, t.slug, t.userId),
    pg.index().on(t.workAuthConsentToShare, t.workAuthEuStatus),
    pg.index().on(t.workAuthConsentToShare, t.workAuthUsaStatus),
    pg.index().on(t.workAuthConsentToShare, t.workAuthUkStatus),
    pg.index().on(t.workAuthConsentToShare, t.workAuthSearchTokens),
    pg.index().on(t.workAuthUpdatedAt),
  ],
);

export const resumeStatistics = pg.pgTable("resume_statistics", {
  id: pg
    .uuid("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => generateId()),
  views: pg.integer("views").notNull().default(0),
  downloads: pg.integer("downloads").notNull().default(0),
  lastViewedAt: pg.timestamp("last_viewed_at", { withTimezone: true }),
  lastDownloadedAt: pg.timestamp("last_downloaded_at", { withTimezone: true }),
  resumeId: pg
    .uuid("resume_id")
    .unique()
    .notNull()
    .references(() => resume.id, { onDelete: "cascade" }),
  createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
});

export const apikey = pg.pgTable(
  "apikey",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: pg.text("name"),
    start: pg.text("start"),
    prefix: pg.text("prefix"),
    key: pg.text("key").notNull(),
    configId: pg.text("config_id").notNull().default("default"),
    referenceId: pg
      .uuid("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refillInterval: pg.integer("refill_interval"),
    refillAmount: pg.integer("refill_amount"),
    lastRefillAt: pg.timestamp("last_refill_at", { withTimezone: true }),
    enabled: pg.boolean("enabled").notNull().default(true),
    rateLimitEnabled: pg.boolean("rate_limit_enabled").notNull().default(false),
    rateLimitTimeWindow: pg.integer("rate_limit_time_window").default(86400000),
    rateLimitMax: pg.integer("rate_limit_max").default(10),
    requestCount: pg.integer("request_count").notNull().default(0),
    remaining: pg.integer("remaining"),
    lastRequest: pg.timestamp("last_request", { withTimezone: true }),
    expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
    permissions: pg.text("permissions"),
    metadata: pg.jsonb("metadata"),
  },
  (t) => [
    pg.index().on(t.referenceId),
    pg.index().on(t.key),
    pg.index().on(t.configId),
    pg.index().on(t.enabled, t.referenceId),
  ],
);

export const jwks = pg.pgTable("jwks", {
  id: pg
    .uuid("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => generateId()),
  publicKey: pg.text("public_key").notNull(),
  privateKey: pg.text("private_key").notNull(),
  createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
});

export const oauthClient = pg.pgTable(
  "oauth_client",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    clientId: pg.text("client_id").notNull().unique(),
    clientSecret: pg.text("client_secret"),
    disabled: pg.boolean("disabled").default(false),
    skipConsent: pg.boolean("skip_consent"),
    enableEndSession: pg.boolean("enable_end_session"),
    subjectType: pg.text("subject_type"),
    scopes: pg.text("scopes").array(),
    userId: pg.uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
    name: pg.text("name"),
    uri: pg.text("uri"),
    icon: pg.text("icon"),
    contacts: pg.text("contacts").array(),
    tos: pg.text("tos"),
    policy: pg.text("policy"),
    softwareId: pg.text("software_id"),
    softwareVersion: pg.text("software_version"),
    softwareStatement: pg.text("software_statement"),
    redirectUris: pg.text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: pg.text("post_logout_redirect_uris").array(),
    tokenEndpointAuthMethod: pg.text("token_endpoint_auth_method"),
    grantTypes: pg.text("grant_types").array(),
    responseTypes: pg.text("response_types").array(),
    public: pg.boolean("public"),
    type: pg.text("type"),
    requirePKCE: pg.boolean("require_pkce"),
    referenceId: pg.text("reference_id"),
    metadata: pg.jsonb("metadata"),
  },
  (t) => [pg.index().on(t.clientId)],
);

export const oauthRefreshToken = pg.pgTable(
  "oauth_refresh_token",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    token: pg.text("token").notNull(),
    clientId: pg
      .text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: pg.uuid("session_id").references(() => session.id, { onDelete: "set null" }),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: pg.text("reference_id"),
    expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).defaultNow(),
    revoked: pg.timestamp("revoked", { withTimezone: true }),
    authTime: pg.timestamp("auth_time", { withTimezone: true }),
    scopes: pg.text("scopes").array().notNull(),
  },
  (t) => [pg.index().on(t.token)],
);

export const oauthAccessToken = pg.pgTable(
  "oauth_access_token",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    token: pg.text("token").notNull().unique(),
    clientId: pg
      .text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: pg.uuid("session_id").references(() => session.id, { onDelete: "set null" }),
    userId: pg.uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: pg.text("reference_id"),
    refreshId: pg.uuid("refresh_id").references(() => oauthRefreshToken.id, { onDelete: "cascade" }),
    expiresAt: pg.timestamp("expires_at", { withTimezone: true }),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).defaultNow(),
    scopes: pg.text("scopes").array().notNull(),
  },
  (t) => [pg.index().on(t.token)],
);

export const oauthConsent = pg.pgTable(
  "oauth_consent",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    clientId: pg
      .text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: pg.uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: pg.text("reference_id"),
    scopes: pg.text("scopes").array().notNull(),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.userId, t.clientId)],
);

// --- Verification Feature Enums ---

export const adminRoleEnum = pg.pgEnum("admin_role", ["skill_verdict_admin", "reviewer_admin"]);

export const verificationSectionTypeEnum = pg.pgEnum("verification_section_type", [
  "skill",
  "experience",
  "project",
  "identity",
]);

export const verificationStatusEnum = pg.pgEnum("verification_status", [
  "pending",
  "claimed",
  "verdict_pending",
  "verified",
  "rejected",
  "issue",
]);

export const verificationMethodEnum = pg.pgEnum("verification_method", [
  "document_upload",
  "freelancer_link",
  "identity_call",
]);

export const changeRequestStatusEnum = pg.pgEnum("change_request_status", ["pending", "approved", "rejected"]);

export const metadataActionEnum = pg.pgEnum("metadata_action", [
  "claimed",
  "verdict_submitted",
  "solution_submitted",
  "verified",
  "rejected",
  "flagged",
  "overridden",
]);

export const documentTypeEnum = pg.pgEnum("document_type", [
  "payslip",
  "contract",
  "freelancer_link",
  "assessment_instructions",
  "assessment_solution",
  "assessment_solution_link",
]);

export const proposedVerdictEnum = pg.pgEnum("proposed_verdict", ["verified", "rejected", "issue"]);

// --- Verification Feature Tables ---

export const adminRoles = pg.pgTable(
  "admin_roles",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: pg
      .uuid("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    role: adminRoleEnum("role").notNull(),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [pg.index().on(t.userId)],
);

/** Singleton row (`id` = `default`) — global AI provider credentials managed by Skill Verdict admins. */
export const globalAiSettings = pg.pgTable("global_ai_settings", {
  id: pg.text("id").primaryKey().default("default"),
  provider: pg.text("provider").notNull(),
  model: pg.text("model").notNull(),
  apiKey: pg.text("api_key").notNull(),
  baseURL: pg.text("base_url").notNull().default(""),
  connectionTestOk: pg.boolean("connection_test_ok").notNull().default(false),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
  updatedByUserId: pg.uuid("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
});

/** Singleton row (`id` = `default`) — RapidAPI JSearch key managed by Skill Verdict admins. */
export const globalJobSearchSettings = pg.pgTable("global_job_search_settings", {
  id: pg.text("id").primaryKey().default("default"),
  apiKey: pg.text("api_key").notNull(),
  connectionTestOk: pg.boolean("connection_test_ok").notNull().default(false),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
  updatedByUserId: pg.uuid("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
});

export const reviewerProfiles = pg.pgTable(
  "reviewer_profiles",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    adminId: pg
      .uuid("admin_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    firstName: pg.text("first_name").notNull(),
    lastName: pg.text("last_name").notNull(),
    title: pg.text("title").notNull(),
    publicProfileUrl: pg.text("public_profile_url").notNull().unique(),
    consentGiven: pg.boolean("consent_given").notNull().default(false),
    consentGivenAt: pg.timestamp("consent_given_at", { withTimezone: true }),
    reviewerSkills: pg.text("reviewer_skills").array().notNull().default([]),
    createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: pg
      .timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  },
  (t) => [pg.index().on(t.adminId)],
);

export const reviewerProfileChangeRequests = pg.pgTable(
  "reviewer_profile_change_requests",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    adminId: pg
      .uuid("admin_id")
      .notNull()
      .references(() => reviewerProfiles.adminId, { onDelete: "cascade" }),
    requestedFirstName: pg.text("requested_first_name"),
    requestedTitle: pg.text("requested_title"),
    status: changeRequestStatusEnum("status").notNull().default("pending"),
    requestedAt: pg.timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: pg.timestamp("resolved_at", { withTimezone: true }),
    resolvedByAdminId: pg.uuid("resolved_by_admin_id"),
    rejectionReason: pg.text("rejection_reason"),
  },
  (t) => [pg.index().on(t.adminId), pg.index().on(t.status)],
);

export const verificationRequests = pg.pgTable(
  "verification_requests",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: pg
      .uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    resumeId: pg.uuid("resume_id").references(() => resume.id, { onDelete: "set null" }),
    sectionType: verificationSectionTypeEnum("section_type").notNull(),
    itemId: pg.uuid("item_id").notNull(),
    itemLabel: pg.text("item_label").notNull(),
    status: verificationStatusEnum("status").notNull().default("pending"),
    method: verificationMethodEnum("method"),
    submittedAt: pg.timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: pg.timestamp("claimed_at", { withTimezone: true }),
    claimedByAdminId: pg.uuid("claimed_by_admin_id"),
    resolvedAt: pg.timestamp("resolved_at", { withTimezone: true }),
    reviewerNote: pg.text("reviewer_note"),
    proposedVerdict: proposedVerdictEnum("proposed_verdict"),
    badgeVisible: pg.boolean("badge_visible").notNull().default(true),
    calendarLinkSentAt: pg.timestamp("calendar_link_sent_at", { withTimezone: true }),
    assessmentAcceptedAt: pg.timestamp("assessment_accepted_at", { withTimezone: true }),
  },
  (t) => [pg.index().on(t.userId), pg.index().on(t.resumeId), pg.index().on(t.status)],
);

export const verificationMetadata = pg.pgTable(
  "verification_metadata",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    verificationRequestId: pg
      .uuid("verification_request_id")
      .notNull()
      .references(() => verificationRequests.id, { onDelete: "cascade" }),
    adminId: pg.uuid("admin_id").notNull(),
    adminRole: adminRoleEnum("admin_role").notNull(),
    action: metadataActionEnum("action").notNull(),
    notes: pg.text("notes"),
    reviewerSnapshotFirstName: pg.text("reviewer_snapshot_first_name"),
    reviewerSnapshotLastName: pg.text("reviewer_snapshot_last_name"),
    reviewerSnapshotTitle: pg.text("reviewer_snapshot_title"),
    reviewerPublicProfileUrl: pg.text("reviewer_public_profile_url"),
    actedAt: pg.timestamp("acted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [pg.index().on(t.verificationRequestId), pg.index().on(t.adminId)],
);

export const verificationDocuments = pg.pgTable(
  "verification_documents",
  {
    id: pg
      .uuid("id")
      .notNull()
      .primaryKey()
      .$defaultFn(() => generateId()),
    verificationRequestId: pg
      .uuid("verification_request_id")
      .notNull()
      .references(() => verificationRequests.id, { onDelete: "cascade" }),
    fileUrl: pg.text("file_url").notNull(),
    documentType: documentTypeEnum("document_type").notNull(),
    uploadedAt: pg.timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [pg.index().on(t.verificationRequestId)],
);

export const resumeVerificationSettings = pg.pgTable("resume_verification_settings", {
  id: pg
    .uuid("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => generateId()),
  resumeId: pg
    .uuid("resume_id")
    .notNull()
    .unique()
    .references(() => resume.id, { onDelete: "cascade" }),
  showTimeline: pg.boolean("show_timeline").notNull().default(false),
  createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: pg
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date()),
});

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    twoFactor,
    passkey,
    resume,
    resumeStatistics,
    apikey,
    jwks,
    oauthClient,
    oauthRefreshToken,
    oauthAccessToken,
    oauthConsent,
    adminRoles,
    globalAiSettings,
    reviewerProfiles,
    reviewerProfileChangeRequests,
    verificationRequests,
    verificationMetadata,
    verificationDocuments,
    resumeVerificationSettings,
  },
  (r) => ({
    user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      twoFactors: r.many.twoFactor(),
      passkeys: r.many.passkey(),
      resumes: r.many.resume(),
      apiKeys: r.many.apikey(),
      oauthClients: r.many.oauthClient(),
      oauthRefreshTokens: r.many.oauthRefreshToken(),
      oauthAccessTokens: r.many.oauthAccessToken(),
      oauthConsents: r.many.oauthConsent(),
      adminRole: r.one.adminRoles({
        from: r.user.id,
        to: r.adminRoles.userId,
      }),
      reviewerProfile: r.one.reviewerProfiles({
        from: r.user.id,
        to: r.reviewerProfiles.adminId,
      }),
      verificationRequests: r.many.verificationRequests({
        from: r.user.id,
        to: r.verificationRequests.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken({
        from: r.session.id,
        to: r.oauthRefreshToken.sessionId,
      }),
      oauthAccessTokens: r.many.oauthAccessToken({
        from: r.session.id,
        to: r.oauthAccessToken.sessionId,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    twoFactor: {
      user: r.one.user({
        from: r.twoFactor.userId,
        to: r.user.id,
      }),
    },
    passkey: {
      user: r.one.user({
        from: r.passkey.userId,
        to: r.user.id,
      }),
    },
    resume: {
      user: r.one.user({
        from: r.resume.userId,
        to: r.user.id,
      }),
      statistics: r.one.resumeStatistics({
        from: r.resume.id,
        to: r.resumeStatistics.resumeId,
      }),
      verificationSettings: r.one.resumeVerificationSettings({
        from: r.resume.id,
        to: r.resumeVerificationSettings.resumeId,
      }),
      verificationRequests: r.many.verificationRequests({
        from: r.resume.id,
        to: r.verificationRequests.resumeId,
      }),
    },
    resumeStatistics: {
      resume: r.one.resume({
        from: r.resumeStatistics.resumeId,
        to: r.resume.id,
      }),
    },
    apikey: {
      user: r.one.user({
        from: r.apikey.referenceId,
        to: r.user.id,
      }),
    },
    oauthClient: {
      user: r.one.user({
        from: r.oauthClient.userId,
        to: r.user.id,
      }),
      oauthRefreshTokens: r.many.oauthRefreshToken({
        from: r.oauthClient.clientId,
        to: r.oauthRefreshToken.clientId,
      }),
      oauthAccessTokens: r.many.oauthAccessToken({
        from: r.oauthClient.clientId,
        to: r.oauthAccessToken.clientId,
      }),
      oauthConsents: r.many.oauthConsent({
        from: r.oauthClient.clientId,
        to: r.oauthConsent.clientId,
      }),
    },
    oauthRefreshToken: {
      user: r.one.user({
        from: r.oauthRefreshToken.userId,
        to: r.user.id,
      }),
      session: r.one.session({
        from: r.oauthRefreshToken.sessionId,
        to: r.session.id,
      }),
    },
    oauthAccessToken: {
      user: r.one.user({
        from: r.oauthAccessToken.userId,
        to: r.user.id,
      }),
      session: r.one.session({
        from: r.oauthAccessToken.sessionId,
        to: r.session.id,
      }),
      refreshToken: r.one.oauthRefreshToken({
        from: r.oauthAccessToken.refreshId,
        to: r.oauthRefreshToken.id,
      }),
    },
    oauthConsent: {
      user: r.one.user({
        from: r.oauthConsent.userId,
        to: r.user.id,
      }),
    },
    adminRoles: {
      user: r.one.user({
        from: r.adminRoles.userId,
        to: r.user.id,
      }),
    },
    globalAiSettings: {
      updatedBy: r.one.user({
        from: r.globalAiSettings.updatedByUserId,
        to: r.user.id,
      }),
    },
    reviewerProfiles: {
      user: r.one.user({
        from: r.reviewerProfiles.adminId,
        to: r.user.id,
      }),
      changeRequests: r.many.reviewerProfileChangeRequests({
        from: r.reviewerProfiles.adminId,
        to: r.reviewerProfileChangeRequests.adminId,
      }),
    },
    reviewerProfileChangeRequests: {
      reviewerProfile: r.one.reviewerProfiles({
        from: r.reviewerProfileChangeRequests.adminId,
        to: r.reviewerProfiles.adminId,
      }),
    },
    verificationRequests: {
      user: r.one.user({
        from: r.verificationRequests.userId,
        to: r.user.id,
      }),
      resume: r.one.resume({
        from: r.verificationRequests.resumeId,
        to: r.resume.id,
      }),
      metadata: r.many.verificationMetadata({
        from: r.verificationRequests.id,
        to: r.verificationMetadata.verificationRequestId,
      }),
      documents: r.many.verificationDocuments({
        from: r.verificationRequests.id,
        to: r.verificationDocuments.verificationRequestId,
      }),
    },
    verificationMetadata: {
      verificationRequest: r.one.verificationRequests({
        from: r.verificationMetadata.verificationRequestId,
        to: r.verificationRequests.id,
      }),
    },
    verificationDocuments: {
      verificationRequest: r.one.verificationRequests({
        from: r.verificationDocuments.verificationRequestId,
        to: r.verificationRequests.id,
      }),
    },
    resumeVerificationSettings: {
      resume: r.one.resume({
        from: r.resumeVerificationSettings.resumeId,
        to: r.resume.id,
      }),
    },
  }),
);
