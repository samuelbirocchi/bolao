# Investigation: Game 81 odds mismatch

**Date:** 2026-07-01
**Status:** resolved
**Triggered by:** User report that game 81 had no synced odds and that `Bosnia-Herzegovina` might not match the odds provider
**Scope:** WC2026 game 81, ESPN schedule ingestion, The Odds API event matching, and odds snapshot generation

## Symptom
Expected game 81 (`United States` vs `Bosnia-Herzegovina`) to receive an odds snapshot, got no matched snapshot. Running `buildOddsSnapshots` with the live ESPN game and live The Odds API events returned `matchedCount: 0`, listed game 81 in `unmatchedMatches`, and listed the same-kickoff `USA` vs `Bosnia & Herzegovina` event in `unmatchedEvents`.

## Hypotheses considered
| #  | Hypothesis | Verdict   | Evidence (1 line) |
|----|------------|-----------|-------------------|
| H1 | `Bosnia-Herzegovina` lacks a normalization alias | confirmed | The two forms canonicalize to `bosnia herzegovina` and `bosnia and herzegovina`, so equality fails. |
| H2 | Game 81 has placeholder or stale team data | disproven | Live ESPN data identifies active teams as `United States` and `Bosnia-Herzegovina`. |
| H3 | The odds provider has no game 81 market | disproven | The live API returned event `9eeb4876001f5a52ce3c3641bd5f1f2f` with valid H2H markets from 23 bookmakers. |
| H4 | Kickoff/date matching rejects the event | disproven | ESPN and the odds event both start at `2026-07-02T00:00Z`, inside the 24-hour matcher window. |
| H5 | Odds matched but snapshot persistence failed | disproven | The pure matcher returns zero snapshots before any database persistence is attempted. |

## Evidence
Live ESPN data for game 81 returned `United States` vs `Bosnia-Herzegovina` at `2026-07-02T00:00Z`. Live The Odds API data returned event `9eeb4876001f5a52ce3c3641bd5f1f2f`, `USA` vs `Bosnia & Herzegovina`, at `2026-07-02T00:00:00Z`, with valid H2H outcomes. The existing `USA` alias resolves correctly. In `src/lib/teamFlags.ts`, punctuation normalization converts the ESPN away name to `bosnia herzegovina`, while `&` becomes `and`, converting the provider away name to the canonical `bosnia and herzegovina`. `src/lib/odds.ts` requires exact canonical-name equality, so the event is rejected before probability aggregation or persistence.

## Root cause
The shared team-name alias map does not include the hyphenated `Bosnia-Herzegovina` form. Because the normalizer removes a hyphen as whitespace but expands an ampersand to `and`, ESPN and The Odds API produce different canonical strings for the same team. This prevents `findMatchingEvent` from selecting the valid same-kickoff event and leaves game 81 without an odds snapshot.

## Proposed solution
Add `bosnia-herzegovina` to the aliases for canonical `bosnia and herzegovina` in `src/lib/teamFlags.ts`, and add an odds-matching regression test using the exact live `United States`/`Bosnia-Herzegovina` and `USA`/`Bosnia & Herzegovina` pair. This fixes both event selection and bookmaker outcome selection through the existing shared canonicalization path.

## Risks & alternatives
The alias is narrow and maps an unambiguous country name, so collision risk is negligible. Changing general punctuation normalization to treat every hyphen as `and` would be incorrect for other team names. Adding special logic only in the odds matcher would duplicate canonicalization and leave flag/team matching inconsistent. Rollback is removal of the single alias and regression test.

## Follow-ups / out of scope
- Production must run the odds sync once after the code is deployed to create the missing snapshot for game 81.
