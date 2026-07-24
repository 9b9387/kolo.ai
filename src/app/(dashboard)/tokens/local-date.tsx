'use client';

// Renders a date in the viewer's browser timezone. The server (its own zone)
// may paint a different day first — suppressHydrationWarning absorbs that.
export function LocalDate({ value }: { value: Date | null }) {
  if (!value) return <>—</>;
  return (
    <time dateTime={value.toISOString()} suppressHydrationWarning>
      {value.toLocaleDateString()}
    </time>
  );
}
