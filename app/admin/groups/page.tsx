import Link from "next/link";
import { requireGlobalAdmin } from "@/lib/auth";
import { getAdminGroups } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/server";

export default async function AdminGroupsPage() {
  await requireGlobalAdmin();
  const [groups, t] = await Promise.all([getAdminGroups(), getDictionary()]);

  return (
    <main className="page">
      <div className="row page-title">
        <div>
          <h1>{t.adminGroups.title}</h1>
          <p>{t.adminGroups.description}</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="empty">{t.adminGroups.noGroups}</div>
      ) : (
        <section className="match-list">
          {groups.map((group) => (
            <article className="match-card" key={group.id}>
              <div className="row">
                <Link href={`/admin/groups/${group.id}`}>{group.name}</Link>
                <span className="muted">
                  {group.member_count} {t.adminGroups.members}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
