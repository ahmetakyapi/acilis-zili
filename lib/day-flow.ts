/** Serializable day-flow contract, shared by the server and interactive rail. */
export type FlowStatus = "scheduled" | "released" | "analyzed";
export type FlowMember = {
  symbol: string;
  logoUrl: string | null;
  watched: boolean;
  status: FlowStatus;
  href: string;
  eps?: string;
  revenue?: string;
};
export type FlowEvent = {
  id: string;
  timeEt: string | null;
  scheduledAt: string | null;
  title: string;
  kind: "event" | "earnings";
  importance: "high" | "medium" | "low";
  status: FlowStatus | "partial";
  approx?: boolean;
  detail?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  href: string;
  source: string;
  updatedAt: string;
  members?: FlowMember[];
};
export type DayFlowSnapshot = {
  dateEt: string;
  asOf: string;
  events: FlowEvent[];
  initialNowMinutes: number;
  tradingDay: boolean;
  closeMinutes: number;
  offsets: { primary: number; secondary: number };
  tags: { primary: string; secondary: string };
  pollAfterMs: number;
  sourceDelayed: boolean;
};

export function hasActual(value: string | number | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "string" && value.trim() !== "" && !/^(?:[-—–.]|n\/?a|nan|null)$/i.test(value.trim());
}

export function earningsStatus(eps: number | null, revenue: number | null, analysisExists: boolean): FlowStatus {
  if (analysisExists) return "analyzed";
  return hasActual(eps) || hasActual(revenue) ? "released" : "scheduled";
}

export function groupStatus(members: Pick<FlowMember, "status">[]): FlowEvent["status"] {
  if (members.length && members.every((member) => member.status === "analyzed")) return "analyzed";
  if (members.length && members.every((member) => member.status !== "scheduled")) return "released";
  if (members.some((member) => member.status !== "scheduled")) return "partial";
  return "scheduled";
}

/** Passing the scheduled time is never evidence that results were released. */
export function displayFlowStatus(event: Pick<FlowEvent, "status" | "scheduledAt">, nowMs: number) {
  if (event.status !== "scheduled") return event.status;
  return event.scheduledAt && new Date(event.scheduledAt).getTime() <= nowMs ? "awaiting" : "scheduled";
}

/** A revision of an older observation must not masquerade as today's release. */
export function isNewObservation(currentDate: string | undefined, previousDate: string | undefined) {
  return !!currentDate && !!previousDate && currentDate > previousDate;
}

/** Result identity excludes provider check timestamps, avoiding false alerts. */
export function flowResultSignature(events: FlowEvent[]) {
  return JSON.stringify(events.map(({ id, title, status, actual, forecast, previous, members }) =>
    ({ id, title, status, actual, forecast, previous, members })));
}

/**
 * A temporary provider gap does not un-publish a confirmed numeric result.
 * New values and calendar corrections still win; analysis URLs always come
 * from the latest database snapshot so withdrawn reports cannot stay linked.
 */
export function preserveConfirmedResults(previous: DayFlowSnapshot, next: DayFlowSnapshot): DayFlowSnapshot {
  if (previous.dateEt !== next.dateEt) return next;
  let retained = false;
  // Pencere sağlayıcıdan gelir: kesintide amc → unknown'a dönebilir.
  // Sonucun kimliği saat grubu değil, aynı ET günündeki şirkettir.
  const previousMembers = new Map(previous.events.flatMap((event) =>
    (event.members ?? []).map((member) => [member.symbol, member] as const)));
  const events = next.events.map((event) => {
    const old = previous.events.find((item) => item.id === event.id);
    if (event.kind === "event" && old && !hasActual(event.actual) && hasActual(old.actual)) {
      retained = true;
      return { ...event, actual: old.actual, previous: event.previous ?? old.previous, status: "released" as const, source: old.source, updatedAt: old.updatedAt };
    }
    if (!event.members) return event;
    const members = event.members.map((member) => {
      const oldMember = previousMembers.get(member.symbol);
      if (!oldMember) return member;
      // Her sayı bağımsız korunur. Analiz hâlâ yayımlanmışken veya yalnız
      // gelir gelmişken kaybolan EPS de geçici bir sağlayıcı boşluğudur.
      const restoreEps = !hasActual(member.eps) && hasActual(oldMember.eps);
      const restoreRevenue = !hasActual(member.revenue) && hasActual(oldMember.revenue);
      if (!restoreEps && !restoreRevenue) return member;
      retained = true;
      return {
        ...member,
        eps: restoreEps ? oldMember.eps : member.eps,
        revenue: restoreRevenue ? oldMember.revenue : member.revenue,
        // Yalnız sayıları sakla; yayından kalkan analizin bağlantısı ve
        // analyzed durumu önceki snapshot'tan asla geri taşınmaz.
        status: member.status === "analyzed" ? "analyzed" as const : "released" as const,
      };
    });
    return { ...event, members, status: groupStatus(members) };
  });
  return { ...next, events, sourceDelayed: next.sourceDelayed || retained };
}
