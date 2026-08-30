# 移动端数据分析（@openstarter/analytics-mobile）设计

- 日期：2026-08-31
- 状态：已确认（brainstorming 完成后的定稿）
- 范围：`packages/analytics/mobile`（新包）、`packages/shared/src/config.ts`（三个配置键）、
  `packages/api/src/modules/admin/analytics/service.ts`（公开配置扩展）、`apps/mobile`（接入）、
  `apps/mobile` Firebase 构建文件与本地 config plugin

## 1. 目标与非目标

**目标**

1. 移动端（apps/mobile）具备两条独立可开关的分析上报通道：
   - **OpenPanel**（产品分析）：官方 RN SDK `@openpanel/react-native`（v1.4.1），
     `track` / `identify` / 屏幕事件。
   - **Google Analytics 4**（`@react-native-firebase/analytics` v26.3.2）：
     自动屏幕/会话之外补齐显式 `logEvent` / `setUserId` / `logScreenView` 映射。
2. 配置由管理后台（Analytics 标签页）统一管理，经公开端点 `GET /api/analytics/config`
   下发，web 与 mobile 消费同一端点。
3. 未配置任何供应商 / 未安装 Firebase 配置文件的 fork 者：零影响，构建可过、运行时安全。

**非目标**

- 不做真实外部上报的 E2E 测试（外部服务，mock 层覆盖映射正确性即可）。
- 不做 web 侧脚本注入的任何改动（现有 `buildAnalyticsHeadScripts` 不动）。
- 不新增 .env 变量（全部走 admin 后台 config 表）。
- 不做离线事件队列的自研实现（OpenPanel SDK 自带；GA 通道离线缓存不做）。

## 2. 已确认的决策

| # | 决策点 | 结论 |
|---|---|---|
| 1 | OpenPanel clientSecret 进客户端 | 接受官方 SDK 做法（A）：secret 经公开端点下发；OpenPanel 面板可随时轮换 |
| 2 | GA 移动端方案 | `@react-native-firebase/analytics`（自动 screen_view/会话；需 Firebase 构建文件） |
| 3 | Firebase 配置文件 | 不入库：gitignore + `.example` 模板；运行时条件初始化，`ga_mobile_enabled` 开关控制 |
| 4 | 配置下发通道 | 扩展 `GET /api/analytics/config`（A）：分析配置单一出口 |
| 5 | 包结构 | 方案 1：单包双适配器 + 门面（与 billing-mobile 多 SDK 聚合先例同构） |

## 3. 包结构（packages/analytics/mobile）

```
packages/analytics/mobile/
├── package.json            # @openstarter/analytics-mobile
├── tsconfig.json           # extends tsconfig.base.json（无 jsx 需求）
├── vitest.config.ts        # node environment，name: "analytics-mobile"
└── src/
    ├── index.ts            # 门面导出（唯一消费入口）
    ├── facade.ts           # initAnalytics / track / identify / setUserId / setScreenName
    ├── config.ts           # PublicAnalyticsConfig 响应 → MobileAnalyticsConfig 解析
    ├── facade.test.ts
    ├── config.test.ts
    └── providers/
        ├── types.ts        # AnalyticsProvider 接口
        ├── noop.ts         # 未配置任何供应商时的空实现
        ├── openpanel.ts    # OpenPanel 实现（动态 import）
        ├── openpanel.test.ts
        ├── firebase.ts     # GA 实现（动态 import）
        └── firebase.test.ts
```

**package.json 依赖声明**：

```jsonc
{
  "dependencies": { "@openstarter/shared": "workspace:*" },
  "peerDependencies": {
    "@openpanel/react-native": "*",
    "@react-native-firebase/app": "*",
    "@react-native-firebase/analytics": "*",
    "expo-application": "*",
    "expo-constants": "*",
    "react": "*",
    "react-native": "*"
  },
  "peerDependenciesMeta": {
    // 分析 SDK 三个 optional：消费方按需安装，未安装的 provider 在动态 import 时降级跳过。
    // expo-application / expo-constants 非 optional：expo 应用必有，且是 OP SDK 的运行前提。
    "@openpanel/react-native": { "optional": true },
    "@react-native-firebase/app": { "optional": true },
    "@react-native-firebase/analytics": { "optional": true }
  }
}
```

`exports` 映射照抄 `@openstarter/billing-mobile`（`.` → `./src/index.ts`，`./*` → `./src/*.ts`）。

## 4. Provider 接口与门面语义

**接口**（`providers/types.ts`）：

```ts
export interface AnalyticsProvider {
  readonly name: "openpanel" | "firebase" | "noop";
  init(): Promise<void>;
  track(event: string, properties?: Record<string, unknown>): Promise<void>;
  identify(profileId: string, traits?: Record<string, unknown>): Promise<void>;
  setUserId(userId: string | null): Promise<void>;
  setScreenName(name: string, params?: Record<string, unknown>): Promise<void>;
}
```

