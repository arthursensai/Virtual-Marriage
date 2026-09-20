'use client';
import { useSearchParams } from 'next/navigation';
import EntryForm from '@/components/EntryForm';

export default function JoinClient() {
  const code = (useSearchParams().get('code') ?? '').toUpperCase();
  return <EntryForm mode="join" presetCode={code} />;
}
