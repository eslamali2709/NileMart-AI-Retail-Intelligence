import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { ReportUploadForm } from "@/components/upload/report-upload-form";

export const metadata: Metadata = { title: "Upload Sales Report" };

export default function UploadReportPage() {
  return (
    <>
      <PageHeading title="Upload Sales Report" description="Prepare your monthly sales and inventory report. Choose a PDF, then confirm the branch and reporting month before submitting." badge="Phase 2B · Local development" />
      <ReportUploadForm />
    </>
  );
}
