/**
 * Hand-coded subject descriptions and availability blurbs.
 *
 * The `subjects` table in 0001_initial_schema.sql does not have a `description`
 * column. Rather than block this work on a schema migration, we provide
 * descriptions here keyed by subject slug. When we add a `description` column
 * to the table (and a migration to backfill these strings), this file can be
 * removed and the catalogue page can read from the row directly.
 */

type SubjectCopy = {
  description: string;
  comingSoonNote: string;
};

const COPY: Record<string, SubjectCopy> = {
  chemistry: {
    description:
      "From atoms to organic synthesis. The full IAL programme, built on the spec and grounded in real mark schemes.",
    comingSoonNote: "",
  },
  physics: {
    description:
      "Mechanics, waves, fields and quantum — taught for the exam, not around it.",
    comingSoonNote: "We're starting with Chemistry. Physics is next.",
  },
  biology: {
    description:
      "Cells, biochemistry, ecology and physiology — exam-focused and spec-led.",
    comingSoonNote: "We're starting with Chemistry. Biology will follow.",
  },
};

export function getSubjectCopy(slug: string): SubjectCopy {
  return (
    COPY[slug] ?? {
      description: "",
      comingSoonNote: "",
    }
  );
}
