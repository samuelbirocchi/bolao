import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";
import { SetupNotice } from "@/components/SetupNotice";

export default async function GroupsPage() {
  const { user } = await requireUser();
  const [groups, t] = await Promise.all([getMyGroups(user.id), getDictionary()]);

  return (
    <main className="page">
      <SetupNotice />
      <div className="row page-title">
        <div>
          <h1>{t.groups.title}</h1>
          <p>{t.groups.description}</p>
        </div>
        <Link className="button" href="/groups/new">
          {t.groups.newGroup}
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="empty">{t.groups.empty}</div>
      ) : (
        <section className="grid two">
          {groups.map((group) => (
            <article className="card stack" key={group.id}>
              <div>
                <h2>{group.name}</h2>
                <p className="muted">
                  {t.groups.role}: {group.role}
                </p>
              </div>
              {group.invite_code ? (
                <p className="muted">
                  {t.groups.inviteCode}: {group.invite_code}
                </p>
              ) : null}
              <Link className="button" href={`/groups/${group.id}`}>
                {t.groups.openGroup}
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
