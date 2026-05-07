import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { getDictionary } from "@/lib/i18n/server";

export default async function HomePage() {
  const t = await getDictionary();

  return (
    <main className="page">
      <SetupNotice />
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow">{t.home.lockedTitle}</span>
          <h1>{t.home.title}</h1>
          <p>{t.home.description}</p>
          <div className="hero-actions">
            <Link className="button" href="/login">
              {t.home.startPool}
            </Link>
            <Link className="button secondary" href="/groups">
              {t.home.viewGroups}
            </Link>
          </div>
        </div>
        <div className="hero-scorecard" aria-hidden="true">
          <div className="scorecard-topline">
            <span>Final</span>
            <span>90&apos;</span>
          </div>
          <div className="scorecard-match">
            <span>BRA</span>
            <strong>2</strong>
            <span className="scorecard-versus">×</span>
            <strong>1</strong>
            <span>ARG</span>
          </div>
          <div className="scorecard-meter">
            <span />
          </div>
          <div className="scorecard-picks">
            <span>Exact +6</span>
            <span>Winner +3</span>
            <span>Streak +2</span>
          </div>
        </div>
      </section>

      <section className="grid three feature-grid">
        <div className="card feature-card">
          <span className="feature-icon" aria-hidden="true">
            ✦
          </span>
          <h2>{t.home.inviteTitle}</h2>
          <p className="muted">{t.home.inviteDescription}</p>
        </div>
        <div className="card feature-card">
          <span className="feature-icon" aria-hidden="true">
            ⚡
          </span>
          <h2>{t.home.lockedTitle}</h2>
          <p className="muted">{t.home.lockedDescription}</p>
        </div>
        <div className="card feature-card">
          <span className="feature-icon" aria-hidden="true">
            ◈
          </span>
          <h2>{t.home.scoringTitle}</h2>
          <p className="muted">{t.home.scoringDescription}</p>
        </div>
      </section>
    </main>
  );
}
