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

export function avatarExtensionForContentType(contentType: string): string {
  if (!contentType) {
    return "image";
  }

  const normalized = contentType.toLowerCase().split(";", 1)[0]?.trim();

  switch (normalized) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "image";
  }
}

export function avatarObjectPath(userId: string, contentType: string, uniqueId = crypto.randomUUID()) {
  // userId is always a Supabase auth UUID, but strip path separators defensively
  // so a malformed value can never write outside the user's own folder.
  const sanitizedUserId = userId.replace(/[/\\]/g, "-");
  if (!sanitizedUserId) {
    throw new Error("userId cannot be empty.");
  }
  return `${sanitizedUserId}/avatar-${uniqueId}.${avatarExtensionForContentType(contentType)}`;
}

export function avatarStoragePathFromPublicUrl(url: string | null | undefined, bucket = "avatars") {
  if (!url) {
    return null;
  }

  try {
    const { pathname } = new URL(url);
    const objectPrefix = `/storage/v1/object/public/${bucket}/`;
    const imagePrefix = `/storage/v1/render/image/public/${bucket}/`;
    const prefix = pathname.startsWith(objectPrefix)
      ? objectPrefix
      : pathname.startsWith(imagePrefix)
        ? imagePrefix
        : null;

    if (!prefix) {
      return null;
    }

    const path = decodeURIComponent(pathname.slice(prefix.length));
    return path || null;
  } catch {
    return null;
  }
}

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

// Build a Gravatar image URL from a stored hash (md5 of the user's email).
// d=404 makes Gravatar return 404 when no avatar exists, so the UI can fall
// back to initials on the image's onError. Returns null for a blank hash.
export function gravatarUrl(hash: string | null | undefined, size = 36): string | null {
  const trimmed = hash?.trim();
  if (!trimmed) {
    return null;
  }
  // Render at 2x for crisp display on retina screens.
  const px = Math.max(1, Math.round(size * 2));
  return `https://www.gravatar.com/avatar/${trimmed}?s=${px}&d=404`;
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
