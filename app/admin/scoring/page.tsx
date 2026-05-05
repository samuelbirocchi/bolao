import { updateScoringSettingsAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getScoringSettings } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

export default async function AdminScoringPage() {
  await requireGlobalAdmin();
  const [scoring, t] = await Promise.all([getScoringSettings(), getDictionary()]);

  return (
    <main className="page">
      <div className="page-title">
        <h1>{t.adminScoring.title}</h1>
        <p>{t.adminScoring.description}</p>
      </div>

      <form className="card form-grid" action={updateScoringSettingsAction}>
        <label>
          {t.adminScoring.exactScore}
          <input
            defaultValue={scoring.exactScorePoints}
            min={0}
            name="exactScorePoints"
            required
            type="number"
          />
        </label>
        <label>
          {t.adminScoring.teamGoal}
          <input
            defaultValue={scoring.teamGoalPoints}
            min={0}
            name="teamGoalPoints"
            required
            type="number"
          />
        </label>
        <label>
          {t.adminScoring.outcome}
          <input
            defaultValue={scoring.outcomePoints}
            min={0}
            name="outcomePoints"
            required
            type="number"
          />
        </label>
        <button type="submit">{t.adminScoring.submit}</button>
      </form>
    </main>
  );
}