**门面语义**：

- `initAnalytics(config: MobileAnalyticsConfig): Promise<AnalyticsProvider>`
  - 选择逻辑：`openpanelClientId && openpanelClientSecret` 都非空 → 尝试 OP provider；
    `gaMobileEnabled` → 尝试 firebase provider；两者都成功且双开 → composite（事件遍历转发，
    全部失败/全未配置 → noop；单个失败 → 一次性 `console.warn` 后跳过该 provider，不影响其余）。
  - 幂等：重复调用返回同一实例（模块级缓存槽，整体替换、不就地修改——对齐 analytics-web 的
    configCache 模式）。
  - 返回实际生效的 provider（消费方可据 `provider.name` 打日志）。
- `track()` 等方法在 `initAnalytics` 之前调用是安全 no-op（不引入队列复杂度：mobile 启动流程
  中 init 必然先行）。
- 门面所有方法自身 try/catch：分析上报**永不向业务代码抛错**（与 analytics-web「配置读取失败
  不阻塞渲染」同哲学）。
- warn 去重：同一 provider 的同种错误只 warn 一次。

## 5. Provider 实现要点

### OpenPanel（providers/openpanel.ts）

```ts
const { OpenPanel } = await import("@openpanel/react-native");
const instance = new OpenPanel({
  clientId: config.openpanelClientId,
  clientSecret: config.openpanelClientSecret,
});
```

- `identify(profileId, traits)` → `instance.identify({ profileId, ...顶层字段, properties: 其余 })`；
  适配层做拆分归一（`firstName`/`lastName`/`email` 等官方顶层字段优先，其余进 `properties`），
  消费方不必关心官方签名。
- `track(event, props)` → `instance.track(event, props)`。
- `setUserId` → OpenPanel 无独立概念，映射为 `instance.setGlobalProperties({ userId })`。
- `setScreenName` → `instance.track("screen_view", { screen_name, ...params })`。
- `init()` / 后续调用失败 → provider 进入 failed 态：后续调用静默 no-op + 一次性 warn。

### Firebase（providers/firebase.ts）

- 动态 import `@react-native-firebase/analytics`；`init()` 仅缓存模块引用（RNFirebase 自动启动，
  无显式 init；保持零副作用）。
- `track` → `analytics().logEvent(name, params)`；事件名 sanitize：GA 要求 `/^[A-Za-z0-9_]+$/`
  且 ≤40 字符——**改名发而非丢弃**（非法字符替换为 `_`、超长截断），保证事件不静默丢失。
- `identify` → `setUserProperties({ ...traits })`（GA 无 identify 概念，traits 扁平化）。
- `setUserId` → `analytics().setUserId(userId)`（null → 清除）。
- `setScreenName` → `analytics().logScreenView({ screen_name, ...params })`。
- 每个方法调用 try/catch：缺 `GoogleService-Info.plist` / `google-services.json` 的 fork 者开着
  开关时，调用失败一次性 warn 后进 failed 态，不重复刷屏。

### 错误降级链（汇总）

```
未配置 → noop
配置了但模块缺失/初始化失败 → console.warn 一次 + 该 provider 跳过
双开部分失败 → 其余 provider 照常
任何门面方法内部错误 → 吞掉，不上抛业务层
```

## 6. 配置数据面（API 侧）

**新增配置键**（`packages/shared/src/config.ts`，全部在 `analytics` tab）：

| 键 | group | type | 说明 |
|---|---|---|---|
| `openpanel_client_id` | `openpanel`（新 group） | text | OpenPanel clientId |
| `openpanel_client_secret` | `openpanel` | password | clientSecret（password 型走现有掩码存储/回显机制） |
| `ga_mobile_enabled` | `google_analytics`（复用现有 group） | switch | GA 移动端运行时开关 |

`getSettingGroups()` 增加 `openpanel` 分组（tab 仍为 `analytics`，title "OpenPanel"，
description 说明 RN SDK 官方要求 clientSecret 进客户端、面板可轮换）。

**`getPublicAnalyticsConfig` 扩展**
（`packages/api/src/modules/admin/analytics/service.ts`）：

```ts
export interface PublicAnalyticsConfig {
  googleAnalyticsId: string;      // 现有，不动
  plausibleDomain: string;        // 现有，不动
  plausibleSrc: string;           // 现有，不动
  openpanelClientId: string;      // 新增
  openpanelClientSecret: string;  // 新增
  gaMobileEnabled: boolean;       // 新增：configs.ga_mobile_enabled === "true"
}
```

- `/api/analytics/config` 端点签名不变，响应多三个字段。
- web 侧 `buildAnalyticsHeadScripts` 白名单式读取前三键，多余字段忽略，**无需改动**。
- 安全边界（写进 service 注释）：secret 经公开端点下发是**设计决策**——RN SDK 官方即要求
  clientSecret 进客户端，暴露面与进 app bundle 等价；admin 后台 password 型输入掩码存储；
  OpenPanel 面板可随时轮换。「仅白名单键」约束不变——只加不删。

