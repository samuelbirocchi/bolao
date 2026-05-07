export const AVATAR_URL_MAX_LENGTH = 2048;

const AVATAR_PALETTE = [
  "#126b52",
  "#0a4b39",
  "#d5a21a",
  "#af2f2f",
  "#3a6df0",
  "#7b3fc7",
  "#0e7c9b",
  "#c75b1f",
];

export function validateAvatarUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > AVATAR_URL_MAX_LENGTH) {
    throw new Error(`Avatar URL must be at most ${AVATAR_URL_MAX_LENGTH} characters.`);
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Avatar URL must start with http:// or https://.");
  }
  try {
    new URL(trimmed);
  } catch {
    throw new Error("Avatar URL is not a valid URL.");
  }
  return trimmed;
}

export function initialsFor(name: string | null | undefined): string {
  if (!name) {
    return "?";
  }
  const tokens = name
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return "?";
  }
  const first = tokens[0]!.charAt(0);
  const second = tokens.length > 1 ? tokens[tokens.length - 1]!.charAt(0) : "";
  return (first + second).toUpperCase();
}

export function colorForSeed(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index]!;
}
