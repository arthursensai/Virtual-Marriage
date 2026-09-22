import { Suspense } from 'react';
import BrideClient from './BrideClient';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BrideClient />
    </Suspense>
  );
}
