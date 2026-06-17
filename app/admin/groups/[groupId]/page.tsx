import { LocalKickoff } from "@/components/LocalKickoff";
import { removeUserFromGroupAction } from "@/lib/actions";
import { requireGlobalAdmin } from "@/lib/auth";
import { getAdminGroupMembers } from "@/lib/data";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export default async function AdminGroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  await requireGlobalAdmin();
  const { groupId } = await params;
  const [members, locale, t] = await Promise.all([
    getAdminGroupMembers(groupId),
    getLocale(),
    getDictionary(),
  ]);

  return (
    <main className="page">
      <div className="row page-title">
        <div>
          <h1>{t.adminGroups.title}</h1>
          <p>{t.adminGroups.description}</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="empty">{t.adminGroups.noMembers}</div>
      ) : (
        <section className="match-list">
          {members.map((member) => (
            <article className="match-card" key={member.user_id}>
              <div className="row">
                <span>{member.display_name ?? member.user_id}</span>
                <span className="muted">
                  {t.adminGroups.joined}: <LocalKickoff iso={member.joined_at} locale={locale} />
                </span>
              </div>
              <div className="row">
                <span className="muted">
                  {t.adminGroups.role}: {member.role}
                </span>
                {member.role === "owner" ? (
                  <span className="muted">{t.adminGroups.cannotRemoveOwner}</span>
                ) : (
                  <form action={removeUserFromGroupAction}>
                    <input name="groupId" type="hidden" value={groupId} />
                    <input name="userId" type="hidden" value={member.user_id} />
                    <button className="secondary" type="submit">
                      {t.adminGroups.remove}
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
