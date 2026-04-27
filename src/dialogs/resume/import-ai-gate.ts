export type AiAssistedImportGateState =
  | { status: "ready" }
  | { status: "waiting_for_availability" }
  | { status: "ai_disabled" };

const AI_ASSISTED_TYPES = new Set(["pdf", "docx"]);

function needsAiAssistance(importType: string): boolean {
  return AI_ASSISTED_TYPES.has(importType);
}

export function getAiAssistedImportGateState(
  importType: string,
  isAvailabilityLoaded: boolean,
  canUse: boolean,
): AiAssistedImportGateState {
  if (!needsAiAssistance(importType)) {
    return { status: "ready" };
  }

  if (!isAvailabilityLoaded) {
    return { status: "waiting_for_availability" };
  }

  if (!canUse) {
    return { status: "ai_disabled" };
  }

  return { status: "ready" };
}
