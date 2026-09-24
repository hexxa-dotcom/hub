'use server';

import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';

/** Grava os dados do escritório que os clientes usam para falar com a contabilidade. */
export async function salvarEscritorioAction(input: { nome: string; cnpj: string; email: string; whatsapp: string; horario: string }) {
  await requireAdmin();
  const whatsapp = input.whatsapp.replace(/\D/g, '');
  const comDdi = whatsapp.length === 10 || whatsapp.length === 11 ? `55${whatsapp}` : whatsapp;
  if (comDdi && (comDdi.length < 12 || comDdi.length > 13)) return { ok: false, message: 'WhatsApp inválido — use DDD e número, ex.: (47) 99999-0000.' };
  const email = input.email.trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'E-mail inválido.' };
  await getDb().execute(sql`
    INSERT INTO accounting_office (id, nome, cnpj, email, whatsapp, horario, updated_at)
    VALUES (1, ${input.nome.trim()}, ${input.cnpj.trim() || null}, ${email || null}, ${comDdi || null}, ${input.horario.trim() || null}, now())
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cnpj = EXCLUDED.cnpj, email = EXCLUDED.email,
      whatsapp = EXCLUDED.whatsapp, horario = EXCLUDED.horario, updated_at = now()
  `);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Dados do escritório salvos. O botão "Falar com Contador" já usa o novo número.' };
}
