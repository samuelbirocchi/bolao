import { joinGroupAction, signInWithEmail, signInWithPasswordAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

type JoinPageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ message?: string }>;
};

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
  const [{ user }, { code }, queryParams, t] = await Promise.all([
    getCurrentUser(),
    params,
    searchParams,
    getDictionary(),
  ]);

  const inviteCode = code.toUpperCase();

  if (!user) {
    return (
      <main className="page">
        <div className="grid two">
          <section className="page-title">
            <h1>{t.joinGroup.title}</h1>
            <p>{t.joinGroup.signInPrompt}</p>
          </section>

          <div className="stack">
            <form className="card form-grid" action={signInWithPasswordAction}>
              <h2>{t.login.passwordTitle}</h2>
              {queryParams.message ? <div className="notice">{queryParams.message}</div> : null}
              <input type="hidden" name="inviteCode" value={inviteCode} />
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
              <input type="hidden" name="inviteCode" value={inviteCode} />
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

  return (
    <main className="page">
      <div className="grid two">
        <section className="page-title">
          <h1>{t.joinGroup.title}</h1>
          <p>{t.joinGroup.description}</p>
        </section>

        <form className="card form-grid" action={joinGroupAction}>
          <label>
            {t.joinGroup.code}
            <input name="code" defaultValue={inviteCode} required />
          </label>
          <button type="submit">{t.joinGroup.submit}</button>
        </form>
      </div>
    </main>
  );
}
