import { NextResponse } from "next/server";
import { normalizeInviteCode } from "@/lib/authForms";
import { redeemInviteCode } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const invite = normalizeInviteCode(requestUrl.searchParams.get("invite") ?? "");

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(error)}`, requestUrl.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?message=Missing auth callback code", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?message=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin),
    );
  }

  const userId = exchangeData.session?.user.id ?? exchangeData.user?.id;

  if (!userId) {
    return NextResponse.redirect(
      new URL(
        `/groups?message=${encodeURIComponent("Could not redeem invite — please try the link again.")}`,
        requestUrl.origin,
      ),
    );
  }

  let nextPath = "/groups";

  if (invite) {
    const result = await redeemInviteCode(supabase, userId, invite);

    if (!result.ok) {
      return NextResponse.redirect(
        new URL(`/groups?message=${encodeURIComponent(result.message)}`, requestUrl.origin),
      );
    }

    nextPath = `/groups/${result.groupId}`;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("password_set_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.password_set_at) {
    const setupParams = new URLSearchParams({
      setupPassword: "1",
      next: nextPath,
    });
    return NextResponse.redirect(new URL(`/settings?${setupParams}`, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(nextPath, requestUrl.origin));
}
