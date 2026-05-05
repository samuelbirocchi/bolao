import { joinGroupAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

type JoinPageProps = {
  params: Promise<{ code: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const [, { code }, t] = await Promise.all([requireUser(), params, getDictionary()]);

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
            <input name="code" defaultValue={code.toUpperCase()} required />
          </label>
          <button type="submit">{t.joinGroup.submit}</button>
        </form>
      </div>
    </main>
  );
}
