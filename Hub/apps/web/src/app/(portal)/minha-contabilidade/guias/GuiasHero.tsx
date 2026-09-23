'use client';

import { SectionHero } from '@/components/ui/SectionHero';

interface GuiasHeroProps {
  selectedMonth?: string;
  monthLabel?: string;
  isCurrentMonth?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onCurrentMonth?: () => void;
  rightSlot?: React.ReactNode;
  subtitulo?: React.ReactNode;
}

export function GuiasHero(props: GuiasHeroProps) {
  const { rightSlot, ...heroProps } = props;
  return (
    <SectionHero
      title="Central de Guias"
      infoTitle="Sobre a Central de Guias"
      infoDescription="Acompanhe toda a sua jornada de impostos do mês de forma simples. DAS, DARF, ISS e parcelamentos centralizados em um só lugar."
      showMonthSelector={false}
      moldura={false}
      rightSlot={rightSlot}
      {...heroProps}
    />
  );
}
