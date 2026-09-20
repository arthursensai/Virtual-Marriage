import { Suspense } from 'react';
import WeddingGate from '@/components/wedding/WeddingGate';

export default function WeddingPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={null}>
      <WeddingGate code={params.code.toUpperCase()} />
    </Suspense>
  );
}
