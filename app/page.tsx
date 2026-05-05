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
          <h1>{t.home.title}</h1>
          <p>{t.home.description}</p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <Link className="button" href="/login">
              {t.home.startPool}
            </Link>
            <Link className="button secondary" href="/groups">
              {t.home.viewGroups}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid three" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h2>{t.home.inviteTitle}</h2>
          <p className="muted">{t.home.inviteDescription}</p>
        </div>
        <div className="card">
          <h2>{t.home.lockedTitle}</h2>
          <p className="muted">{t.home.lockedDescription}</p>
        </div>
        <div className="card">
          <h2>{t.home.scoringTitle}</h2>
          <p className="muted">{t.home.scoringDescription}</p>
        </div>
      </section>
    </main>
  );
}
