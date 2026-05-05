import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";

export default function HomePage() {
  return (
    <main className="page">
      <SetupNotice />
      <section className="hero">
        <div className="hero-content">
          <h1>World Cup pools without spreadsheet chaos.</h1>
          <p>
            Create a private group, invite friends, predict every match score, and let the
            leaderboard handle the arguments.
          </p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <Link className="button" href="/login">
              Start a pool
            </Link>
            <Link className="button secondary" href="/groups">
              View groups
            </Link>
          </div>
        </div>
      </section>

      <section className="grid three" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h2>Invite-only groups</h2>
          <p className="muted">Each pool has a private code or link for friends.</p>
        </div>
        <div className="card">
          <h2>Locked predictions</h2>
          <p className="muted">Score bets stay editable until each match kickoff.</p>
        </div>
        <div className="card">
          <h2>Configurable scoring</h2>
          <p className="muted">Global admins can tune exact score, team-goal, and outcome points.</p>
        </div>
      </section>
    </main>
  );
}
