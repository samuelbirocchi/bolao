export function formatKickoff(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function displayName(name: string | null, fallback: string) {
  return name && name.trim().length > 0 ? name : fallback;
}
