-- Issue #44: the "última atualização do ranking" timestamp reads
-- max(match_results.updated_at). match_results was created in 001 with an
-- updated_at column defaulting to now() on insert, but (unlike matches and
-- predictions) it never got a set_updated_at trigger. Because recordMatchResult
-- upserts match_results, an in-place correction to a score updates the row
-- without bumping updated_at, leaving the displayed timestamp stale.
-- Add the missing trigger so updated_at tracks recalculations, not just inserts.

create trigger match_results_set_updated_at
before update on public.match_results
for each row execute function public.set_updated_at();