## 7. apps/mobile 接入

**安装**：

```bash
pnpm --filter mobile add @openstarter/analytics-mobile@workspace:* \
  @openpanel/react-native \
  @react-native-firebase/app @react-native-firebase/analytics
npx expo install expo-application        # OP SDK peer（expo-constants 已有）
```

**消费侧薄壳**（`apps/mobile/src/lib/analytics.ts`，~20 行）：

- `resolveMobileAnalyticsConfig(response)`：RPC 响应 → `MobileAnalyticsConfig`
  （类型来自 `@openstarter/analytics-mobile`）；空 clientId/secret 视为未配置 OP。
- `useScreenTracking()`：`usePathname()` + `useEffect`，pathname 变化时
  `setScreenName(pathname)`（6-8 行）。

**接线点（最小侵入，两处）**：

1. `src/app/_layout.tsx`：`QueryClientProvider` 内加 `useEffect` —— `apiClient.api.analytics
   .config.$get()` → `resolveMobileAnalyticsConfig` → `initAnalytics`。fetch 失败静默跳过
   （= 未配置分析），不引入新 Provider 组件。
2. `(tabs)/_layout.tsx` 与 `(auth)/_layout.tsx`：各一行接入 `useScreenTracking()`。

## 8. Firebase 构建文件与 config plugin

```
apps/mobile/google-services.json.example          # 入库：占位结构 + 注释指向 Firebase 控制台
apps/mobile/GoogleService-Info.plist.example      # 同上
apps/mobile/.gitignore 追加:
  google-services.json
  GoogleService-Info.plist
```

原生工程接线走 **本地 config plugin**（推荐，先例：`6742a0e` 注册 expo-iap plugin）：

- `apps/mobile/plugins/with-firebase-config.js`（~30 行）：
  - Android：应用 `com.google.gms.google-services` gradle 插件。
  - iOS：注入复制 `GoogleService-Info.plist` 的 build phase。
- `app.config.ts` 的 `plugins` 数组追加该 plugin（条件：文件存在才注册，避免无 Firebase 的
  fork 者构建失败——plugin 内部检测配置文件是否存在，不存在则 no-op + console 提示）。

fork 者流程：Firebase 控制台建应用 → 下载两个文件放进 `apps/mobile/`（文件名去掉 `.example`）
→ admin 后台打开 `ga_mobile_enabled` → `expo prebuild` 完成。

## 9. 测试策略

延续仓库模式：单元测试共置（`.test.ts` 靠源文件）、fast-check 做纯逻辑属性测试、
vitest node environment（无 React 组件测试基建，接线层不测）。

| 测试文件 | 测什么 | 手段 |
|---|---|---|
| `config.test.ts` | RPC 响应 → config 解析：三键各自缺失/空串/正常、`gaMobileEnabled` 字符串转 bool 的全组合边界 | 单元 + fast-check（任意响应 shape 不抛、返回合法 config） |
| `facade.test.ts` | 门面选择：无配置→noop；只配 OP→OP；只开 GA→firebase；双开→composite；init 前调用 no-op；幂等（二次 init 同实例） | 单元，`vi.mock` 动态 import 的 SDK 模块 |
| `providers/openpanel.test.ts` | identify traits 拆分归一、track/setScreenName 事件名与参数、失败后 failed 态不再抛 | 单元，mock `@openpanel/react-native` |
| `providers/firebase.test.ts` | 事件名 sanitize（非法字符改名、超 40 截断不丢）、setUserId null 清除、抛错后 failed 态 + warn 去重 | 单元，mock `@react-native-firebase/analytics` |
| packages/api config router 测试 | `getPublicAnalyticsConfig` 响应含三个新字段的断言 | 扩展现有测试基建 |

**明确出界**：真实外部上报、`_layout.tsx` 的 useEffect 接线（逻辑已被 hook 拆出覆盖）。

**覆盖率**：新包 ≥80%（对齐全局 80% 要求；门面 + config + providers 纯逻辑部分实测显著高于此）。

## 10. 交付物清单

1. `packages/analytics/mobile/**` —— 新包（门面 + 2 provider + noop + 测试）。
2. `packages/shared/src/config.ts` —— 3 个配置键 + `openpanel` 分组。
3. `packages/api/src/modules/admin/analytics/service.ts` —— `PublicAnalyticsConfig` 扩展 3 字段。
4. `apps/mobile` —— 依赖安装、`src/lib/analytics.ts`、两处 layout 接线。
5. `apps/mobile` —— 两个 `.example` 模板、`.gitignore` 追加、`plugins/with-firebase-config.js`、
   `app.config.ts` 注册。
6. CLAUDE.md 项目结构说明同步（analytics 描述补 mobile 变体）。
