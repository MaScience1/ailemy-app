import type { ReactNode } from "react";

import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

/**
 * Shared chrome for /learn/* — applies SiteNav above and SiteFooter below
 * every catalogue route without each page having to import them. Children
 * pages still own their own <main> and background colour.
 */
export default function LearnLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      {children}
      <SiteFooter />
    </>
  );
}
