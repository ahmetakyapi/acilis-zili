import { cookies } from "next/headers";
import { isPrivacyOn, PRIVACY_COOKIE } from "@/lib/privacy";

/**
 * Tutar gizleme tercihi — sunucuda, istek çerezinden (sözleşme
 * `lib/privacy.ts`). Ayrı dosya: `next/headers` istemci paketine inmesin.
 */
export async function getPrivacy(): Promise<boolean> {
  const store = await cookies();
  return isPrivacyOn(store.get(PRIVACY_COOKIE)?.value);
}
