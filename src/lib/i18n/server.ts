import { cookies } from "next/headers";
import { LOCALE_COOKIE, defaultLocale, dictionaries, isLocale } from "@/lib/i18n";

export async function getLocale() {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}

export async function getDictionary() {
  return dictionaries[await getLocale()];
}
