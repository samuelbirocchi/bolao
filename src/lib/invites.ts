export type RedeemInviteResult =
  | { ok: true; groupId: string }
  | { ok: false; reason: "not_found" | "insert_error"; message: string };

type InviteLookup = {
  data: { group_id: string } | null;
  error: { message: string } | null;
};

type MembershipUpsertResult = {
  error: { message: string } | null;
};

// Structural type that any Supabase server client satisfies. We intentionally
// keep this loose (using `any` returns) because Supabase's generated types are
// deeply generic, and the helper only depends on the runtime shape used here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseInviteClient = { from: (table: string) => any };

export async function redeemInviteCode(
  supabase: SupabaseInviteClient,
  userId: string,
  code: string,
): Promise<RedeemInviteResult> {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    return { ok: false, reason: "not_found", message: "Invite code was not found." };
  }

  const lookup = (await supabase
    .from("invite_codes")
    .select("group_id")
    .eq("code", normalizedCode)
    .is("revoked_at", null)
    .single()) as InviteLookup;

  if (lookup.error || !lookup.data) {
    return { ok: false, reason: "not_found", message: "Invite code was not found." };
  }

  const { group_id: groupId } = lookup.data;

  const upsertResult = (await supabase.from("group_memberships").upsert(
    {
      group_id: groupId,
      user_id: userId,
      role: "member",
    },
    { onConflict: "group_id,user_id" },
  )) as MembershipUpsertResult;

  if (upsertResult.error) {
    return { ok: false, reason: "insert_error", message: upsertResult.error.message };
  }

  return { ok: true, groupId };
}
