import { Skeleton, SkeletonCard, SkeletonTable } from "@/components/ui/States";

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="mt-6">
        <SkeletonTable />
      </div>
    </div>
  );
}
