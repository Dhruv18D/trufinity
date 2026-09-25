import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonTable } from "@/components/ui/States";
import {
  FieldOperationsOverview,
  FieldOperationsSkeleton,
} from "@/components/sections/servicetitan/FieldOperationsOverview";
import { TechnicianSummary } from "@/components/sections/servicetitan/TechnicianSummary";

export default function FieldOperationsPage() {
  return (
    <div>
      <PageHeader
        title="Field Operations"
        description="ServiceTitan jobs, invoices, AR aging, payments, demand and schedule."
      />
      <Suspense fallback={<FieldOperationsSkeleton />}>
        <FieldOperationsOverview />
      </Suspense>
      <div className="mt-6">
        <Suspense fallback={<SkeletonTable rows={4} />}>
          <TechnicianSummary />
        </Suspense>
      </div>
    </div>
  );
}
