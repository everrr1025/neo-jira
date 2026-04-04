import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, Locale, normalizeLocale } from "@/lib/i18n";

export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LANGUAGE_COOKIE)?.value);
}
