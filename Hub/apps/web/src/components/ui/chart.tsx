'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

export type ChartConfig = {
  [k: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<string, string> }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }
  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  id?: string;
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-black/5 dark:[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-white/5 [&_.recharts-reference-line-line]:stroke-border [&_.recharts-pie-label-text]:fill-foreground [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(config)
          .map(([key, item]) => {
            const color = item.color;
            return color ? `[data-chart="${id}"] { --color-${key}: ${color}; }` : '';
          })
          .join('\n'),
      }}
    />
  );
};

export const ChartTooltip = RechartsPrimitive.Tooltip;

export type ChartTooltipContentProps = {
  active?: boolean;
  payload?: any[];
  className?: string;
  indicator?: 'dot' | 'line' | 'dashed';
  hideLabel?: boolean;
  label?: string | number;
  labelFormatter?: (label: any, payload: any[]) => React.ReactNode;
  formatter?: (value: any, name: any, item: any, index: number, payload: any[]) => React.ReactNode;
};

export function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = 'dot',
  hideLabel = false,
  label,
  labelFormatter,
  formatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#1A201C] p-2.5 text-xs text-[#231F20] dark:text-[#FEFDF3] shadow-lg',
        className
      )}
    >
      {!hideLabel && (
        <div className="font-semibold text-[11px] text-[#6E6A61] dark:text-[#A8A49C] border-b border-black/5 dark:border-white/5 pb-1 mb-1">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </div>
      )}
      <div className="grid gap-1.5">
        {payload.map((item: any, index: number) => {
          const key = `${item.name || item.dataKey || 'value'}`;
          const itemConfig = config[key];
          const indicatorColor = item.payload?.fill || item.color || itemConfig?.color;

          return (
            <div
              key={item.dataKey || index}
              className="flex w-full flex-wrap items-center justify-between gap-2"
            >
              <div className="flex items-center gap-1.5">
                {indicator === 'dot' && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: indicatorColor }}
                  />
                )}
                <span className="text-[#6E6A61] dark:text-[#A8A49C]">
                  {itemConfig?.label || item.name}
                </span>
              </div>
              <span className="font-semibold tabular-nums text-[#231F20] dark:text-[#FEFDF3]">
                {formatter ? formatter(item.value, item.name, item, index, payload) : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
