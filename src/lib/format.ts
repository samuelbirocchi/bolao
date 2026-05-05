export function displayName(name: string | null, fallback: string) {
  return name && name.trim().length > 0 ? name : fallback;
}
