'use client';

export function LoadingSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Upload Zone Skeleton */}
      <div className="flex flex-col gap-4 order-1 lg:order-1">
        {/* Upload Zone Skeleton */}
        <div className="min-h-[500px] rounded-2xl bg-white border-2 border-dashed border-gray-200 animate-pulse">
          <div className="flex flex-col items-center justify-center h-full p-8 sm:p-16 gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200" />
            <div className="h-8 w-48 rounded bg-gray-200" />
            <div className="h-4 w-64 rounded bg-gray-200" />
            <div className="h-12 w-32 rounded-lg bg-gray-200" />
            <div className="h-4 w-56 rounded bg-gray-200" />
          </div>
        </div>

        {/* File List Skeleton */}
        <div className="mt-6 rounded-xl border-2 border-gray-200 bg-white animate-pulse">
          <div className="px-4 pt-4 pb-3">
            <div className="h-6 w-40 rounded bg-gray-200" />
          </div>
          <div className="px-4 pb-4">
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <div className="h-5 w-5 rounded bg-gray-200" />
                  <div className="flex-1 h-4 rounded bg-gray-200" />
                  <div className="h-4 w-16 rounded bg-gray-200" />
                  <div className="h-5 w-5 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Tool Cards Skeleton */}
      <div className="flex flex-col gap-4 order-2 lg:order-2">
        <div className="h-7 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border-2 border-gray-200 bg-white p-6 animate-pulse"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-32 rounded bg-gray-200" />
                  <div className="h-4 w-48 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

