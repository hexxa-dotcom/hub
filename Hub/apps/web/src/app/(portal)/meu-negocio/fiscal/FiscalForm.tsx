'use client';

import React, { useActionState, useState, useTransition, useRef } from 'react';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Save, Upload, Trash2, CheckCircle2, AlertTriangle, Info, Key, Building2, MapPin, Phone, Wrench, X, ArrowRight, Lightbulb, FileText } from 'lucide-react';
import { saveFiscalAction, uploadCertAction, removeCertAction, createProfileAction, deleteProfileAction, saveTecnicaAction, type FiscalState } from './actions';
import type { NfseConfig, NfseServiceProfile } from '@/lib/server/fiscal';
import { formatDocument, isCompleteDocument } from '@hexxa/core/document-br';

// ── helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300';
const hintCls = 'mt-0.5 text-xs text-slate-400';

const initial: FiscalState = { ok: false, message: '' };
const certInitial: FiscalState = { ok: false, message: '' };

const LC116_GRUPOS: { grupo: string; itens: { code: string; label: string }[] }[] = [
  {
    grupo: '1 — Informática e congêneres',
    itens: [
      { code: '1.01', label: '1.01 — Análise e desenvolvimento de sistemas' },
      { code: '1.02', label: '1.02 — Programação' },
      { code: '1.03', label: '1.03 — Processamento, hospedagem ou armazenamento de dados e congêneres' },
      { code: '1.04', label: '1.04 — Elaboração de programas de computadores, inclusive jogos eletrônicos' },
      { code: '1.05', label: '1.05 — Licenciamento ou cessão de direito de uso de programas de computação' },
      { code: '1.06', label: '1.06 — Assessoria e consultoria em informática' },
      { code: '1.07', label: '1.07 — Suporte técnico em informática, instalação e manutenção' },
      { code: '1.08', label: '1.08 — Planejamento, confecção e manutenção de páginas eletrônicas' },
      { code: '1.09', label: '1.09 — Disponibilização de conteúdos de áudio, vídeo e texto via internet' },
    ],
  },
  {
    grupo: '2 — Pesquisas e desenvolvimento',
    itens: [
      { code: '2.01', label: '2.01 — Serviços de pesquisas e desenvolvimento de qualquer natureza' },
    ],
  },
  {
    grupo: '3 — Locação, cessão de direito de uso e congêneres',
    itens: [
      { code: '3.02', label: '3.02 — Cessão de direito de uso de marcas e sinais de propaganda' },
      { code: '3.03', label: '3.03 — Exploração de salões de festas, centros de convenções, estádios e congêneres' },
      { code: '3.04', label: '3.04 — Locação de ferrovia, rodovia, postes, cabos, dutos e condutos' },
      { code: '3.05', label: '3.05 — Cessão de andaimes, palcos, coberturas e estruturas de uso temporário' },
    ],
  },
  {
    grupo: '4 — Saúde, assistência médica e congêneres',
    itens: [
      { code: '4.01', label: '4.01 — Medicina e biomedicina' },
      { code: '4.02', label: '4.02 — Análises clínicas, patologia, radioterapia, radiologia e congêneres' },
      { code: '4.03', label: '4.03 — Hospitais, clínicas, laboratórios, prontos-socorros e congêneres' },
      { code: '4.04', label: '4.04 — Instrumentação cirúrgica' },
      { code: '4.05', label: '4.05 — Acupuntura' },
      { code: '4.06', label: '4.06 — Enfermagem, inclusive serviços auxiliares' },
      { code: '4.07', label: '4.07 — Serviços farmacêuticos' },
      { code: '4.08', label: '4.08 — Terapia ocupacional, fisioterapia e fonoaudiologia' },
      { code: '4.09', label: '4.09 — Terapias destinadas a tratamento físico, orgânico e mental' },
      { code: '4.10', label: '4.10 — Nutrição' },
      { code: '4.11', label: '4.11 — Obstetrícia' },
      { code: '4.12', label: '4.12 — Odontologia' },
      { code: '4.13', label: '4.13 — Ortóptica' },
      { code: '4.14', label: '4.14 — Próteses sob encomenda' },
      { code: '4.15', label: '4.15 — Psicanálise' },
      { code: '4.16', label: '4.16 — Psicologia' },
      { code: '4.17', label: '4.17 — Casas de repouso, creches, asilos e congêneres' },
      { code: '4.18', label: '4.18 — Inseminação artificial, fertilização in vitro e congêneres' },
      { code: '4.19', label: '4.19 — Bancos de sangue, leite, pele, olhos, sêmen e congêneres' },
      { code: '4.20', label: '4.20 — Coleta de sangue, tecidos, órgãos e materiais biológicos' },
      { code: '4.21', label: '4.21 — Unidade de atendimento ou tratamento móvel e congêneres' },
      { code: '4.22', label: '4.22 — Planos de medicina de grupo ou individual e convênios médicos' },
      { code: '4.23', label: '4.23 — Outros planos de saúde prestados mediante serviços de terceiros' },
    ],
  },
  {
    grupo: '5 — Medicina e assistência veterinária',
    itens: [
      { code: '5.01', label: '5.01 — Medicina veterinária e zootecnia' },
      { code: '5.02', label: '5.02 — Hospitais, clínicas e prontos-socorros na área veterinária' },
      { code: '5.03', label: '5.03 — Laboratórios de análise na área veterinária' },
      { code: '5.04', label: '5.04 — Inseminação artificial e fertilização in vitro (veterinária)' },
      { code: '5.05', label: '5.05 — Bancos de sangue e órgãos (veterinária)' },
      { code: '5.06', label: '5.06 — Coleta de sangue, tecidos e materiais biológicos (veterinária)' },
      { code: '5.07', label: '5.07 — Unidade de atendimento móvel (veterinária)' },
      { code: '5.08', label: '5.08 — Guarda, tratamento, amestramento, alojamento e congêneres' },
      { code: '5.09', label: '5.09 — Planos de atendimento médico-veterinário' },
    ],
  },
  {
    grupo: '6 — Cuidados pessoais, estética e atividades físicas',
    itens: [
      { code: '6.01', label: '6.01 — Barbearia, cabeleireiros, manicuros, pedicuros e congêneres' },
      { code: '6.02', label: '6.02 — Esteticistas, tratamento de pele, depilação e congêneres' },
      { code: '6.03', label: '6.03 — Banhos, duchas, sauna, massagens e congêneres' },
      { code: '6.04', label: '6.04 — Ginástica, dança, esportes, natação, artes marciais e atividades físicas' },
      { code: '6.05', label: '6.05 — Centros de emagrecimento, spa e congêneres' },
    ],
  },
  {
    grupo: '7 — Engenharia, arquitetura, construção civil e congêneres',
    itens: [
      { code: '7.01', label: '7.01 — Engenharia, agronomia, arquitetura, geologia, urbanismo e congêneres' },
      { code: '7.02', label: '7.02 — Execução de obras de construção civil, hidráulica ou elétrica' },
      { code: '7.03', label: '7.03 — Elaboração de planos diretores, estudos de viabilidade e projetos de engenharia' },
      { code: '7.04', label: '7.04 — Demolição' },
      { code: '7.05', label: '7.05 — Reparação, conservação e reforma de edifícios, estradas, pontes e portos' },
      { code: '7.06', label: '7.06 — Colocação de tapetes, carpetes, assoalhos, cortinas, vidros e congêneres' },
      { code: '7.07', label: '7.07 — Recuperação, raspagem, polimento e lustração de pisos' },
      { code: '7.08', label: '7.08 — Calafetação' },
      { code: '7.09', label: '7.09 — Coleta, remoção, incineração e destinação final de lixo e resíduos' },
      { code: '7.10', label: '7.10 — Limpeza, manutenção e conservação de vias públicas, imóveis e piscinas' },
      { code: '7.11', label: '7.11 — Decoração e jardinagem, inclusive corte e poda de árvores' },
      { code: '7.12', label: '7.12 — Controle e tratamento de efluentes e agentes físicos, químicos e biológicos' },
      { code: '7.13', label: '7.13 — Dedetização, desinfecção, desinsetização, desratização e congêneres' },
      { code: '7.16', label: '7.16 — Florestamento, reflorestamento, semeadura, adubação, colheita e silvicultura' },
      { code: '7.17', label: '7.17 — Escoramento, contenção de encostas e congêneres' },
      { code: '7.18', label: '7.18 — Limpeza e dragagem de rios, portos, canais e lagoas' },
      { code: '7.19', label: '7.19 — Acompanhamento e fiscalização de obras de engenharia e urbanismo' },
      { code: '7.20', label: '7.20 — Aerofotogrametria, cartografia, mapeamento, levantamentos topográficos' },
      { code: '7.21', label: '7.21 — Pesquisa e perfuração relacionados à exploração de petróleo e gás' },
      { code: '7.22', label: '7.22 — Nucleação e bombardeamento de nuvens e congêneres' },
    ],
  },
  {
    grupo: '8 — Educação e ensino',
    itens: [
      { code: '8.01', label: '8.01 — Ensino regular pré-escolar, fundamental, médio e superior' },
      { code: '8.02', label: '8.02 — Instrução, treinamento, orientação pedagógica e avaliação de conhecimentos' },
    ],
  },
  {
    grupo: '9 — Hospedagem, turismo e viagens',
    itens: [
      { code: '9.01', label: '9.01 — Hospedagem em hotéis, apart-hotéis, motéis, pensões e congêneres' },
      { code: '9.02', label: '9.02 — Agenciamento, organização e execução de programas de turismo e viagens' },
      { code: '9.03', label: '9.03 — Guias de turismo' },
    ],
  },
  {
    grupo: '10 — Intermediação e congêneres',
    itens: [
      { code: '10.01', label: '10.01 — Agenciamento de câmbio, seguros, cartões de crédito e planos de saúde' },
      { code: '10.02', label: '10.02 — Agenciamento de títulos e valores mobiliários' },
      { code: '10.03', label: '10.03 — Agenciamento de direitos de propriedade industrial, artística ou literária' },
      { code: '10.04', label: '10.04 — Agenciamento de leasing, franquia e factoring' },
      { code: '10.05', label: '10.05 — Agenciamento de bens móveis ou imóveis' },
      { code: '10.06', label: '10.06 — Agenciamento marítimo' },
      { code: '10.07', label: '10.07 — Agenciamento de notícias' },
      { code: '10.08', label: '10.08 — Agenciamento de publicidade e propaganda' },
      { code: '10.09', label: '10.09 — Representação de qualquer natureza, inclusive comercial' },
      { code: '10.10', label: '10.10 — Distribuição de bens de terceiros' },
    ],
  },
  {
    grupo: '11 — Guarda, armazenamento, vigilância e congêneres',
    itens: [
      { code: '11.01', label: '11.01 — Guarda e estacionamento de veículos, aeronaves e embarcações' },
      { code: '11.02', label: '11.02 — Vigilância, segurança ou monitoramento de bens, pessoas e semoventes' },
      { code: '11.03', label: '11.03 — Escolta, inclusive de veículos e cargas' },
      { code: '11.04', label: '11.04 — Armazenamento, depósito, carga, descarga e guarda de bens' },
    ],
  },
  {
    grupo: '12 — Diversões, lazer, entretenimento e congêneres',
    itens: [
      { code: '12.01', label: '12.01 — Espetáculos teatrais' },
      { code: '12.02', label: '12.02 — Exibições cinematográficas' },
      { code: '12.03', label: '12.03 — Espetáculos circenses' },
      { code: '12.04', label: '12.04 — Programas de auditório' },
      { code: '12.05', label: '12.05 — Parques de diversões, centros de lazer e congêneres' },
      { code: '12.06', label: '12.06 — Boates, taxi-dancing e congêneres' },
      { code: '12.07', label: '12.07 — Shows, ballet, danças, óperas, concertos, festivais e congêneres' },
      { code: '12.08', label: '12.08 — Feiras, exposições, congressos e congêneres' },
      { code: '12.09', label: '12.09 — Bilhares, boliches e diversões eletrônicas' },
      { code: '12.10', label: '12.10 — Corridas e competições de animais' },
      { code: '12.11', label: '12.11 — Competições esportivas ou de destreza física e intelectual' },
      { code: '12.12', label: '12.12 — Execução de música' },
      { code: '12.13', label: '12.13 — Produção de eventos, espetáculos, shows e congêneres' },
      { code: '12.14', label: '12.14 — Fornecimento de música para ambientes por qualquer processo' },
      { code: '12.15', label: '12.15 — Desfiles de blocos carnavalescos, trios elétricos e congêneres' },
      { code: '12.16', label: '12.16 — Exibição de filmes, musicais, shows, competições esportivas e congêneres' },
      { code: '12.17', label: '12.17 — Recreação e animação, inclusive em festas e eventos' },
    ],
  },
  {
    grupo: '13 — Fonografia, fotografia, cinematografia e reprografia',
    itens: [
      { code: '13.02', label: '13.02 — Fonografia, gravação de sons, dublagem, mixagem e congêneres' },
      { code: '13.03', label: '13.03 — Fotografia e cinematografia, inclusive revelação e reprodução' },
      { code: '13.04', label: '13.04 — Reprografia, microfilmagem e digitalização' },
      { code: '13.05', label: '13.05 — Composição gráfica, fotocomposição, clicheria, litografia e fotolitografia' },
    ],
  },
  {
    grupo: '14 — Serviços relativos a bens de terceiros',
    itens: [
      { code: '14.01', label: '14.01 — Lubrificação, limpeza, manutenção e conserto de máquinas e equipamentos' },
      { code: '14.02', label: '14.02 — Assistência técnica' },
      { code: '14.03', label: '14.03 — Recondicionamento de motores' },
      { code: '14.04', label: '14.04 — Recauchutagem ou regeneração de pneus' },
      { code: '14.05', label: '14.05 — Restauração, pintura, lavagem, tingimento, galvanoplastia e congêneres' },
      { code: '14.06', label: '14.06 — Instalação e montagem de aparelhos, máquinas e equipamentos' },
      { code: '14.07', label: '14.07 — Colocação de molduras e congêneres' },
      { code: '14.08', label: '14.08 — Encadernação, gravação e douração de livros e revistas' },
      { code: '14.09', label: '14.09 — Alfaiataria e costura (material fornecido pelo usuário final)' },
      { code: '14.10', label: '14.10 — Tinturaria e lavanderia' },
      { code: '14.11', label: '14.11 — Tapeçaria e reforma de estofamentos' },
      { code: '14.12', label: '14.12 — Funilaria e lanternagem' },
      { code: '14.13', label: '14.13 — Carpintaria e serralheria' },
      { code: '14.14', label: '14.14 — Guincho intramunicipal, guindaste e içamento' },
    ],
  },
  {
    grupo: '15 — Setor bancário ou financeiro',
    itens: [
      { code: '15.01', label: '15.01 — Administração de fundos, consórcio, cartão de crédito e congêneres' },
      { code: '15.02', label: '15.02 — Abertura e manutenção de contas em geral' },
      { code: '15.03', label: '15.03 — Locação e manutenção de cofres e terminais eletrônicos' },
      { code: '15.04', label: '15.04 — Fornecimento de atestados, inclusive de idoneidade financeira' },
      { code: '15.05', label: '15.05 — Cadastro, ficha cadastral, inclusão/exclusão no CCF e congêneres' },
      { code: '15.06', label: '15.06 — Emissão de avisos, comprovantes, abono de firmas e congêneres' },
      { code: '15.07', label: '15.07 — Acesso e consulta a contas por qualquer meio, inclusive internet e ATM' },
      { code: '15.08', label: '15.08 — Contrato de crédito, aval, fiança, abertura de crédito e congêneres' },
      { code: '15.09', label: '15.09 — Arrendamento mercantil (leasing) de quaisquer bens' },
      { code: '15.10', label: '15.10 — Cobranças, recebimentos e pagamentos em geral, inclusive eletrônicos' },
      { code: '15.11', label: '15.11 — Devolução, protesto e sustação de títulos e congêneres' },
      { code: '15.12', label: '15.12 — Custódia em geral, inclusive de títulos e valores mobiliários' },
      { code: '15.13', label: '15.13 — Câmbio, carta de crédito, exportação e importação' },
      { code: '15.14', label: '15.14 — Fornecimento e manutenção de cartão magnético, crédito e débito' },
      { code: '15.15', label: '15.15 — Compensação de cheques, depósito e saque por qualquer meio' },
      { code: '15.16', label: '15.16 — Ordens de pagamento, transferência de valores e fundos' },
      { code: '15.17', label: '15.17 — Emissão, devolução, sustação e cancelamento de cheques' },
      { code: '15.18', label: '15.18 — Crédito imobiliário, avaliação de imóvel e serviços relacionados' },
    ],
  },
  {
    grupo: '16 — Transporte de natureza municipal',
    itens: [
      { code: '16.01', label: '16.01 — Transporte coletivo municipal rodoviário, metroviário, ferroviário e aquaviário' },
      { code: '16.02', label: '16.02 — Outros serviços de transporte de natureza municipal' },
    ],
  },
  {
    grupo: '17 — Apoio técnico, administrativo, jurídico e contábil',
    itens: [
      { code: '17.01', label: '17.01 — Assessoria ou consultoria de qualquer natureza' },
      { code: '17.02', label: '17.02 — Datilografia, digitação, estenografia, secretaria e congêneres' },
      { code: '17.03', label: '17.03 — Planejamento, coordenação e organização técnica, financeira e administrativa' },
      { code: '17.04', label: '17.04 — Recrutamento, agenciamento, seleção e colocação de mão-de-obra' },
      { code: '17.05', label: '17.05 — Fornecimento de mão-de-obra, inclusive temporária' },
      { code: '17.06', label: '17.06 — Propaganda e publicidade, inclusive planejamento de campanhas' },
      { code: '17.06.01', label: '17.06.01 — Propaganda e publicidade (Subitem 01)' },
      { code: '17.08', label: '17.08 — Franquia (franchising)' },
      { code: '17.09', label: '17.09 — Perícias, laudos, exames técnicos e análises técnicas' },
      { code: '17.10', label: '17.10 — Organização e administração de feiras, exposições, congressos e congêneres' },
      { code: '17.11', label: '17.11 — Organização de festas e recepções; bufê' },
      { code: '17.12', label: '17.12 — Administração em geral, inclusive de bens e negócios de terceiros' },
      { code: '17.13', label: '17.13 — Leilão e congêneres' },
      { code: '17.14', label: '17.14 — Advocacia' },
      { code: '17.15', label: '17.15 — Arbitragem de qualquer espécie, inclusive jurídica' },
      { code: '17.16', label: '17.16 — Auditoria' },
      { code: '17.17', label: '17.17 — Análise de Organização e Métodos' },
      { code: '17.18', label: '17.18 — Atuária e cálculos técnicos de qualquer natureza' },
      { code: '17.19', label: '17.19 — Contabilidade, inclusive serviços técnicos e auxiliares' },
      { code: '17.20', label: '17.20 — Consultoria e assessoria econômica ou financeira' },
      { code: '17.21', label: '17.21 — Estatística' },
      { code: '17.22', label: '17.22 — Cobrança em geral' },
      { code: '17.23', label: '17.23 — Assessoria e administração relacionados a factoring' },
      { code: '17.24', label: '17.24 — Apresentação de palestras, conferências e seminários' },
      { code: '17.25', label: '17.25 — Inserção de textos e materiais de propaganda em qualquer meio' },
    ],
  },
  {
    grupo: '18 — Regulação de sinistros e seguros',
    itens: [
      { code: '18.01', label: '18.01 — Regulação de sinistros, inspeção de riscos para seguros e congêneres' },
    ],
  },
  {
    grupo: '19 — Distribuição e venda de bilhetes de loteria',
    itens: [
      { code: '19.01', label: '19.01 — Distribuição e venda de bilhetes de loteria, bingos, apostas e congêneres' },
    ],
  },
  {
    grupo: '20 — Serviços portuários, aeroportuários e terminais',
    itens: [
      { code: '20.01', label: '20.01 — Serviços portuários, ferroportuários, capatazia, armazenagem e congêneres' },
      { code: '20.02', label: '20.02 — Serviços aeroportuários, movimentação de aeronaves e passageiros' },
      { code: '20.03', label: '20.03 — Serviços de terminais rodoviários e ferroviários' },
    ],
  },
  {
    grupo: '21 — Registros públicos, cartorários e notariais',
    itens: [
      { code: '21.01', label: '21.01 — Serviços de registros públicos, cartorários e notariais' },
    ],
  },
  {
    grupo: '22 — Exploração de rodovias',
    itens: [
      { code: '22.01', label: '22.01 — Exploração de rodovias mediante cobrança de pedágio' },
    ],
  },
  {
    grupo: '23 — Programação e comunicação visual',
    itens: [
      { code: '23.01', label: '23.01 — Programação e comunicação visual, desenho industrial e congêneres' },
    ],
  },
  {
    grupo: '24 — Chaveiros, carimbos, placas e sinalização',
    itens: [
      { code: '24.01', label: '24.01 — Chaveiros, carimbos, placas, sinalização visual, banners e adesivos' },
    ],
  },
  {
    grupo: '25 — Serviços funerários',
    itens: [
      { code: '25.01', label: '25.01 — Funerais, caixões, transporte de corpo cadavérico e congêneres' },
      { code: '25.02', label: '25.02 — Translado intramunicipal e cremação de corpos' },
      { code: '25.03', label: '25.03 — Planos ou convênios funerários' },
      { code: '25.04', label: '25.04 — Manutenção e conservação de jazigos e cemitérios' },
      { code: '25.05', label: '25.05 — Cessão de uso de espaços em cemitérios para sepultamento' },
    ],
  },
  {
    grupo: '26 — Coleta e entrega de correspondências e valores',
    itens: [
      { code: '26.01', label: '26.01 — Coleta, remessa e entrega de correspondências, objetos e valores; courrier' },
    ],
  },
  {
    grupo: '27 — Assistência social',
    itens: [
      { code: '27.01', label: '27.01 — Serviços de assistência social' },
    ],
  },
  {
    grupo: '28 — Avaliação de bens e serviços',
    itens: [
      { code: '28.01', label: '28.01 — Avaliação de bens e serviços de qualquer natureza' },
    ],
  },
  {
    grupo: '29 — Biblioteconomia',
    itens: [
      { code: '29.01', label: '29.01 — Serviços de biblioteconomia' },
    ],
  },
  {
    grupo: '30 — Biologia, biotecnologia e química',
    itens: [
      { code: '30.01', label: '30.01 — Serviços de biologia, biotecnologia e química' },
    ],
  },
  {
    grupo: '31 — Serviços técnicos em edificações e telecomunicações',
    itens: [
      { code: '31.01', label: '31.01 — Serviços técnicos em edificações, eletrônica, eletrotécnica, mecânica e telecomunicações' },
    ],
  },
  {
    grupo: '32 — Desenhos técnicos',
    itens: [
      { code: '32.01', label: '32.01 — Serviços de desenhos técnicos' },
    ],
  },
  {
    grupo: '33 — Desembaraço aduaneiro e despachantes',
    itens: [
      { code: '33.01', label: '33.01 — Desembaraço aduaneiro, comissários, despachantes e congêneres' },
    ],
  },
  {
    grupo: '34 — Investigações particulares e detetives',
    itens: [
      { code: '34.01', label: '34.01 — Investigações particulares, detetives e congêneres' },
    ],
  },
  {
    grupo: '35 — Reportagem, jornalismo e relações públicas',
    itens: [
      { code: '35.01', label: '35.01 — Reportagem, assessoria de imprensa, jornalismo e relações públicas' },
    ],
  },
  {
    grupo: '36 — Meteorologia',
    itens: [
      { code: '36.01', label: '36.01 — Serviços de meteorologia' },
    ],
  },
  {
    grupo: '37 — Artistas, atletas, modelos e manequins',
    itens: [
      { code: '37.01', label: '37.01 — Serviços de artistas, atletas, modelos e manequins' },
    ],
  },
  {
    grupo: '38 — Museologia',
    itens: [
      { code: '38.01', label: '38.01 — Serviços de museologia' },
    ],
  },
  {
    grupo: '39 — Ourivesaria e lapidação',
    itens: [
      { code: '39.01', label: '39.01 — Ourivesaria e lapidação (material fornecido pelo tomador)' },
    ],
  },
  {
    grupo: '40 — Obras de arte sob encomenda',
    itens: [
      { code: '40.01', label: '40.01 — Obras de arte sob encomenda' },
    ],
  },
];

