import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/lib/actions";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { LanguageSelector } from "@/components/LanguageSelector";

export async function TopNav() {
  const { user, profile } = await getCurrentUser();
  const [locale, t] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark">B</span>
        <span>Bolao</span>
      </Link>

      <nav className="nav" aria-label={t.nav.ariaLabel}>
        {user ? (
          <>
            <Link href="/groups">{t.nav.groups}</Link>
            {profile?.is_global_admin ? (
              <>
                <Link href="/admin/matches">{t.nav.matches}</Link>
                <Link href="/admin/scoring">{t.nav.scoring}</Link>
              </>
            ) : null}
            <form action={signOut}>
              <button className="secondary" type="submit">
                {t.nav.signOut}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login">{t.nav.signIn}</Link>
        )}
        <Suspense fallback={null}>
          <LanguageSelector currentLocale={locale} label={t.language} />
        </Suspense>
      </nav>
    </header>
  );
}
