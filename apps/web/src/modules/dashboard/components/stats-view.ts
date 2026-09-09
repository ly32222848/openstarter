// 仪表盘数据视图类型：packages/api `DashboardStats` 的客户端镜像（含 balance 聚合）。
// API 侧把 getBalance 与 getDashboardStats 的结果合并下发，这里描述最终信封数据。

export interface DashboardTrendPoint {
  consumed: number;
  date: string;
  granted: number;
}

export interface DashboardSpendTotal {
  currency: string;
  total: number;
}

export interface DashboardStats {
  activeApiKeys: number;
  balance: number;
  creditsConsumed30d: number;
  creditsGranted30d: number;
  ordersCount: number;
  paidOrdersCount: number;
  spendTotal: DashboardSpendTotal | null;
  trend: DashboardTrendPoint[];
}
