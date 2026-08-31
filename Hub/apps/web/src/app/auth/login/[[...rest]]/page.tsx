import { EmailForm } from '../../EmailForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  return <EmailForm area="cliente" next={sp.next || '/cliente'} />;
}
