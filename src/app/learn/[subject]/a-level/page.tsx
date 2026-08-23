import type { Metadata } from "next";

import { QualificationStep } from "@/components/qualifications/QualificationStep";
import { getSubjectBySlug } from "@/lib/catalogue/queries";
import { LEVEL_COPY } from "@/lib/qualifications/model.ts";

/**
 * /learn/[subject]/a-level — step 2 of the flow (§23).
 *
 * ⚠ A STATIC SEGMENT BESIDE [pathway], AND THAT IS LOAD-BEARING. Next sorts
 * literal children above dynamic ones, so this wins /learn/chemistry/a-level
 * without shadowing /learn/chemistry/uk-gcse. The alternative — renaming
 * [pathway] to [level] — is a hard build error ("You cannot use different
 * slug names for the same dynamic path"), which is why the level tier is
 * folders rather than a parameter.
 *
 * This URL 404'd before today (isPathway rejects "a-level"), so nothing that
 * previously resolved has changed meaning.
 */

type Params = Promise<{ subject: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { subject: slug } = await params;
  const subject = await getSubjectBySlug(slug);
  if (!subject) return { title: "Not found · Ailemy" };
  const copy = LEVEL_COPY["a-level"];
  return {
    title: `${copy.name} ${subject.name} · Ailemy`,
    description: copy.description,
  };
}

export default async function Page({ params }: { params: Params }) {
  const { subject } = await params;
  return <QualificationStep subjectSlug={subject} level="a-level" />;
}
