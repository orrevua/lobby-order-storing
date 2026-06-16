export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-bg-tertiary rounded w-48" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-bg-tertiary rounded-lg" />
        ))}
      </div>
    </div>
  );
}
