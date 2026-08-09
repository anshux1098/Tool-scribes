import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonToolCardProps {
  variant?: 'row' | 'card';
}

export default function SkeletonToolCard({ variant = 'row' }: SkeletonToolCardProps) {
  if (variant === 'card') {
    return (
      <div className="bg-surface border border-tv-border rounded-xl overflow-hidden">
        <Skeleton className="h-[200px] w-full rounded-none" />
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-7 h-7 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg ml-auto" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-tv-border">
      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-full max-w-sm" />
      </div>
      <Skeleton className="hidden md:block h-5 w-12 rounded flex-shrink-0" />
      <div className="flex items-center gap-1">
        <Skeleton className="w-7 h-7 rounded" />
        <Skeleton className="w-7 h-7 rounded" />
        <Skeleton className="w-7 h-7 rounded" />
      </div>
    </div>
  );
}
