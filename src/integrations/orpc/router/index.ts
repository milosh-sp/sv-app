import { adminAiRouter } from "./admin-ai";
import { adminJobSearchRouter } from "./admin-job-search";
import { adminUsersRouter } from "./admin-users";
import { adminVerificationRouter } from "./admin-verification";
import { aiRouter } from "./ai";
import { authRouter } from "./auth";
import { flagsRouter } from "./flags";
import { jobsRouter } from "./jobs";
import { printerRouter } from "./printer";
import { resumeRouter } from "./resume";
import { adminReviewerProfilesRouter, publicReviewerProfileRouter, reviewerProfileRouter } from "./reviewer-profile";
import { statisticsRouter } from "./statistics";
import { storageRouter } from "./storage";
import { verificationRouter } from "./verification";

export default {
  ai: aiRouter,
  auth: authRouter,
  flags: flagsRouter,
  jobs: jobsRouter,
  printer: printerRouter,
  resume: resumeRouter,
  statistics: statisticsRouter,
  storage: storageRouter,
  verification: verificationRouter,
  admin: {
    ai: adminAiRouter,
    jobSearch: adminJobSearchRouter,
    users: adminUsersRouter,
    reviewerProfiles: adminReviewerProfilesRouter,
    verification: adminVerificationRouter,
  },
  reviewer: {
    profile: reviewerProfileRouter,
    publicProfile: publicReviewerProfileRouter,
  },
};
