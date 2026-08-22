import { getDb } from '@hexxa/db/client';
import { plan, subscription } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { PlanosBoard, type Plano } from './PlanosBoard';
import type { PlanoFeatures } from './actions';

const DEFAULT_FEATURES: PlanoFeatures = { descricao: '', cor: 'brand', ativo: true, recursos: [] };

async function getPlanos(): Promise<Plano[]> {
  const db = getDb();
  const [plans, subs] = await Promise.all([
    db.select().from(plan),
    db.select({ planId: subscription.planId, status: subscription.status }).from(subscription),
  ]);

  const clientesPorPlano = new Map<string, number>();
  for (const s of subs) {
    if (s.status !== 'ACTIVE') continue;
    clientesPorPlano.set(s.planId, (clientesPorPlano.get(s.planId) ?? 0) + 1);
  }

  return plans.map(p => {
    const features = (p.features as Partial<PlanoFeatures> | null) ?? {};
    return {
      id: p.id,
      nome: p.name,
      preco: Number(p.monthlyValue),
      cor: features.cor ?? DEFAULT_FEATURES.cor,
      descricao: features.descricao ?? DEFAULT_FEATURES.descricao,
      recursos: features.recursos ?? DEFAULT_FEATURES.recursos,
      ativo: features.ativo ?? DEFAULT_FEATURES.ativo,
      clientes: clientesPorPlano.get(p.id) ?? 0,
    };
  });
}

export default async function AdminPlanosPage() {
  const planos = await getPlanos();
  return <PlanosBoard initial={planos} />;
}
