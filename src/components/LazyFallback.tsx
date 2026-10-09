import { Loader2 } from "lucide-react";

export function LazyFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-tv-primary" />
    </div>
  );
}
