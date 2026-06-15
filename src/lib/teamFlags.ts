const ENGLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E007F}";
const SCOTLAND_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
const WALES_FLAG = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";

export function normalizeTeamName(name: string | null | undefined) {
  return (name ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const ALIASES: Record<string, string[]> = {
  "bosnia and herzegovina": ["bosnia", "bosnia & herzegovina"],
  "cape verde": ["cabo verde"],
  "congo dr": ["dr congo", "drc", "democratic republic of the congo"],
  "czechia": ["czech republic"],
  "england": ["inglaterra"],
  "france": ["franca", "frança"],
  "germany": ["alemanha"],
  "iran": ["ir iran", "iran islamic republic of"],
  "ivory coast": ["cote d ivoire", "cote divoire", "côte d'ivoire"],
  "netherlands": ["holland", "holanda"],
  "north macedonia": ["macedonia"],
  "saudi arabia": ["saudi"],
  "south korea": ["korea republic", "republic of korea"],
  "turkey": ["turkiye", "türkiye"],
  "united arab emirates": ["uae"],
  "united states": ["usa", "us", "united states of america", "u.s.a."],
};

function aliasesFor(name: string, flag: string): [string, string][] {
  return (ALIASES[name] ?? []).map((alias) => [normalizeTeamName(alias), flag]);
}

const FLAG_BY_TEAM_NAME = new Map(
  [
    ["albania", "🇦🇱"],
    ["algeria", "🇩🇿"],
    ["angola", "🇦🇴"],
    ["argentina", "🇦🇷"],
    ["australia", "🇦🇺"],
    ["austria", "🇦🇹"],
    ["belgium", "🇧🇪"],
    ["bolivia", "🇧🇴"],
    ["bosnia and herzegovina", "🇧🇦"],
    ["brazil", "🇧🇷"],
    ["bulgaria", "🇧🇬"],
    ["burkina faso", "🇧🇫"],
    ["cameroon", "🇨🇲"],
    ["canada", "🇨🇦"],
    ["cape verde", "🇨🇻"],
    ["chile", "🇨🇱"],
    ["china", "🇨🇳"],
    ["colombia", "🇨🇴"],
    ["congo dr", "🇨🇩"],
    ["costa rica", "🇨🇷"],
    ["croatia", "🇭🇷"],
    ["curacao", "🇨🇼"],
    ["czechia", "🇨🇿"],
    ["denmark", "🇩🇰"],
    ["dominican republic", "🇩🇴"],
    ["ecuador", "🇪🇨"],
    ["egypt", "🇪🇬"],
    ["el salvador", "🇸🇻"],
    ["england", ENGLAND_FLAG],
    ["finland", "🇫🇮"],
    ["france", "🇫🇷"],
    ["gabon", "🇬🇦"],
    ["germany", "🇩🇪"],
    ["ghana", "🇬🇭"],
    ["greece", "🇬🇷"],
    ["guatemala", "🇬🇹"],
    ["honduras", "🇭🇳"],
    ["hungary", "🇭🇺"],
    ["iceland", "🇮🇸"],
    ["india", "🇮🇳"],
    ["indonesia", "🇮🇩"],
    ["iran", "🇮🇷"],
    ["iraq", "🇮🇶"],
    ["ireland", "🇮🇪"],
    ["israel", "🇮🇱"],
    ["italy", "🇮🇹"],
    ["ivory coast", "🇨🇮"],
    ["jamaica", "🇯🇲"],
    ["japan", "🇯🇵"],
    ["jordan", "🇯🇴"],
    ["kuwait", "🇰🇼"],
    ["mali", "🇲🇱"],
    ["mexico", "🇲🇽"],
    ["morocco", "🇲🇦"],
    ["netherlands", "🇳🇱"],
    ["new zealand", "🇳🇿"],
    ["nigeria", "🇳🇬"],
    ["north macedonia", "🇲🇰"],
    ["northern ireland", "🇬🇧"],
    ["norway", "🇳🇴"],
    ["oman", "🇴🇲"],
    ["panama", "🇵🇦"],
    ["paraguay", "🇵🇾"],
    ["peru", "🇵🇪"],
    ["poland", "🇵🇱"],
    ["portugal", "🇵🇹"],
    ["qatar", "🇶🇦"],
    ["romania", "🇷🇴"],
    ["saudi arabia", "🇸🇦"],
    ["scotland", SCOTLAND_FLAG],
    ["senegal", "🇸🇳"],
    ["serbia", "🇷🇸"],
    ["slovakia", "🇸🇰"],
    ["slovenia", "🇸🇮"],
    ["south africa", "🇿🇦"],
    ["south korea", "🇰🇷"],
    ["spain", "🇪🇸"],
    ["sweden", "🇸🇪"],
    ["switzerland", "🇨🇭"],
    ["tunisia", "🇹🇳"],
    ["turkey", "🇹🇷"],
    ["ukraine", "🇺🇦"],
    ["united arab emirates", "🇦🇪"],
    ["united states", "🇺🇸"],
    ["uruguay", "🇺🇾"],
    ["uzbekistan", "🇺🇿"],
    ["venezuela", "🇻🇪"],
    ["vietnam", "🇻🇳"],
    ["wales", WALES_FLAG],
  ].flatMap(([name, flag]) => [[name, flag], ...aliasesFor(name, flag)]),
);

const PLACEHOLDER_TEAM_NAMES = new Set([
  "a definir",
  "a determinar",
  "por definir",
  "tbd",
  "to be confirmed",
  "to be decided",
  "to be determined",
]);

const CANONICAL_BY_NORMALIZED = new Map<string, string>();

for (const [canonical, aliasList] of Object.entries(ALIASES)) {
  const normalizedCanonical = normalizeTeamName(canonical);
  CANONICAL_BY_NORMALIZED.set(normalizedCanonical, normalizedCanonical);
  for (const alias of aliasList) {
    CANONICAL_BY_NORMALIZED.set(normalizeTeamName(alias), normalizedCanonical);
  }
}

export function canonicalTeamName(name: string | null | undefined): string {
  const normalized = normalizeTeamName(name);
  return CANONICAL_BY_NORMALIZED.get(normalized) ?? normalized;
}

export function flagForTeamName(name: string | null | undefined) {
  const normalizedName = normalizeTeamName(name);

  if (!normalizedName || PLACEHOLDER_TEAM_NAMES.has(normalizedName)) {
    return null;
  }

  return FLAG_BY_TEAM_NAME.get(normalizedName) ?? null;
}