const REGIME_ESPECIAL = [
  { code: '', label: 'Nenhum (padrão)' },
  { code: '1', label: '1 — Microempresa municipal' },
  { code: '2', label: '2 — Estimativa' },
  { code: '3', label: '3 — Sociedade de profissionais' },
  { code: '4', label: '4 — Cooperativa' },
  { code: '5', label: '5 — Microempresário individual (MEI)' },
  { code: '6', label: '6 — Microempresário e empresa de pequeno porte (ME/EPP)' },
];

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

// ── Mapeamento CNAE → LC 116/2003 ────────────────────────────────────────────
// Chave: prefixo do CNAE (2–7 dígitos, sem pontuação). O match é feito do
// mais específico (7 dígitos) para o mais genérico (2 dígitos).
// Valor: array de códigos LC 116 sugeridos, em ordem de prioridade.
const CNAE_LC116: [prefix: string, lc116: string[]][] = [
  // 62-63 — Informática e tecnologia
  ['6201501', ['1.01', '1.02']],
  ['6201502', ['1.08']],
  ['6202300', ['1.04']],
  ['6203100', ['1.05']],
  ['6204000', ['1.06']],
  ['6209100', ['1.07']],
  ['6311900', ['1.03']],
  ['6319400', ['1.09']],
  ['6399200', ['1.03', '1.09']],
  ['6201', ['1.01', '1.02']],
  ['6202', ['1.04']],
  ['6203', ['1.05']],
  ['6204', ['1.06']],
  ['6209', ['1.07']],
  ['6311', ['1.03']],
  ['6319', ['1.09']],
  ['62', ['1.01', '1.07']],
  ['63', ['1.03', '1.09']],
  // 72 — Pesquisa e desenvolvimento
  ['7210000', ['2.01']],
  ['7220700', ['2.01', '30.01']],
  ['72', ['2.01']],
  // 68 — Imóveis e corretagem
  ['6821801', ['10.05']],
  ['6821802', ['10.05']],
  ['6822600', ['17.12']],
  ['6810202', ['10.05']],
  // 69 — Jurídico e contábil
  ['6911701', ['17.14']],
  ['6911702', ['17.14']],
  ['6912500', ['21.01']],
  ['6920601', ['17.19']],
  ['6920602', ['17.16', '17.20']],
  ['6920', ['17.19', '17.16']],
  ['69', ['17.14', '17.19']],
  // 70 — Consultoria em gestão
  ['7020400', ['17.01', '17.03']],
  ['70', ['17.01', '17.03']],
  // 71 — Arquitetura e engenharia
  ['7111100', ['7.01']],
  ['7112000', ['7.01']],
  ['7119701', ['7.20']],
  ['7119702', ['7.03']],
  ['7119799', ['7.01']],
  ['7120400', ['7.21']],
  ['71', ['7.01', '7.03']],
  // 73 — Publicidade e pesquisa de mercado
  ['7310500', ['10.08', '17.06']],
  ['7319002', ['17.06']],
  ['7319003', ['17.06']],
  ['7319004', ['17.06']],
  ['7320300', ['17.06']],
  ['73', ['10.08', '17.06']],
  // 74 — Atividades profissionais diversas
  ['7410202', ['23.01']],
  ['7420001', ['13.03']],
  ['7420002', ['13.03']],
  ['7490102', ['17.21']],
  ['7490103', ['17.10']],
  ['7490104', ['35.01']],
  ['7490199', ['17.09', '28.01']],
  ['74901', ['17.09']],
  ['74', ['17.09', '28.01']],
  // 75 — Veterinária
  ['7500100', ['5.01', '5.02']],
  ['75', ['5.01']],
  // 78 — Recursos humanos
  ['7810800', ['17.04']],
  ['7820500', ['17.05']],
  ['7830200', ['17.05']],
  ['78', ['17.04', '17.05']],
  // 79 — Turismo e viagens
  ['7911200', ['9.02']],
  ['7912100', ['9.02']],
  ['7990200', ['9.02']],
  ['79', ['9.02', '9.03']],
  // 80 — Vigilância e segurança
  ['8011101', ['11.02']],
  ['8011102', ['5.08']],
  ['8012900', ['11.02', '11.03']],
  ['80', ['11.02']],
  // 81 — Serviços de limpeza e manutenção
  ['8111700', ['7.10']],
  ['8112700', ['7.10']],
  ['8121400', ['7.10']],
  ['8122200', ['7.13']],
  ['8129000', ['7.10', '7.11']],
  ['81', ['7.10']],
  // 82 — Apoio administrativo
  ['8211300', ['17.02']],
  ['8219901', ['17.02']],
  ['8219999', ['17.02', '17.12']],
  ['8230001', ['17.10']],
  ['8230002', ['17.11']],
  ['8291100', ['17.22']],
  ['82', ['17.02', '17.12']],
  // 85 — Educação
  ['8511200', ['8.01']],
  ['8512100', ['8.01']],
  ['8513900', ['8.01']],
  ['8520100', ['8.01']],
  ['8531700', ['8.01']],
  ['8532500', ['8.01']],
  ['8533300', ['8.01']],
  ['8541400', ['8.01']],
  ['8542200', ['8.01']],
  ['8550301', ['8.02']],
  ['8550302', ['8.02']],
  ['8591100', ['8.02']],
  ['8592901', ['8.02']],
  ['8592902', ['8.02']],
  ['8593700', ['8.02']],
  ['8599603', ['8.02']],
  ['8599605', ['8.02']],
  ['8599699', ['8.02']],
  ['85', ['8.01', '8.02']],
  // 86 — Saúde
  ['8610101', ['4.03']],
  ['8610102', ['4.03']],
  ['8621601', ['4.21']],
  ['8621602', ['4.21']],
  ['8630501', ['4.01']],
  ['8630502', ['4.01']],
  ['8630503', ['4.01']],
  ['8630504', ['4.01']],
  ['8630506', ['4.01']],
  ['8630507', ['4.01']],
  ['8640201', ['4.02']],
  ['8640202', ['4.02']],
  ['8640203', ['4.02']],
  ['8640204', ['4.02']],
  ['8640205', ['4.02']],
  ['8650001', ['4.08']],
  ['8650002', ['4.06']],
  ['8650003', ['4.01']],
  ['8650004', ['4.12']],
  ['8650005', ['4.06']],
  ['8650006', ['4.08']],
  ['8650007', ['4.16']],
  ['8650008', ['4.15']],
  ['8650009', ['4.09']],
  ['8650010', ['4.10']],
  ['8660700', ['4.22']],
  ['8711501', ['4.17']],
  ['8711502', ['4.17']],
  ['8712300', ['4.17']],
  ['8720401', ['4.17']],
  ['8720499', ['4.09', '4.16']],
  ['8730101', ['27.01']],
  ['8730199', ['27.01']],
  ['8800600', ['27.01']],
  ['8630', ['4.01']],
  ['86', ['4.01', '4.03']],
  ['87', ['27.01', '4.09']],
  ['88', ['27.01']],
  // 90 — Artes, cultura e entretenimento
  ['9001901', ['12.01', '12.07']],
  ['9001902', ['12.07', '37.01']],
  ['9001903', ['12.07', '37.01']],
  ['9001904', ['12.01']],
  ['9001905', ['12.12']],
  ['9001906', ['12.03']],
  ['9001907', ['12.04']],
  ['9001999', ['12.07']],
  ['9002701', ['12.13']],
  ['9002702', ['12.13']],
  ['9003500', ['3.03', '12.13']],
  ['90', ['12.07', '37.01']],
  // 91 — Museus e bibliotecas
  ['9101500', ['29.01']],
  ['9102301', ['38.01']],
  ['91', ['29.01', '38.01']],
  // 93 — Esportes e recreação
  ['9311500', ['12.11']],
  ['9312300', ['6.04']],
  ['9313100', ['6.04']],
  ['9319101', ['6.04']],
  ['9319199', ['12.17']],
  ['9321200', ['12.05']],
  ['9329801', ['6.03']],
  ['9329899', ['12.17']],
  ['93', ['6.04', '12.11']],
  // 96 — Serviços pessoais
  ['9601701', ['14.10']],
  ['9601702', ['14.10']],
  ['9601703', ['14.10']],
  ['9602501', ['6.01']],
  ['9602502', ['6.01']],
  ['9602503', ['6.02']],
  ['9603301', ['25.01']],
  ['9603302', ['25.02']],
  ['9603303', ['25.03']],
  ['9603304', ['25.04']],
  ['9603399', ['25.01']],
  ['9609202', ['6.03']],
  ['9609204', ['6.02']],
  ['9609205', ['6.01']],
  ['9609206', ['6.04']],
  ['9609207', ['14.14']],
  ['96', ['6.01', '14.01']],
  // 49 — Transporte municipal
  ['4921301', ['16.01']],
  ['4921302', ['16.01']],
  ['4921303', ['16.01']],
  ['4923001', ['16.02']],
  ['4923002', ['16.02']],
  ['4929901', ['16.02']],
  ['4929902', ['16.02']],
  ['4929999', ['16.02']],
  ['49', ['16.01', '16.02']],
  // 55 — Hospedagem
  ['5510801', ['9.01']],
  ['5510802', ['9.01']],
  ['5590601', ['9.01']],
  ['5590602', ['9.01']],
  ['5590603', ['9.01']],
  ['55', ['9.01']],
  // 56 — Alimentação (bufê)
  ['5620101', ['17.11']],
  ['5620102', ['17.11']],
  // 64-66 — Financeiro
  ['6422100', ['15.01', '15.02']],
  ['6431000', ['15.10']],
  ['6435201', ['15.01']],
  ['6499301', ['15.01']],
  ['6610802', ['15.10']],
  ['6611801', ['10.02']],
  ['6612602', ['10.01']],
  ['6612604', ['15.13']],
  ['6619302', ['15.11']],
  ['6619399', ['15.01']],
  ['6621501', ['10.01']],
  ['6621502', ['18.01']],
  ['6622300', ['10.01']],
  ['64', ['15.01', '15.02']],
  ['65', ['15.01']],
  ['66', ['10.01', '15.01']],
  // 15 — Transporte marítimo / aquaviário
  ['5011401', ['20.01']],
  ['5011402', ['20.01']],
  // 52 — Transporte aéreo e terminais
  ['5120000', ['20.02']],
  ['5229001', ['20.03']],
  ['5229099', ['20.03']],
  // 61 — Telecomunicações
  ['6110801', ['31.01']],
  ['6110802', ['31.01']],
  ['61', ['31.01']],
  // 18 — Impressão e reprografia
  ['1813099', ['13.05']],
  ['18', ['13.05']],
  // 59 — Produção audiovisual
  ['5911102', ['12.13']],
  ['5912099', ['13.02']],
  ['5913800', ['12.02', '12.16']],
  ['5914600', ['12.02']],
  ['59', ['12.13', '13.02']],
  // 60 — Rádio e TV
  ['6010100', ['17.25']],
  ['6021700', ['17.25']],
  // 47/46 — Comércio (excepcionalmente pode ter ISS em serviços acessórios)
  // 33 — Manutenção e reparação
  ['3311200', ['14.01']],
  ['3312102', ['14.01']],
  ['3313901', ['14.01']],
  ['3314700', ['14.01']],
  ['3319800', ['14.01']],
  ['33', ['14.01', '14.02']],
  // 45 — Manutenção de veículos
  ['4520001', ['14.01', '14.12']],
  ['4520002', ['14.01', '14.12']],
  ['4520003', ['14.03']],
  ['4520004', ['14.04']],
  ['4520005', ['14.01']],
  ['4521', ['14.01']],
];

