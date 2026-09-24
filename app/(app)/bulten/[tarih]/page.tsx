import { BriefIssuePage, briefIssueMetadata } from "../issue";

/** Günlük bülten sayısı — gövde ve gerekçeler `../issue.tsx`te. */
export async function generateMetadata(props: PageProps<"/bulten/[tarih]">) {
  const { tarih } = await props.params;
  return briefIssueMetadata(tarih, "daily");
}

export default async function DailyBriefIssue(props: PageProps<"/bulten/[tarih]">) {
  const { tarih } = await props.params;
  return <BriefIssuePage tarih={tarih} period="daily" />;
}
