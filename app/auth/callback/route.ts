import { NextResponse } from "next/server";
import { redeemInviteCode } from "@/lib/invites";
import { createClient } from "@/lib/supabase/server";

const INVITE_CODE_PATTERN = /^[A-Z0-9]{1,32}$/;

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error_description") ?? requestUrl.searchParams.get("error");
  const rawInvite = requestUrl.searchParams.get("invite")?.toUpperCase() ?? "";
  const invite = INVITE_CODE_PATTERN.test(rawInvite) ? rawInvite : "";

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

  if (!invite) {
    return NextResponse.redirect(new URL("/groups", requestUrl.origin));
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

  const result = await redeemInviteCode(supabase, userId, invite);

  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/groups?message=${encodeURIComponent(result.message)}`, requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(`/groups/${result.groupId}`, requestUrl.origin));
}
