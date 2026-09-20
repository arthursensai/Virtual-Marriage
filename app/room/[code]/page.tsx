import { Suspense } from 'react';
import RoomClient from '@/components/RoomClient';

export default function RoomPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={null}>
      <RoomClient code={params.code.toUpperCase()} />
    </Suspense>
  );
}
