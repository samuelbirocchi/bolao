import { redirect } from "next/navigation";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  display_name: string | null;
  is_global_admin: boolean;
};

export async function getCurrentUser() {
  if (!hasSupabaseEnv()) {
    return { user: null, profile: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, is_global_admin")
    .eq("id", user.id)
    .single();

  return { user, profile: profile as CurrentProfile | null };
}

export async function requireUser() {
  const { user, profile } = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return { user, profile };
}

export async function requireGlobalAdmin() {
  const { user, profile } = await requireUser();

  if (!profile?.is_global_admin) {
    redirect("/groups");
  }

  return { user, profile };
}
