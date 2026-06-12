export const SAVE_FEEDBACK_PARAM = "saved";

export const saveFeedbackTargets = ["predictions", "profile"] as const;

export type SaveFeedbackTarget = (typeof saveFeedbackTargets)[number];

export function hasSaveFeedback(value: string | undefined, target: SaveFeedbackTarget) {
  return value === target;
}

export function pathWithSaveFeedback(path: string, target: SaveFeedbackTarget) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(SAVE_FEEDBACK_PARAM, target);
  return `${url.pathname}${url.search}${url.hash}`;
}
