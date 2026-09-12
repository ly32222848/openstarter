// 零依赖原生 SVG 双折线图（如授予/消耗两条序列）。
// 取代 shadcn chart.tsx（recharts ~100KB gzip），仪表盘按需加载也省不掉这笔体积。
// 交互：透明覆盖层捕获指针/焦点 → 十字准星 + 气泡读数（列出全部序列）；
// 键盘 ←/→/Home/End 步进，读数走 slider 的 aria-valuetext。
// 色板只验证了两组（light/dark 双模式 5 项全过，见 dataviz validate_palette），
// 序列数超过 2 之前必须先补验配色。

import * as React from "react";

import { cn } from "@openstarter/ui-web/lib/utils";

import { buildMonotonePath, niceScale } from "./line-chart-utils";

export interface LineChartSeries {
  /** data 项上的取值键。 */
  dataKey: string;
  /** 图例/读数中的序列名。 */
  label: string;
}

/** data 项：须含字符串 date 键；序列值经 Number() 取值，接口无需索引签名。 */
export interface LineChartPoint {
  date: string;
}

const CHART_HEIGHT = 240;
const PADDING = { bottom: 28, left: 48, right: 16, top: 16 };
const Y_TICK_COUNT = 4;
/** 气泡估算尺寸：钳位/翻转用，无需精确。 */
const TOOLTIP_HALF_WIDTH = 72;
const TOOLTIP_ESTIMATED_HEIGHT = 72;

/** 序列色板：slot-1 蓝（沿用 app --chart-2）+ slot-2 橙（暗底按表面提亮）。 */
const paletteStyle = `
[data-slot="line-chart"] { --line-chart-1: #3a81f6; --line-chart-2: #eb6834; }
.dark [data-slot="line-chart"] { --line-chart-2: #d95926; }
`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 序列取值：LineChartPoint 只约束 date 键，数值键经断言读取。 */
function seriesValue(point: LineChartPoint, dataKey: string): number {
  return Number((point as unknown as Record<string, unknown>)[dataKey]) || 0;
}

function formatValue(value: unknown): string {
  return Number(value ?? 0).toLocaleString();
}

