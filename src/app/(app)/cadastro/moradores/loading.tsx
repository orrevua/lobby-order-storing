export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-bg-tertiary rounded w-36" />
      <div className="border-border bg-bg-secondary border rounded-lg p-4 space-y-3">
        <div className="h-4 bg-bg-tertiary rounded w-28" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-bg-tertiary rounded" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-bg-tertiary rounded" />
        ))}
      </div>
    </div>
  );
}
