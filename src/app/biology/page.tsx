import type { Metadata } from "next";
import { SubjectPage, subjectMetadata } from "@/components/public/SubjectPage";

/** Thin route. All rendering is shared — see SubjectPage. */
export const metadata: Metadata = subjectMetadata("biology");

export default function Page() {
  return <SubjectPage slug="biology" />;
}
