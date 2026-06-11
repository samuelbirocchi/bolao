export const PASSWORD_MIN_LENGTH = 8;

const INVITE_CODE_PATTERN = /^[A-Z0-9]{1,32}$/;

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function normalizeInviteCode(value: string) {
  const inviteCode = value.trim().toUpperCase();
  return INVITE_CODE_PATTERN.test(inviteCode) ? inviteCode : "";
}

export function safeInternalRedirectPath(value: string, fallback = "/groups") {
  const path = value.trim();

  if (!path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  return path;
}

export function validatePasswordSetup(
  password: string,
  confirmation: string,
): PasswordValidationResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  if (password !== confirmation) {
    return { ok: false, message: "Passwords do not match." };
  }

  return { ok: true };
}
