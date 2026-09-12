// 折线图纯几何工具：刻度计算 + 单调三次样条路径。零依赖，便于单测。
// 之所以单调（PCHIP / Fritsch–Carlson）而非普通 Catmull-Rom：计数值恒 ≥ 0，曲线若在
// 相邻点间下冲穿过基线就会「画出数据里不存在的负值」。单调插值保证段内不越界。

export interface Point {
  x: number;
  y: number;
}

/**
 * 以 0 为下界，给 [0, max] 求一组「好看」的刻度上界与步长。
 * 步长取 1/2/2.5/5 × 10^k，上界向上取整到步长倍数，保证顶格网格线 ≥ 最大值。
 */
export function niceScale(max: number, count = 4): { step: number; ticks: number[]; top: number } {
  if (!Number.isFinite(max) || max <= 0) {
    return { step: 1, ticks: [0, 1], top: 1 };
  }
  const rawStep = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // 用整数计数迭代，避免浮点累加漂出 top。
  const tickCount = Math.round(top / step);
  for (let i = 0; i <= tickCount; i += 1) {
    ticks.push(Number((i * step).toFixed(10)));
  }
  return { step, ticks, top };
}

/**
 * 单调三次样条（PCHIP）→ 三次贝塞尔 SVG path。
 * 输入点须按 x 升序（等距或不等距皆可）；切线受 3× 局部割线约束，段内不越出端点区间。
 */
export function buildMonotonePath(points: Point[]): string {
  const n = points.length;
  const first = points[0];
  if (n === 0 || !first) return "";
  if (n === 1) return `M ${fmt(first.x)} ${fmt(first.y)}`;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const at = (array: number[], index: number) => array[index] ?? 0;

  // 割线斜率 delta[i] = (y[i+1]-y[i])/(x[i+1]-x[i])。
  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = at(xs, i + 1) - at(xs, i);
    deltas.push(dx === 0 ? 0 : (at(ys, i + 1) - at(ys, i)) / dx);
  }

  // 初始切线（PCHIP 规则）：局部极值处（两侧割线异号或任一为 0）切线取 0，
  // 否则曲线会在峰/谷处越出端点区间；其余取两侧割线均值。
  const tangents: number[] = [];
  for (let i = 0; i < n; i += 1) {
    if (i === 0) tangents.push(at(deltas, 0));
    else if (i === n - 1) tangents.push(at(deltas, n - 2));
    else {
      const dPrev = at(deltas, i - 1);
      const dNext = at(deltas, i);
      tangents.push(dPrev * dNext <= 0 ? 0 : (dPrev + dNext) / 2);
    }
  }

  // Fritsch–Carlson 修正：强制 |切线| 不超过 3× 局部割线，消除越界摆动。
  for (let i = 0; i < n - 1; i += 1) {
    const delta = at(deltas, i);
    if (delta === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const alpha = at(tangents, i) / delta;
    const beta = at(tangents, i + 1) / delta;
    const hypot = Math.hypot(alpha, beta);
    if (hypot > 3) {
      const tau = 3 / hypot;
      tangents[i] = tau * alpha * delta;
      tangents[i + 1] = tau * beta * delta;
    }
  }

  const segments: string[] = [`M ${fmt(first.x)} ${fmt(first.y)}`];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = (at(xs, i + 1) - at(xs, i)) / 3;
    const c1x = at(xs, i) + dx;
    const c1y = at(ys, i) + at(tangents, i) * dx;
    const c2x = at(xs, i + 1) - dx;
    const c2y = at(ys, i + 1) - at(tangents, i + 1) * dx;
    segments.push(
      `C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(at(xs, i + 1))} ${fmt(at(ys, i + 1))}`,
    );
  }
  return segments.join(" ");
}

/** 坐标保留 2 位小数，控制 path 字符串体积与浮点噪声。 */
function fmt(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : "0";
}
