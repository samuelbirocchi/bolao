import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/data";
import { SetupNotice } from "@/components/SetupNotice";

export default async function GroupsPage() {
  const { user } = await requireUser();
  const groups = await getMyGroups(user.id);

  return (
    <main className="page">
      <SetupNotice />
      <div className="row page-title">
        <div>
          <h1>Groups</h1>
          <p>Your private World Cup pools.</p>
        </div>
        <Link className="button" href="/groups/new">
          New group
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="empty">Create a group or join one with an invite link.</div>
      ) : (
        <section className="grid two">
          {groups.map((group) => (
            <article className="card stack" key={group.id}>
              <div>
                <h2>{group.name}</h2>
                <p className="muted">Role: {group.role}</p>
              </div>
              {group.invite_code ? (
                <p className="muted">Invite code: {group.invite_code}</p>
              ) : null}
              <Link className="button" href={`/groups/${group.id}`}>
                Open group
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
