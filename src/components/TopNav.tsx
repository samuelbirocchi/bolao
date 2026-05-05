import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/lib/actions";

export async function TopNav() {
  const { user, profile } = await getCurrentUser();

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">B</span>
        <span>Bolao</span>
      </Link>

      <nav className="nav" aria-label="Main navigation">
        {user ? (
          <>
            <Link href="/groups">Groups</Link>
            {profile?.is_global_admin ? (
              <>
                <Link href="/admin/matches">Matches</Link>
                <Link href="/admin/scoring">Scoring</Link>
              </>
            ) : null}
            <form action={signOut}>
              <button className="secondary" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
