import type { Metadata } from "next";
import { SubjectPage, subjectMetadata, type SubjectSearch } from "@/components/public/SubjectPage";

/** Thin route. All rendering is shared — see SubjectPage. */
export const metadata: Metadata = subjectMetadata("chemistry");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SubjectSearch>;
}) {
  return <SubjectPage slug="chemistry" params={await searchParams} />;
}
