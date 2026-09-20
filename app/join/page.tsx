import { Suspense } from 'react';
import JoinClient from './JoinClient';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <JoinClient />
    </Suspense>
  );
}
