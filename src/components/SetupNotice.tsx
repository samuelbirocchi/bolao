import { hasSupabaseEnv } from "@/lib/supabase/server";

export function SetupNotice() {
  if (hasSupabaseEnv()) {
    return null;
  }

  return (
    <div className="notice">
      Supabase is not configured yet. Copy <strong>.env.example</strong> to{" "}
      <strong>.env.local</strong>, add the Supabase URL and anon key, then run the SQL migration.
    </div>
  );
}
