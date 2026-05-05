import { joinGroupAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

type JoinPageProps = {
  params: Promise<{ code: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  await requireUser();
  const { code } = await params;

  return (
    <main className="page">
      <div className="grid two">
        <section className="page-title">
          <h1>Join group</h1>
          <p>Confirm the invite code to enter this World Cup pool.</p>
        </section>

        <form className="card form-grid" action={joinGroupAction}>
          <label>
            Invite code
            <input name="code" defaultValue={code.toUpperCase()} required />
          </label>
          <button type="submit">Join group</button>
        </form>
      </div>
    </main>
  );
}
