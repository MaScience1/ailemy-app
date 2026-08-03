/**
 * Client-safe shapes and constants for the /past-papers filter cascade.
 *
 * This module must NOT import anything server-only. It exists precisely so the
 * client FilterBar can import real VALUES (FILTER_ORDER, DOC_TYPES) without
 * dragging past-paper-filters.ts — which imports the Supabase server client and
 * `server-only` — into the browser bundle. A type-only import is erased at
 * compile time and would have been fine; a value import is not, and pulling
 * FILTER_ORDER from the server module broke the build with
 * "'server-only' cannot be imported from a Client Component module".
 */

export type DocType = "qp" | "ms";

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "qp", label: "Question paper" },
  { value: "ms", label: "Mark scheme" },
];

export type PaperFilters = {
  subject?: string; // subjects.slug
  board?: string; // curricula.id
  course?: string; // courses.id
  year?: string;
  doc?: string;
};

/**
 * Filter keys in cascade order. The order is load-bearing: selecting a filter
 * clears everything after it, and sanitisation validates each key against the
 * options produced by the keys before it.
 */
export const FILTER_ORDER = ["subject", "board", "course", "year", "doc"] as const;
export type FilterKey = (typeof FILTER_ORDER)[number];

export const FILTER_LABELS: Record<FilterKey, string> = {
  subject: "Subject",
  board: "Exam board",
  course: "Course",
  year: "Year",
  doc: "Document type",
};

export type FilterOptions = {
  subjects: { value: string; label: string }[];
  boards: { value: string; label: string }[];
  courses: { value: string; label: string }[];
  years: { value: string; label: string }[];
  docTypes: { value: string; label: string }[];
};
