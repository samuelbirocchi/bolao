export type MembershipRole = "owner" | "member";

/**
 * Guards against removing a group owner. Owners are never removable via the
 * admin "remove user" flow; throws when the target's role is "owner".
 */
export function assertNotOwner(role: string | null | undefined): void {
  if (role === "owner") {
    throw new Error("Cannot remove a group owner.");
  }
}
