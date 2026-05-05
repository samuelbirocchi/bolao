import { createGroupAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";

export default async function NewGroupPage() {
  await requireUser();

  return (
    <main className="page">
      <div className="grid two">
        <section className="page-title">
          <h1>New group</h1>
          <p>Create a private pool and share the invite code with friends.</p>
        </section>

        <form className="card form-grid" action={createGroupAction}>
          <label>
            Group name
            <input name="name" placeholder="Saturday crew" required />
          </label>
          <button type="submit">Create group</button>
        </form>
      </div>
    </main>
  );
}
