import { redirect } from 'next/navigation';

/** رابط قديم: المسار الرسمي الآن /wedding/[code] */
export default function LegacyRoom({ params }: { params: { code: string } }) {
  redirect(`/wedding/${params.code.toUpperCase()}`);
}
