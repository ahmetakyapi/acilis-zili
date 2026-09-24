import { BriefIssuePage, briefIssueMetadata } from "../../issue";

/** Haftalık bülten sayısı — gövde ve gerekçeler `../../issue.tsx`te. */
export async function generateMetadata(props: PageProps<"/bulten/haftalik/[tarih]">) {
  const { tarih } = await props.params;
  return briefIssueMetadata(tarih, "weekly");
}

export default async function WeeklyBriefIssue(props: PageProps<"/bulten/haftalik/[tarih]">) {
  const { tarih } = await props.params;
  return <BriefIssuePage tarih={tarih} period="weekly" />;
}
