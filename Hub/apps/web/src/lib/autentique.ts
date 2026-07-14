const ENDPOINT = 'https://api.autentique.com.br/v2/graphql';
const TOKEN = process.env.AUTENTIQUE_TOKEN!;

function authHeaders() {
  return { Authorization: `Bearer ${TOKEN}` };
}

/** Query/mutation sem upload de arquivo. */
async function gql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

/** Mutation com upload multipart (GraphQL multipart request spec). */
async function gqlUpload<T = unknown>(
  query: string,
  variables: Record<string, unknown>,
  file: File,
  fileVariablePath = 'file',
): Promise<T> {
  const form = new FormData();
  form.append('operations', JSON.stringify({ query, variables: { ...variables, [fileVariablePath]: null } }));
  form.append('map', JSON.stringify({ '0': [`variables.${fileVariablePath}`] }));
  form.append('0', file, file.name);

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
    cache: 'no-store',
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type AutentiqueSignature = {
  public_id: string;
  name: string | null;
  email: string;
  action: { name: string };
  signed: { created_at: string } | null;
  rejected: { created_at: string } | null;
  link: { short_link: string } | null;
};

export type AutentiqueDocument = {
  id: string;
  name: string;
  created_at: string;
  signatures: AutentiqueSignature[];
};

export type Signer = {
  email: string;
  action: 'SIGN' | 'APPROVE' | 'SIGN_AS_A_WITNESS' | 'RECOGNIZE';
  name?: string;
};

// ─── API calls ───────────────────────────────────────────────────────────────

/** Lista documentos do usuário (paginado). */
export async function listDocuments(page = 1): Promise<AutentiqueDocument[]> {
  const data = await gql<{ documents: { data: AutentiqueDocument[] } }>(
    `query ListDocs($page: Int) {
      documents(limit: 30, page: $page) {
        data {
          id name created_at
          signatures {
            public_id name email
            action { name }
            signed { created_at }
            rejected { created_at }
            link { short_link }
          }
        }
      }
    }`,
    { page },
  );
  return data.documents.data;
}

/** Cria documento com signatários e envia PDF. */
export async function createDocument(
  name: string,
  signers: Signer[],
  file: File,
): Promise<AutentiqueDocument> {
  const data = await gqlUpload<{ createDocument: AutentiqueDocument }>(
    `mutation CreateDoc($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id name created_at
        signatures {
          public_id name email
          action { name }
          signed { created_at }
          link { short_link }
        }
      }
    }`,
    { document: { name }, signers: signers.map(s => ({ email: s.email, action: s.action })) },
    file,
  );
  return data.createDocument;
}

/** Ids do Autentique são alfanuméricos — rejeita qualquer outro caractere antes de interpolar na query. */
function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Identificador de documento inválido.');
  return id;
}

/** Deleta documento. */
export async function deleteDocument(id: string): Promise<boolean> {
  const data = await gql<{ deleteDocument: boolean }>(`
    mutation { deleteDocument(id: "${safeId(id)}") }
  `);
  return data.deleteDocument;
}

/** Reenviar email de assinatura. */
export async function resendSignature(publicId: string): Promise<boolean> {
  const data = await gql<{ resendSignature: boolean }>(`
    mutation { resendSignature(public_id: "${safeId(publicId)}") }
  `);
  return data.resendSignature;
}