export function LineChart({
  ariaLabel,
  className,
  data,
  dateLabel,
  formatTickLabel,
  series,
}: {
  /** 覆盖层（slider 语义）的无障碍名，调用方传本地化文案。 */
  ariaLabel: string;
  className?: string;
  data: readonly LineChartPoint[];
  /** 表视图日期列头（本地化）。 */
  dateLabel: string;
  /** x 轴刻度文案（默认原样显示 date）。 */
  formatTickLabel?: (value: string) => string;
  series: readonly LineChartSeries[];
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  // null = 未激活（无准星/气泡）；数字 = 当前命中的数据下标。
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  // 无 SSR 依赖：jsdom 下 ResizeObserver 缺失时保持 width=0，跳过绘图层。
  React.useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((previous) => (Math.abs(previous - next) < 0.5 ? previous : next));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const plot = React.useMemo(() => {
    if (width <= 0 || data.length === 0 || series.length === 0) {
      return null;
    }
    const innerWidth = width - PADDING.left - PADDING.right;
    const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    if (innerWidth <= 0) {
      return null;
    }
    const max = Math.max(
      0,
      ...data.flatMap((point) => series.map((item) => seriesValue(point, item.dataKey))),
    );
    const { ticks, top } = niceScale(max, Y_TICK_COUNT);
    const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;
    const xAt = (index: number) => PADDING.left + index * stepX;
    const yAt = (value: number) => PADDING.top + innerHeight - (value / top) * innerHeight;
    const lines = series.map((item, slot) => {
      const points = data.map((point, index) => ({
        x: xAt(index),
        y: yAt(seriesValue(point, item.dataKey)),
      }));
      return {
        ...item,
        color: `var(--line-chart-${slot + 1})`,
        path: buildMonotonePath(points),
        points,
      };
    });

    // x 轴刻度：目标 3-7 个、间距均匀；末点必现，且与前一刻度距离不足时并入末点。
    const targetTicks = clamp(Math.round(innerWidth / 110), 3, 7);
    const stride = Math.max(1, Math.ceil((data.length - 1) / (targetTicks - 1)));
    const tickIndexes: number[] = [];
    for (let index = 0; index < data.length; index += stride) {
      tickIndexes.push(index);
    }
    const lastIndex = data.length - 1;
    const lastTick = tickIndexes[tickIndexes.length - 1] ?? 0;
    if (tickIndexes.length > 1 && lastIndex - lastTick < stride * 0.4) {
      tickIndexes.pop();
    }
    if ((tickIndexes[tickIndexes.length - 1] ?? 0) !== lastIndex) {
      tickIndexes.push(lastIndex);
    }

    return { innerHeight, lines, stepX, tickIndexes, ticks, top, xAt, yAt };
  }, [data, series, width]);

  const indexFromClientX = React.useCallback(
    (clientX: number): number | null => {
      if (data.length === 0) {
        return null;
      }
      const element = containerRef.current;
      if (!element || !plot || plot.stepX === 0) {
        return 0;
      }
      const rect = element.getBoundingClientRect();
      return clamp(
        Math.round((clientX - rect.left - PADDING.left) / plot.stepX),
        0,
        data.length - 1,
      );
    },
    [data.length, plot],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (data.length === 0) {
      return;
    }
    const lastIndex = data.length - 1;
    const current = activeIndex ?? -1;
    const nextIndex: number | null | undefined =
      event.key === "ArrowRight"
        ? Math.min(current + 1, lastIndex)
        : event.key === "ArrowLeft"
          ? Math.max(current - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : event.key === "Escape"
                ? null
                : undefined;
    if (nextIndex === undefined) {
      return;
    }
    event.preventDefault();
    setActiveIndex(nextIndex);
  };

  const pointIndex = activeIndex === null ? 0 : clamp(activeIndex, 0, data.length - 1);
  const active = activeIndex !== null && plot ? data[pointIndex] : null;
  const activeX = plot ? plot.xAt(pointIndex) : 0;
  const tooltipLeft = plot ? clamp(activeX, TOOLTIP_HALF_WIDTH, width - TOOLTIP_HALF_WIDTH) : 0;
  // 气泡纵向锚点：默认放在激活点上方，顶部放不下时翻到下方。
  const anchorYs = plot ? plot.lines.map((l) => l.points[pointIndex]?.y ?? 0) : [];
  const anchorAbove = anchorYs.length > 0 ? Math.min(...anchorYs) : 0;
  const anchorBelow = anchorYs.length > 0 ? Math.max(...anchorYs) : 0;
  const flip = anchorAbove < TOOLTIP_ESTIMATED_HEIGHT;

  return (
    <div ref={containerRef} data-slot="line-chart" className={cn("relative w-full", className)}>
      <style>{paletteStyle}</style>
      {/* 图例：恒显（≥2 序列时颜色不是唯一识别通道）。 */}
      <div className="mb-2 flex items-center gap-4 text-xs">
        {series.map((item, slot) => (
          <span className="flex items-center gap-1.5" key={item.dataKey}>
            <span
              aria-hidden="true"
              className="h-0.5 w-3 rounded-full"
              style={{ backgroundColor: `var(--line-chart-${slot + 1})` }}
            />
            <span className="text-muted-foreground">{item.label}</span>
          </span>
        ))}
      </div>

      {/* 数据表：图形的无障碍孪生（sr-only），读数/键盘之外的兜底。 */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{dateLabel}</th>
            {series.map((item) => (
              <th key={item.dataKey} scope="col">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <td>{point.date}</td>
              {series.map((item) => (
                <td key={item.dataKey}>{seriesValue(point, item.dataKey).toLocaleString()}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="relative" style={{ height: CHART_HEIGHT }}>
        {plot ? (
          <svg aria-hidden="true" height={CHART_HEIGHT} width={width}>
            {/* 横向网格：发丝线、实线、退居其后；y 刻度取整洁步长。 */}
            {plot.ticks.map((tick) => (
              <g key={tick}>
                <line
                  stroke="var(--border)"
                  x1={PADDING.left}
                  x2={width - PADDING.right}
                  y1={plot.yAt(tick)}
                  y2={plot.yAt(tick)}
                />
                <text
                  className="fill-muted-foreground font-mono"
                  fontSize="10"
                  textAnchor="end"
                  x={PADDING.left - 8}
                  y={plot.yAt(tick) + 3}
                >
                  {tick.toLocaleString()}
                </text>
              </g>
            ))}
            {plot.tickIndexes.map((index) => (
              <text
                className="fill-muted-foreground font-mono"
                fontSize="10"
                key={index}
                textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}
                x={plot.xAt(index)}
                y={CHART_HEIGHT - 8}
              >
                {formatTickLabel
                  ? formatTickLabel(data[index]?.date ?? "")
                  : (data[index]?.date ?? "")}
              </text>
            ))}
            {/* 十字准星：读者瞄准日期而非 2px 的线。 */}
            {active && (
              <line
                stroke="var(--muted-foreground)"
                strokeOpacity={0.45}
                x1={activeX}
                x2={activeX}
                y1={PADDING.top}
                y2={CHART_HEIGHT - PADDING.bottom}
              />
            )}
            {plot.lines.map((line) => (
              <g key={line.dataKey}>
                <path
                  d={line.path}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  stroke={line.color}
                />
                {/* 线端点标 + 2px 表面环：只标末点，避免逐点数值噪声。 */}
                <circle
                  cx={line.points[line.points.length - 1]?.x ?? 0}
                  cy={line.points[line.points.length - 1]?.y ?? 0}
                  fill={line.color}
                  r={4}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
                {active && (
                  <circle
                    cx={line.points[pointIndex]?.x ?? 0}
                    cy={line.points[pointIndex]?.y ?? 0}
                    fill={line.color}
                    r={4}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                )}
              </g>
            ))}
          </svg>
        ) : (
          <div aria-hidden="true" style={{ height: CHART_HEIGHT }} />
        )}

        {/* 交互覆盖层：slider 语义，指针与键盘共用同一读数通道。 */}
        <div
          aria-label={ariaLabel}
          aria-orientation="horizontal"
          aria-valuemax={data.length > 0 ? data.length : undefined}
          aria-valuemin={data.length > 0 ? 1 : undefined}
          aria-valuenow={activeIndex !== null ? pointIndex + 1 : undefined}
          aria-valuetext={
            active
              ? `${active.date}: ${series
                  .map((item) => `${item.label} ${formatValue(seriesValue(active, item.dataKey))}`)
                  .join(", ")}`
              : undefined
          }
          className="focus-visible:outline-none"
          onBlur={() => setActiveIndex(null)}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setActiveIndex(null)}
          onMouseMove={(event) => {
            const index = indexFromClientX(event.clientX);
            if (index !== null) {
              setActiveIndex(index);
            }
          }}
          role="slider"
          style={{
            bottom: PADDING.bottom,
            left: PADDING.left,
            position: "absolute",
            right: PADDING.right,
            top: PADDING.top,
          }}
          tabIndex={0}
        />

        {active ? (
          // 视觉气泡：读数以 slider 的 aria-valuetext 为准，这里不进无障碍树。
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute z-10 grid min-w-36 -translate-x-1/2 gap-1 rounded-md border border-border/50 bg-popover px-2.5 py-1.5 text-xs shadow-md",
              flip ? "translate-y-0" : "-translate-y-full",
            )}
            style={{ left: tooltipLeft, top: flip ? anchorBelow + 10 : anchorAbove - 10 }}
          >
            <div className="font-mono text-muted-foreground">{active.date}</div>
            {series.map((item, slot) => (
              <div className="flex items-center justify-between gap-3" key={item.dataKey}>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="h-0.5 w-3 rounded-full"
                    style={{ backgroundColor: `var(--line-chart-${slot + 1})` }}
                  />
                  {item.label}
                </span>
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {formatValue(seriesValue(active, item.dataKey))}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
