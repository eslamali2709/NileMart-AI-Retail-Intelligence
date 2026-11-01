import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ReportsCatalog } from "@/components/reports/reports-catalog";

export const metadata: Metadata = { title: "Sales Reports" };

export default function SalesReportsPage() {
  return <><PageHeading title="Sales Reports" description="Browse and manage your uploaded monthly sales and inventory reports." badge="Report library" /><ReportsCatalog /></>;
}
