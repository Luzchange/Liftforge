import SessionDetailPageClient from './detail-client';

export function generateStaticParams() {
  return [
    { id: 'detail' },
  ];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  return <SessionDetailPageClient id={resolved.id} />;
}
