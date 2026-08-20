import type { Metadata } from "next";
import { SubjectPage, subjectMetadata, type SubjectSearch } from "@/components/public/SubjectPage";

/** Thin route. All rendering is shared — see SubjectPage. */
export const metadata: Metadata = subjectMetadata("biology");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SubjectSearch>;
}) {
  return <SubjectPage slug="biology" params={await searchParams} />;
}
