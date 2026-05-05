import { signInWithEmail } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { user } = await getCurrentUser();
  const params = await searchParams;

  if (user) {
    redirect("/groups");
  }

  return (
    <main className="page">
      <div className="grid two">
        <section className="page-title">
          <h1>Sign in</h1>
          <p>Use a magic link to access your World Cup pools.</p>
        </section>

        <form className="card form-grid" action={signInWithEmail}>
          {params.message ? <div className="notice">{params.message}</div> : null}
          <label>
            Email
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <button type="submit">Send magic link</button>
        </form>
      </div>
    </main>
  );
}
