import { getDictionary } from "@/lib/i18n/server";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export async function SetupNotice() {
  if (hasSupabaseEnv()) {
    return null;
  }

  const t = await getDictionary();
  const [beforeEnvExample, afterEnvExample = ""] = t.setupNotice.split(".env.example");
  const [beforeEnvLocal, afterEnvLocal = ""] = afterEnvExample.split(".env.local");

  return (
    <div className="notice">
      {beforeEnvExample}
      <strong>.env.example</strong>
      {beforeEnvLocal}
      <strong>.env.local</strong>
      {afterEnvLocal}
    </div>
  );
}
