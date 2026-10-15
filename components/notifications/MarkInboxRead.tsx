"use client";

import { useEffect } from "react";
import { markInboxReadAction } from "@/app/actions/inbox";

/**
 * Sayfa açıldıktan SONRA okundu sayar: sunucu çizimi veriyi değiştirmez
 * (GET'te yan etki yok — önceden yükleme bile okundu saydırırdı). Liste
 * "Yeni" rozetlerini bu açılışta gösterir; sonraki açılışta sönmüş olur.
 */
export function MarkInboxRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markInboxReadAction();
  }, [unread]);
  return null;
}
