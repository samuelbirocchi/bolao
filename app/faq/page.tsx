import { getScoringSettings } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

type ScoringSettings = Awaited<ReturnType<typeof getScoringSettings>>;

function percentage(value: number) {
  return Math.round(value * 100);
}

function formatRule(text: string, scoring: ScoringSettings) {
  return text
    .replaceAll("{baseMin}", String(scoring.baseMinPoints))
    .replaceAll("{baseMax}", String(scoring.baseMaxPoints))
    .replaceAll("{floor}", String(percentage(scoring.baseFloorProbability)))
    .replaceAll("{ceiling}", String(percentage(scoring.baseCeilingProbability)))
    .replaceAll("{exact}", String(scoring.exactScoreBonusPoints))
    .replaceAll("{winnerGoals}", String(scoring.winnerGoalsBonusPoints))
    .replaceAll("{goalDifference}", String(scoring.goalDifferenceBonusPoints))
    .replaceAll("{loserGoals}", String(scoring.loserGoalsBonusPoints))
    .replaceAll("{rout}", String(scoring.routBonusPoints))
    .replaceAll("{extraTime}", String(scoring.extraTimeBonusPoints))
    .replaceAll("{penalties}", String(scoring.penaltiesBonusPoints));
}

export default async function FaqPage() {
  const [scoring, t] = await Promise.all([getScoringSettings(), getDictionary()]);
  const bonusRules = [
    t.faq.exactScore,
    t.faq.winnerGoals,
    t.faq.goalDifference,
    t.faq.loserGoals,
    t.faq.rout,
    t.faq.extraTime,
    t.faq.penalties,
  ];
  const questions = [
    { question: t.faq.lockQuestion, answer: t.faq.lockAnswer },
    { question: t.faq.resultQuestion, answer: t.faq.resultAnswer },
    { question: t.faq.penaltiesQuestion, answer: t.faq.penaltiesAnswer },
    { question: t.faq.oddsQuestion, answer: t.faq.oddsAnswer },
  ];

  return (
    <main className="page">
      <div className="page-title">
        <p>{t.faq.heroEyebrow}</p>
        <h1>{t.faq.title}</h1>
        <p>{t.faq.description}</p>
      </div>

      <section className="grid two faq-grid" aria-label={t.faq.summaryTitle}>
        <article className="card faq-card">
          <h2>{t.faq.summaryTitle}</h2>
          <p className="muted">{t.faq.summary}</p>
        </article>
        <article className="card faq-card faq-formula">
          <h2>{t.faq.formulaTitle}</h2>
          <p>{t.faq.formula}</p>
        </article>
      </section>

      <section className="grid two faq-grid" aria-label={t.faq.baseTitle}>
        <article className="card faq-card">
          <h2>{t.faq.baseTitle}</h2>
          <p>{formatRule(t.faq.baseBody, scoring)}</p>
          <p className="muted">{formatRule(t.faq.missingOdds, scoring)}</p>
          <p className="muted">{t.faq.wrongWinner}</p>
        </article>

        <article className="card faq-card">
          <h2>{t.faq.bonusTitle}</h2>
          <ul className="rule-list">
            {bonusRules.map((rule) => (
              <li key={rule}>{formatRule(rule, scoring)}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="stack" aria-label={t.faq.detailsTitle}>
        <h2 className="section-heading">{t.faq.detailsTitle}</h2>
        {questions.map((item) => (
          <details className="card faq-detail" key={item.question}>
            <summary>{item.question}</summary>
            <p className="muted">{item.answer}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
