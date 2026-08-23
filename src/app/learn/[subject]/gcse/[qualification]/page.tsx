import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BoardStep } from "@/components/qualifications/QualificationStep";
import { getSubjectBySlug } from "@/lib/catalogue/queries";
import { isQualificationScope, qualificationName } from "@/lib/qualifications/model.ts";

/**
 * /learn/[subject]/gcse/[qualification] — step 3, the exam-board choice.
 *
 * ⚠ THE SCOPE IS VALIDATED, NOT TRUSTED. Only "uk" and "international"
 * resolve; anything else 404s here rather than falling through to the
 * root CMS catch-all, which would cost a database lookup and — for an
 * admin — could render an unrelated draft page where a student sees a 404.
 */

type Params = Promise<{ subject: string; qualification: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject: slug, qualification } = await params;
  if (!isQualificationScope(qualification)) return { title: "Not found · Ailemy" };
  const subject = await getSubjectBySlug(slug);
  if (!subject) return { title: "Not found · Ailemy" };
  const name = qualificationName("gcse", qualification);
  return {
    title: `${name} ${subject.name} · Ailemy`,
    description: `Choose your exam board for ${name} ${subject.name} and see exactly what Ailemy supports for it.`,
  };
}

export default async function Page({ params }: { params: Params }) {
  const { subject, qualification } = await params;
  if (!isQualificationScope(qualification)) notFound();
  return <BoardStep subjectSlug={subject} level="gcse" scope={qualification} />;
}
