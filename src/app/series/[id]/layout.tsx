// src/app/series/[id]/layout.tsx
/**
 * INFO:
 * Minimal layout for /series/[id] that explicitly allows dynamic params and
 * does NOT do any data fetching or notFound() that could block children like /series/[id]/[chap].
 */
export const dynamicParams = true;
export const dynamic = "force-dynamic";

export default function SeriesIdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
