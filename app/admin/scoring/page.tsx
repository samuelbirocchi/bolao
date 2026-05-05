import { updateScoringSettingsAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getScoringSettings } from "@/lib/data";

export default async function AdminScoringPage() {
  await requireGlobalAdmin();
  const scoring = await getScoringSettings();

  return (
    <main className="page">
      <div className="page-title">
        <h1>Scoring</h1>
        <p>Configure the global weights used by every group leaderboard.</p>
      </div>

      <form className="card form-grid" action={updateScoringSettingsAction}>
        <label>
          Exact score points
          <input
            defaultValue={scoring.exactScorePoints}
            min={0}
            name="exactScorePoints"
            required
            type="number"
          />
        </label>
        <label>
          Correct team-goal points
          <input
            defaultValue={scoring.teamGoalPoints}
            min={0}
            name="teamGoalPoints"
            required
            type="number"
          />
        </label>
        <label>
          Correct outcome points
          <input
            defaultValue={scoring.outcomePoints}
            min={0}
            name="outcomePoints"
            required
            type="number"
          />
        </label>
        <button type="submit">Update scoring</button>
      </form>
    </main>
  );
}
