import { Suspense } from 'react';
import SessionDetailPageClient from './detail-client';

export function generateStaticParams() {
  return [
    { id: 'detail' },
  ];
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="animate-pulse text-[var(--accent-lime)] font-mono text-sm">
            Loading Workout Log...
          </div>
        </div>
      }
    >
      <SessionDetailPageClient id={resolvedParams.id} />
    </Suspense>
  );
}
