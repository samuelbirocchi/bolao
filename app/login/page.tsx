import { signInWithEmail, signInWithPasswordAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { user } = await getCurrentUser();
  const [params, t] = await Promise.all([searchParams, getDictionary()]);

  if (user) {
    redirect("/groups");
  }

  return (
    <main className="page">
      <div className="grid two">
        <section className="page-title">
          <h1>{t.login.title}</h1>
          <p>{t.login.description}</p>
        </section>

        <div className="stack">
          <form className="card form-grid" action={signInWithPasswordAction}>
            <h2>{t.login.passwordTitle}</h2>
            {params.message ? <div className="notice">{params.message}</div> : null}
            <label>
              {t.login.email}
              <input name="email" type="email" placeholder="you@example.com" required />
            </label>
            <label>
              {t.login.password}
              <input name="password" type="password" required />
            </label>
            <button type="submit">{t.login.submit}</button>
          </form>

          <form className="card form-grid" action={signInWithEmail}>
            <h2>{t.login.setupTitle}</h2>
            <p className="muted">{t.login.setupDescription}</p>
            <label>
              {t.login.email}
              <input name="email" type="email" placeholder="you@example.com" required />
            </label>
            <button className="secondary" type="submit">
              {t.login.setupSubmit}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
