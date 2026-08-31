import { EmailForm } from '../../../EmailForm';

export const dynamic = 'force-dynamic';

export default async function ContadorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  return <EmailForm area="contador" next={sp.next || '/contador'} />;
}