function sugerirLC116(cnaeCodigo: string | number): string[] {
  const code = String(cnaeCodigo).replace(/\D/g, '');
  for (let len = Math.min(code.length, 7); len >= 2; len--) {
    const prefix = code.slice(0, len);
    const match = CNAE_LC116.find(([p]) => p === prefix);
    if (match) return match[1];
  }
  return [];
}

type CnaeItem = { codigo: number; descricao: string };

function CnaeSugestoes({
  cnaePrimario,
  cnaesSecundarios,
  itemSelecionado,
  onSelect,
}: {
  cnaePrimario: CnaeItem | null;
  cnaesSecundarios: CnaeItem[];
  itemSelecionado: string;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(true);

  if (!cnaePrimario) return null;

  const todos = [
    { ...cnaePrimario, tipo: 'Principal' as const },
    ...cnaesSecundarios.map(c => ({ ...c, tipo: 'Secundário' as const })),
  ];
  const todosComSugestao = todos.filter(c => sugerirLC116(c.codigo).length > 0);
  if (todosComSugestao.length === 0) return null;

  const allCodes = LC116_GRUPOS.flatMap(g => g.itens);
  const getLabelLC = (code: string) => allCodes.find(i => i.code === code)?.label ?? code;

  // Collapsed: mostra apenas um resumo clicável para reabrir
  if (!open) {
    const selecionadoLabel = itemSelecionado ? getLabelLC(itemSelecionado) : null;
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-brand-300 px-4 py-2.5 text-left text-xs text-brand-600 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-900/10"
      >
        <Lightbulb className="h-3.5 w-3.5 shrink-0" />
        <span>
          Ver sugestões de LC 116 por CNAE
          {selecionadoLabel && <span className="ml-1 font-semibold">· {selecionadoLabel}</span>}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 dark:border-brand-800/40 dark:bg-brand-900/10">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3 dark:border-brand-800/30">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-brand-500" />
          <p className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Sugestões LC 116 — baseadas nos CNAEs da empresa
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-800/40"
          aria-label="Fechar sugestões"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Linhas: uma por CNAE com sugestão */}
      <div className="divide-y divide-brand-100 dark:divide-brand-800/30">
        {todosComSugestao.map(cnae => {
          const sugestoes = sugerirLC116(cnae.codigo);
          const cnaeFormatado = String(cnae.codigo).padStart(7, '0');
          return (
            <div key={cnae.codigo} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
              {/* Lado esquerdo: identificação do CNAE */}
              <div className="flex min-w-0 shrink-0 flex-col gap-0.5 sm:w-56">
                <div className="flex items-center gap-1.5">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    cnae.tipo === 'Principal'
                      ? 'bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {cnae.tipo}
                  </span>
                  <span className="font-mono text-xs text-slate-500">{cnaeFormatado}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                  {cnae.descricao}
                </p>
              </div>

              {/* Seta */}
              <div className="hidden shrink-0 pt-2 text-brand-300 sm:block">
                <ArrowRight className="h-3.5 w-3.5" />
              </div>

              {/* Lado direito: botões de sugestão */}
              <div className="flex flex-wrap gap-1.5">
                {sugestoes.map(lc => {
                  const selected = itemSelecionado === lc;
                  return (
                    <button
                      key={lc}
                      type="button"
                      onClick={() => { onSelect(lc); setOpen(false); }}
                      title={`Selecionar ${getLabelLC(lc)}`}
                      className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-medium transition ${
                        selected
                          ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500'
                      }`}
                    >
                      {selected && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                      <span className="font-mono">{lc}</span>
                      <span className="text-slate-400 dark:text-slate-500">·</span>
                      <span className="max-w-[22ch] truncate">{getLabelLC(lc).replace(/^\d+\.\d+ — /, '')}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-brand-100 px-4 py-2 dark:border-brand-800/30">
        <p className="text-[11px] text-slate-400">
          Clique em um código para selecioná-lo — o painel fecha automaticamente.
        </p>
      </div>
    </div>
  );
}

function formatCEP(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, '$1-$2');
}

function formatTelefone(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function Tip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block align-middle ml-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-slate-400 hover:text-brand-500"
        aria-label="Ajuda"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-5 top-0 z-20 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {children}
          <button onClick={() => setOpen(false)} className="mt-2 text-brand-500 hover:underline">Fechar</button>
        </div>
      )}
    </span>
  );
}

function Feedback({ state }: { state: FiscalState }) {
  if (!state.message) return null;
  return (
    <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
      state.ok
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    }`}>
      {state.ok
        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      }
      {state.message}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
      <Icon className="h-4 w-4 text-brand-500" />
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{children}</h3>
    </div>
  );
}

// ── Seção: Dados da Empresa ───────────────────────────────────────────────────

function DadosEmpresa({ config }: { config: NfseConfig | null }) {
  const [state, action, pending] = useActionState(saveFiscalAction, initial);
  const c = config;

  // Campos controlados para suportar preenchimento via lookup do CNPJ
  const [cnpj, setCnpj] = useState(c?.cnpj ? formatDocument(c.cnpj) : '');
  const [razao, setRazao] = useState(c?.razaoSocial ?? '');
  const [fantasia, setFantasia] = useState(c?.nomeFantasia ?? '');
  const [cep, setCep] = useState(c?.cep ? formatCEP(c.cep) : '');
  const [logradouro, setLogradouro] = useState(c?.logradouro ?? '');
  const [numero, setNumero] = useState(c?.numero ?? '');
  const [complemento, setComplemento] = useState(c?.complemento ?? '');
  const [bairro, setBairro] = useState(c?.bairro ?? '');
  const [uf, setUf] = useState(c?.uf ?? '');
  const [codigoMunicipio, setCodigoMunicipio] = useState(c?.codigoMunicipio ?? '');
  const [email, setEmail] = useState(c?.emailContato ?? '');
  const [telefone, setTelefone] = useState(c?.telefone ?? '');
  const [regime, setRegime] = useState(c?.regimeApuracao ?? (c?.optanteSimples ? '2' : '1'));

  // Estado do lookup de CNPJ
  const [cnpjStatus, setCnpjStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [cnpjMsg, setCnpjMsg] = useState('');

  // CNAEs retornados pela Receita Federal
  const [cnaePrimario, setCnaePrimario] = useState<CnaeItem | null>(null);
  const [cnaesSecundarios, setCnaesSecundarios] = useState<CnaeItem[]>([]);

  // Item LC 116 — controlado para aceitar sugestões automáticas
  const defaultItem = c?.itemListaServico ?? '';
  const allCodes = LC116_GRUPOS.flatMap(g => g.itens);
  const [itemSelecionado, setItemSelecionado] = useState(defaultItem);
  const [itemCustom, setItemCustom] = useState(!allCodes.some(l => l.code === defaultItem) && !!defaultItem);

  async function buscarCnpj(val: string) {
    const digits = val.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setCnpjStatus('loading');
    setCnpjMsg('');
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) {
        setCnpjStatus('error');
        setCnpjMsg(res.status === 404 ? 'CNPJ não encontrado na Receita Federal.' : 'Erro ao consultar. Preencha manualmente.');
        return;
      }
      const d = await res.json();
      if (d.razao_social) setRazao(d.razao_social);
      if (d.nome_fantasia) setFantasia(d.nome_fantasia);
      if (d.cep) setCep(formatCEP(d.cep));
      if (d.logradouro) setLogradouro(d.logradouro);
      if (d.numero) setNumero(d.numero);
      if (d.complemento) setComplemento(d.complemento);
      if (d.bairro) setBairro(d.bairro);
      if (d.uf) setUf(d.uf);
      if (d.codigo_municipio_ibge) setCodigoMunicipio(String(d.codigo_municipio_ibge));
      if (d.email) setEmail(d.email.toLowerCase());
      if (d.ddd_telefone_1) setTelefone(formatTelefone(d.ddd_telefone_1));
      if (d.opcao_pelo_simples != null) setRegime(d.opcao_pelo_simples ? '2' : '1');

      // CNAEs — guarda para exibir sugestões de LC 116
      if (d.cnae_fiscal) {
        const primario: CnaeItem = { codigo: d.cnae_fiscal, descricao: d.cnae_fiscal_descricao ?? '' };
        setCnaePrimario(primario);
        const secundarios: CnaeItem[] = (d.cnaes_secundarios ?? []).map(
          (c: { codigo: number; descricao: string }) => ({ codigo: c.codigo, descricao: c.descricao }),
        );
        setCnaesSecundarios(secundarios);

        // Auto-seleciona o primeiro LC 116 sugerido pelo CNAE principal
        const sugestoes = sugerirLC116(d.cnae_fiscal);
        if (sugestoes.length > 0 && !defaultItem) setItemSelecionado(sugestoes[0] ?? '');
      }

      setCnpjStatus('ok');
      setCnpjMsg(`${d.descricao_situacao_cadastral ?? 'Encontrado'} — dados preenchidos automaticamente`);
    } catch {
      setCnpjStatus('error');
      setCnpjMsg('Serviço de consulta indisponível. Preencha manualmente.');
    }
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatDocument(e.target.value);
    setCnpj(formatted);
    if (isCompleteDocument(formatted)) buscarCnpj(formatted);
    else { setCnpjStatus('idle'); setCnpjMsg(''); }
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="ambiente" value="producao" />

      {/* ── Identificação ── */}
      <div className="space-y-4">
        <SectionTitle icon={Building2}>Identificação da empresa</SectionTitle>

        {/* CNPJ — primeiro campo, dispara lookup automático */}
        <div>
          <label className={labelCls}>CNPJ do prestador</label>
          <div className="relative mt-1">
            <input
              name="cnpj"
              value={cnpj}
              onChange={handleCnpjChange}
              placeholder="00.000.000/0001-00 (ou alfanumérico)"
              className={`${inputCls} pr-10 ${
                cnpjStatus === 'ok' ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20' :
                cnpjStatus === 'error' ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''
              }`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {cnpjStatus === 'loading' && (
                <svg className="h-4 w-4 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {cnpjStatus === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {cnpjStatus === 'error' && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </span>
          </div>
          {cnpjMsg && (
            <p className={`mt-1 text-xs ${cnpjStatus === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
              {cnpjMsg}
            </p>
          )}
          {cnpjStatus === 'idle' && (
            <p className={hintCls}>Digite o CNPJ — os dados serão preenchidos automaticamente pela Receita Federal</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Razão social</label>
            <input name="razao" value={razao} onChange={e => setRazao(e.target.value)} placeholder="Empresa Contábil LTDA" className={`mt-1 ${inputCls}`} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Nome fantasia</label>
            <input name="nomeFantasia" value={fantasia} onChange={e => setFantasia(e.target.value)} placeholder="Nome fantasia (opcional)" className={`mt-1 ${inputCls}`} />
          </div>

          <div className="flex-1">
            <label className={labelCls}>Regime Tributário</label>
            <select
              name="regimeApuracao"
              className={inputCls}
              value={regime}
              onChange={e => setRegime(e.target.value)}
            >
              <option value="1">Não Optante (Lucro Presumido/Real)</option>
              <option value="2">Simples Nacional (MEI)</option>
              <option value="3">Simples Nacional (ME/EPP)</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>
              Inscrição Municipal (IM)
              <span className="ml-1 text-xs font-normal text-muted-foreground">(opcional)</span>
              <Tip>Número fornecido pela prefeitura. Com o portal nacional de NFS-e, a IM não é mais obrigatória para emissão.</Tip>
            </label>
            <input name="im" defaultValue={c?.inscricaoMunicipal ?? ''} placeholder="Ex.: 123456-7" className={`mt-1 ${inputCls}`} />
          </div>

          <div>
            <label className={labelCls}>
              Regime especial de tributação
              <Tip>Regra diferenciada de recolhimento de ISS. Se não tem regime especial, selecione "Nenhum".</Tip>
            </label>
            <select name="regimeEspecial" defaultValue={c?.regimeEspecial ?? ''} className={`mt-1 ${inputCls}`}>
              {REGIME_ESPECIAL.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>


          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:border-slate-700">
              <input type="checkbox" name="emitirExterior" defaultChecked={c?.emitirExterior ?? false} className="h-4 w-4 accent-brand-500" />
              <div>
                <p className="text-sm font-medium">Emitir NFS-e para clientes no exterior</p>
                <p className="text-xs text-slate-400">Exportação de serviços — afeta a natureza da operação na DPS</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* ── Sugestões LC 116 por CNAE ── */}
      <CnaeSugestoes
        cnaePrimario={cnaePrimario}
        cnaesSecundarios={cnaesSecundarios}
        itemSelecionado={itemSelecionado}
        onSelect={code => { setItemSelecionado(code); setItemCustom(false); }}
      />

      {/* ── Endereço ── */}
      <div className="space-y-4">
        <SectionTitle icon={MapPin}>Endereço</SectionTitle>
        <p className={hintCls}>Preenchido automaticamente pelo CNPJ. O endereço é obrigatório no XML da DPS.</p>

        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className={labelCls}>CEP</label>
            <input
              name="cep"
              inputMode="numeric"
              value={cep}
              onChange={e => setCep(formatCEP(e.target.value))}
              placeholder="00000-000"
              className={`mt-1 ${inputCls}`}
            />
          </div>

          <div className="sm:col-span-4">
            <label className={labelCls}>Logradouro</label>
            <input name="logradouro" value={logradouro} onChange={e => setLogradouro(e.target.value)} placeholder="Rua, Av, etc." className={`mt-1 ${inputCls}`} />
          </div>

          <div className="sm:col-span-1">
            <label className={labelCls}>Número</label>
            <input name="numero" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex.: 123" className={`mt-1 ${inputCls}`} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Complemento</label>
            <input name="complemento" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Sala, andar... (opcional)" className={`mt-1 ${inputCls}`} />
          </div>

          <div className="sm:col-span-3">
            <label className={labelCls}>Bairro</label>
            <input name="bairro" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro" className={`mt-1 ${inputCls}`} />
          </div>

          <div className="sm:col-span-4">
            <label className={labelCls}>
              Município (código IBGE)
              <Tip>Código de 7 dígitos do município. Ex.: <strong>4106902</strong> Curitiba, <strong>3550308</strong> São Paulo.</Tip>
            </label>
            <input
              name="cmun"
              inputMode="numeric"
              value={codigoMunicipio}
              onChange={e => setCodigoMunicipio(e.target.value.replace(/\D/g, '').slice(0, 7))}
              placeholder="Ex.: 4106902"
              className={`mt-1 ${inputCls}`}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>UF</label>
            <select name="uf" value={uf} onChange={e => setUf(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="">Selecione</option>
              {UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Contato ── */}
      <div className="space-y-4">
        <SectionTitle icon={Phone}>Contato</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>E-mail</label>
            <input name="emailContato" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com.br" className={`mt-1 ${inputCls}`} />
          </div>
          <div>
            <label className={labelCls}>Telefone</label>
            <input
              name="telefone"
              inputMode="tel"
              value={telefone}
              onChange={e => setTelefone(formatTelefone(e.target.value))}
              placeholder="(00) 00000-0000"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>
      </div>

      <Feedback state={state} />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {pending ? 'Salvando…' : 'Salvar cadastro fiscal'}
        </button>
      </div>
    </form>
  );
}

// ── Seção: Certificado A1 ─────────────────────────────────────────────────────

function CertificadoA1({ temCert }: { temCert: boolean }) {
  const [state, action, pending] = useActionState(uploadCertAction, certInitial);
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasCert, setHasCert] = useState(temCert);

  function handleRemove() {
    if (!confirm('Remover o certificado salvo?')) return;
    startTransition(async () => {
      await removeCertAction();
      setHasCert(false);
    });
  }

  return (
    <div className="space-y-4">
      {/* Status atual */}
      <div className={`flex items-center justify-between rounded-2xl p-4 ${
        hasCert
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'bg-amber-500/10 border border-amber-500/20'
      }`}>
        <div className="flex items-center gap-3">
          <Key className={`h-5 w-5 ${hasCert ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div>
            <p className={`text-xs font-bold ${hasCert ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
              {hasCert ? 'Certificado A1 configurado' : 'Nenhum certificado configurado'}
            </p>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              {hasCert
                ? 'Certificado validado e armazenado. Notas serão enviadas ao Emissor Nacional.'
                : 'Sem certificado a emissão fica em modo teste (mock).'}
            </p>
          </div>
        </div>
        {hasCert && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        )}
      </div>

      {/* Formulário de upload */}
      <form action={action} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Arquivo do certificado (.pfx ou .p12)</label>
          <div
            className="mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/10 dark:border-white/10 p-6 text-center transition hover:border-[#2F4A3C] bg-white/40 dark:bg-black/20"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-slate-400" />
            {fileName
              ? <p className="text-xs font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{fileName}</p>
              : <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Clique para selecionar ou arraste o arquivo aqui</p>
            }
            <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Formatos aceitos: .pfx, .p12 — Máx. 1 MB</p>
            <input
              ref={fileRef}
              type="file"
              name="pfx"
              accept=".pfx,.p12"
              className="hidden"
              onChange={e => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Senha do certificado</label>
          <input
            type="password"
            name="certSenha"
            autoComplete="off"
            placeholder="Senha definida ao gerar o certificado"
            className="mt-1 w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-xs text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]"
          />
          <p className="mt-1 text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">A senha é validada localmente antes de ser salva</p>
        </div>

        <Feedback state={state} />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || !fileName}
            className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {pending ? 'Validando e salvando…' : 'Enviar certificado'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Seção: Perfis Fiscais ─────────────────────────────────────────────────────

function PerfisFiscais({ profiles, config }: { profiles: any[], config: NfseConfig | null }) {
  const [pending, startTransition] = useTransition();
  const [techState, techAction, techPending] = useActionState(saveTecnicaAction, { ok: false, message: '' });
  const [editingProfile, setEditingProfile] = React.useState<any>(null);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (editingProfile) {
      fd.append('id', editingProfile.id);
    }
    startTransition(async () => {
      const res = await createProfileAction({ ok: false, message: '' }, fd);
      if (res.ok) {
        alert(editingProfile ? 'Perfil atualizado!' : 'Perfil criado!');
        setEditingProfile(null);
        // Reseta o form visualmente se for novo
        if (!editingProfile) (e.target as HTMLFormElement).reset();
      } else {
        alert(res.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Remover perfil?')) return;
    startTransition(async () => {
      const res = await deleteProfileAction(id);
      if (res.ok) alert('Perfil removido!');
      else alert(res.message);
    });
  }

  function handleEdit(p: any) {
    setEditingProfile(p);
    // Rola para o formulário
    document.getElementById('perfil-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingProfile(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[#2F4A3C] dark:text-[#DFFFAE]">
        <Building2 className="h-5 w-5" />
        <h3 className="font-serif font-bold text-base">Perfis Fiscais de Serviço</h3>
      </div>
      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        Cadastre diferentes tipos de serviço para escolher rapidamente na hora de emitir a nota.
      </p>

      {profiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {profiles.map(p => (
            <div key={p.id} className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-4 relative shadow-sm">
              <h4 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">{p.nome}</h4>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">Item: {p.itemListaServico}</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">CNAE: {p.cnae || '-'}</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Tributação: {p.codigoTributacaoMunicipio || '-'}</p>
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(p)}
                  className="rounded-full p-1 text-[#6E6A61] hover:text-[#2F4A3C]"
                  title="Editar Perfil"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="rounded-full p-1 text-[#6E6A61] hover:text-red-600"
                  title="Excluir Perfil"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Configuração técnica global ── */}
      <form action={techAction} className="mt-8 space-y-4">
        <h4 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Emissão e Numeração</h4>
        <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-black/5 dark:border-white/10 p-5 bg-[#FEFDF3] dark:bg-[#121614]">
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Série da NF</label>
            <input name="serie" defaultValue={config?.serieDps ?? '00001'} placeholder="00001" className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Próxima Numeração</label>
            <input name="proxNumeroDps" type="number" defaultValue={config?.proxNumeroDps ?? 1} placeholder="1" className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div className="sm:col-span-2">
             <button type="submit" disabled={techPending} className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-5 py-2 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
               {techPending ? 'Salvando...' : 'Salvar Numeração'}
             </button>
             {techState.message && (
               <p className={`mt-2 text-xs font-bold ${techState.ok ? 'text-emerald-600' : 'text-red-500'}`}>{techState.message}</p>
             )}
          </div>
        </div>
      </form>

      <form id="perfil-form" onSubmit={handleSave} className="mt-8 rounded-2xl border border-black/5 dark:border-white/10 p-5 bg-[#FEFDF3] dark:bg-[#121614] space-y-4">
        <h4 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">
          {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Nome do Perfil</label>
            <input name="nome" required placeholder="Ex: Consultoria" defaultValue={editingProfile?.nome || ''} className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Item LC 116 (Ex: 17.19)</label>
            <input name="item" required placeholder="17.19" defaultValue={editingProfile?.itemListaServico || ''} className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">CNAE (opcional)</label>
            <input name="cnae" placeholder="6204000" defaultValue={editingProfile?.cnae || ''} className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Cód. Tributação Município</label>
            <input name="ctrib" placeholder="Ex: 01234" defaultValue={editingProfile?.codigoTributacaoMunicipio || ''} className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Alíquota ISS (%) (opcional)</label>
            <input name="aliquota" placeholder="3.5" defaultValue={editingProfile?.aliquotaIss || ''} className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]">Descrição Padrão do Serviço (opcional)</label>
            <textarea name="defaultDescription" placeholder="Texto preenchido automaticamente ao selecionar este perfil" defaultValue={editingProfile?.defaultDescription || ''} className="w-full rounded-2xl border border-black/10 dark:border-white/10 px-3.5 py-2 text-xs bg-white dark:bg-[#1A201C]" rows={2} />
          </div>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105">
            {pending ? 'Salvando...' : (editingProfile ? 'Salvar Alterações' : 'Adicionar Perfil')}
          </button>
          {editingProfile && (
            <button type="button" onClick={handleCancelEdit} className="rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-5 py-2 text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5">
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Componente principal com abas ─────────────────────────────────────────────

type Tab = 'empresa' | 'certificado' | 'perfil';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'empresa',      label: 'Dados da empresa',  icon: Building2 },
  { id: 'perfil',       label: 'Perfis Fiscais',     icon: FileText },
  { id: 'certificado',  label: 'Certificado A1',     icon: Key },
];

export function FiscalForm({ config, temCert, profiles }: { config: NfseConfig | null; temCert: boolean; profiles?: any[] }) {
  const [tab, setTab] = useState<Tab>('empresa');

  return (
    <div className="space-y-6">
      {/* Abas em Pílula com Moldura e Transição Suave */}
      <div className="flex">
        <SegmentedTabs
          tabs={[
            { id: 'empresa', label: 'Dados da empresa', icon: Building2 },
            { id: 'perfil', label: 'Perfis Fiscais', icon: FileText },
            {
              id: 'certificado',
              label: 'Certificado A1',
              icon: Key,
              badge: <span className={`inline-block h-2 w-2 rounded-full ${temCert ? 'bg-emerald-500' : 'bg-amber-400'}`} />,
            },
          ]}
          activeTab={tab}
          onChange={setTab}
          layoutId="fiscalTabsIndicator"
        />
      </div>

      {/* Conteúdo */}
      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        {tab === 'empresa' && <DadosEmpresa config={config} />}
        {tab === 'perfil' && <PerfisFiscais profiles={profiles ?? []} config={config} />}
        {tab === 'certificado' && <CertificadoA1 temCert={temCert} />}
      </div>
    </div>
  );
}
