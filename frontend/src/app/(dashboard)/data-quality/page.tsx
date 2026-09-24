import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataQualityPanel, DataQualitySkeleton } from "@/components/sections/DataQualityPanel";

export default function DataQualityPage() {
  return (
    <div>
      <PageHeader
        title="Data Quality"
        description="Sync health and integrity of QuickBooks data in the warehouse — broken links, duplicates and unresolved customer matches."
      />
      <Suspense fallback={<DataQualitySkeleton />}>
        <DataQualityPanel />
      </Suspense>
    </div>
  );
}
