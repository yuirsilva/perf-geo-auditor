"use client";

import Link from "next/link";
import { BreadcrumbTrail } from "@/components/glaze/ui/breadcrumb";

/** Client wrapper: renderLink is a function, which a server component can't pass across. */
export function AuditBreadcrumb({ host }: { host: string }) {
  return (
    <BreadcrumbTrail
      items={[{ label: "Your audits", href: "/" }, { label: host }]}
      renderLink={(href) => <Link href={href} />}
    />
  );
}
