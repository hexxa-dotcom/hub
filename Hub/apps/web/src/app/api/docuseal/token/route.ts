import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { currentUser } from '@clerk/nextjs/server';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(req: Request) {
  try {
    const tenant = await getTenantContext();
    if (!tenant?.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const docusealToken = process.env.DOCUSEAL_TOKEN;
    if (!docusealToken) {
      console.error('Missing DOCUSEAL_TOKEN in environment variables.');
      return NextResponse.json({ error: 'Missing DOCUSEAL_TOKEN' }, { status: 500 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? `admin_${tenant.companyId}@hexxahub.com.br`;

    const payload = {
      user_email: userEmail,
      name: `Template - Empresa ${tenant.companyId.slice(0, 8)}`,
    };

    const token = jwt.sign(payload, docusealToken);

    return NextResponse.json({ token });
  } catch (err: any) {
    console.error('DocuSeal Token Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
