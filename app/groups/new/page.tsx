import { createGroupAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

export default async function NewGroupPage() {
  const [, t] = await Promise.all([requireUser(), getDictionary()]);

  return (
    <main className="page">
      <div className="grid two">
        <section className="page-title">
          <h1>{t.newGroup.title}</h1>
          <p>{t.newGroup.description}</p>
        </section>

        <form className="card form-grid" action={createGroupAction}>
          <label>
            {t.newGroup.name}
            <input name="name" placeholder={t.newGroup.placeholder} required />
          </label>
          <button type="submit">{t.newGroup.submit}</button>
        </form>
      </div>
    </main>
  );
}
