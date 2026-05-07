import assert from "node:assert/strict";
import { test } from "node:test";
import { redeemInviteCode, type SupabaseInviteClient } from "./invites.ts";

type UpsertCall = {
  values: { group_id: string; user_id: string; role: "member" };
  options: { onConflict: string };
};

type LookupCall = {
  code: string;
  revokedAtFilter: null;
};

type FakeSupabaseOptions = {
  invite?: { group_id: string } | null;
  inviteError?: { message: string } | null;
  upsertError?: { message: string } | null;
};

function createFakeSupabase(options: FakeSupabaseOptions) {
  const lookups: LookupCall[] = [];
  const upserts: UpsertCall[] = [];

  const client: SupabaseInviteClient = {
    from(table: "invite_codes" | "group_memberships") {
      if (table === "invite_codes") {
        return {
          select() {
            return {
              eq(_column: string, code: string) {
                return {
                  is(_revokedColumn: string, revokedAtFilter: null) {
                    return {
                      async single() {
                        lookups.push({ code, revokedAtFilter });
                        return {
                          data: options.invite ?? null,
                          error: options.inviteError ?? null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        } as ReturnType<SupabaseInviteClient["from"]>;
      }

      return {
        async upsert(
          values: UpsertCall["values"],
          upsertOptions: UpsertCall["options"],
        ) {
          upserts.push({ values, options: upsertOptions });
          return { error: options.upsertError ?? null };
        },
      } as ReturnType<SupabaseInviteClient["from"]>;
    },
  };

  return { client, lookups, upserts };
}

test("redeemInviteCode upserts membership when invite is active", async () => {
  const { client, lookups, upserts } = createFakeSupabase({
    invite: { group_id: "group-1" },
  });

  const result = await redeemInviteCode(client, "user-1", "abc123");

  assert.deepEqual(result, { ok: true, groupId: "group-1" });
  assert.equal(lookups.length, 1);
  assert.equal(lookups[0].code, "ABC123");
  assert.equal(upserts.length, 1);
  assert.deepEqual(upserts[0].values, {
    group_id: "group-1",
    user_id: "user-1",
    role: "member",
  });
  assert.equal(upserts[0].options.onConflict, "group_id,user_id");
});

test("redeemInviteCode returns not_found when invite lookup errors", async () => {
  const { client, upserts } = createFakeSupabase({
    invite: null,
    inviteError: { message: "no rows" },
  });

  const result = await redeemInviteCode(client, "user-1", "REVOKED");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "not_found");
    assert.match(result.message, /not be found|not be found|not found/i);
  }
  assert.equal(upserts.length, 0);
});

test("redeemInviteCode returns not_found when code is empty", async () => {
  const { client, lookups, upserts } = createFakeSupabase({
    invite: { group_id: "group-1" },
  });

  const result = await redeemInviteCode(client, "user-1", "   ");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "not_found");
  }
  assert.equal(lookups.length, 0);
  assert.equal(upserts.length, 0);
});

test("redeemInviteCode surfaces insert errors", async () => {
  const { client } = createFakeSupabase({
    invite: { group_id: "group-1" },
    upsertError: { message: "row level security policy violated" },
  });

  const result = await redeemInviteCode(client, "user-1", "abc123");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "insert_error");
    assert.equal(result.message, "row level security policy violated");
  }
});
