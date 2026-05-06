import { updateScoringSettingsAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getScoringSettings } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

function percentage(value: number) {
  return Math.round(value * 100);
}

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
        <h2>{t.adminScoring.baseScore}</h2>
        <div className="grid two">
          <label>
            {t.adminScoring.minPoints}
            <input
              defaultValue={scoring.baseMinPoints}
              min={0}
              name="baseMinPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.maxPoints}
            <input
              defaultValue={scoring.baseMaxPoints}
              min={0}
              name="baseMaxPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.underdogThreshold}
            <input
              defaultValue={percentage(scoring.baseFloorProbability)}
              max={100}
              min={0}
              name="baseFloorProbability"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.favoriteThreshold}
            <input
              defaultValue={percentage(scoring.baseCeilingProbability)}
              max={100}
              min={0}
              name="baseCeilingProbability"
              required
              type="number"
            />
          </label>
        </div>

        <h2>{t.adminScoring.bonuses}</h2>
        <div className="grid two">
          <label>
            {t.adminScoring.exactScore}
            <input
              defaultValue={scoring.exactScoreBonusPoints}
              min={0}
              name="exactScoreBonusPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.winnerGoals}
            <input
              defaultValue={scoring.winnerGoalsBonusPoints}
              min={0}
              name="winnerGoalsBonusPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.goalDifference}
            <input
              defaultValue={scoring.goalDifferenceBonusPoints}
              min={0}
              name="goalDifferenceBonusPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.loserGoals}
            <input
              defaultValue={scoring.loserGoalsBonusPoints}
              min={0}
              name="loserGoalsBonusPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.rout}
            <input
              defaultValue={scoring.routBonusPoints}
              min={0}
              name="routBonusPoints"
              required
              type="number"
            />
          </label>
        </div>

        <h2>{t.adminScoring.extraTime}</h2>
        <div className="grid two">
          <label>
            {t.adminScoring.extraTimeWin}
            <input
              defaultValue={scoring.extraTimeBonusPoints}
              min={0}
              name="extraTimeBonusPoints"
              required
              type="number"
            />
          </label>
          <label>
            {t.adminScoring.penaltyShootoutWin}
            <input
              defaultValue={scoring.penaltiesBonusPoints}
              min={0}
              name="penaltiesBonusPoints"
              required
              type="number"
            />
          </label>
        </div>

        <button type="submit">{t.adminScoring.submit}</button>
      </form>
    </main>
  );
}
