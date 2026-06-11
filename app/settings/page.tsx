import { UserAvatar } from "@/components/UserAvatar";
import { createPasswordAction, removeAvatarAction, updateProfileAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { safeInternalRedirectPath } from "@/lib/authForms";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/server";

type SettingsPageProps = {
  searchParams: Promise<{ message?: string; next?: string; setupPassword?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { user } = await requireUser();
  const [queryParams, t] = await Promise.all([searchParams, getDictionary()]);

  let displayName = "";
  let avatarUrl: string | null = null;
  let passwordSetAt: string | null = null;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, password_set_at")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? "";
    avatarUrl = profile?.avatar_url ?? null;
    passwordSetAt = profile?.password_set_at ?? null;
  }

  const showPasswordSetup = queryParams.setupPassword === "1" || !passwordSetAt;
  const nextPath = safeInternalRedirectPath(queryParams.next ?? "/groups");

  return (
    <main className="page">
      <div className="page-title">
        <h1>{t.settings.title}</h1>
        <p>{t.settings.description}</p>
      </div>

      <div className="stack" style={{ maxWidth: "32rem" }}>
        {showPasswordSetup ? (
          <form className="card form-grid" action={createPasswordAction}>
            <h2>{t.settings.passwordTitle}</h2>
            {queryParams.message ? <div className="notice">{queryParams.message}</div> : null}
            <p className="muted">{t.settings.passwordDescription}</p>
            <input type="hidden" name="next" value={nextPath} />
            <label>
              {t.settings.passwordLabel}
              <input minLength={8} name="password" required type="password" />
            </label>
            <label>
              {t.settings.confirmPasswordLabel}
              <input minLength={8} name="confirmPassword" required type="password" />
            </label>
            <button type="submit">{t.settings.passwordSubmit}</button>
          </form>
        ) : null}

        <section className="card stack" aria-label={t.settings.currentAvatar}>
          <span className="muted">{t.settings.currentAvatar}</span>
          <UserAvatar name={displayName || null} seed={user.id} size={88} url={avatarUrl} />
        </section>

        <form className="card form-grid" action={updateProfileAction}>
          <label>
            {t.settings.displayNameLabel}
            <input
              defaultValue={displayName}
              maxLength={80}
              name="displayName"
              required
              type="text"
            />
          </label>
          <label>
            {t.settings.avatarUrlLabel}
            <input
              defaultValue={avatarUrl ?? ""}
              name="avatarUrl"
              placeholder={t.settings.avatarUrlPlaceholder}
              type="url"
            />
            <span className="muted" style={{ fontWeight: 400 }}>
              {t.settings.avatarUrlHint}
            </span>
          </label>
          <label>
            {t.settings.avatarFileLabel}
            <input accept="image/*" name="avatarFile" type="file" />
            <span className="muted" style={{ fontWeight: 400 }}>
              {t.settings.avatarFileHint}
            </span>
          </label>
          <button type="submit">{t.settings.save}</button>
        </form>

        {avatarUrl ? (
          <form action={removeAvatarAction}>
            <button className="secondary" type="submit">
              {t.settings.removeAvatar}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
