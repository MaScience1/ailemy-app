import Link from "next/link";

import { cn } from "@/lib/utils";

export type CourseTabKey = "lessons" | "exam-questions";

type CourseTabsProps = {
  active: CourseTabKey;
  subjectSlug: string;
  pathwaySlug: string;
  courseSlug: string;
};

/**
 * Link-based two-tab nav for the course page. Tabs are real routes (not React
 * state) so they're crawlable, deep-linkable, and don't lose state on reload.
 * Active tab gets the subject-accent underline; inactive tab is muted ink.
 *
 * Sits above the units section on both:
 *   /learn/[subject]/[pathway]/[course]                  (lessons)
 *   /learn/[subject]/[pathway]/[course]/exam-questions   (papers)
 */
export function CourseTabs({
  active,
  subjectSlug,
  pathwaySlug,
  courseSlug,
}: CourseTabsProps) {
  const courseBase = `/learn/${subjectSlug}/${pathwaySlug}/${courseSlug}`;
  const tabs: { key: CourseTabKey; label: string; href: string }[] = [
    { key: "lessons", label: "Lessons", href: courseBase },
    {
      key: "exam-questions",
      label: "Exam Questions",
      href: `${courseBase}/exam-questions`,
    },
  ];

  return (
    <nav
      aria-label="Course sections"
      className="border-b border-ink/10"
    >
      <ul className="-mb-px flex overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "font-mono inline-flex items-center px-4 py-3 text-xs uppercase tracking-[0.22em] transition-colors duration-200",
                  isActive
                    ? "border-b-2 text-ink"
                    : "border-b-2 border-transparent text-ink/55 hover:text-ink",
                )}
                style={
                  isActive
                    ? { borderBottomColor: "var(--subject-accent)" }
                    : undefined
                }
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
