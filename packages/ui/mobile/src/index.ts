// @openstarter/ui-mobile —— 移动端共享 UI 组件出口。
// 组件由 react-native-reusables（shadcn/ui for React Native）官方 CLI / registry
// 生成，存放于 src/components/ui（含自定义 Field 组合），样式消费 apps/mobile 的
// NativeWind 主题（CSS 变量：见 apps/mobile/global.css 与 tailwind.config.js）。
// 自定义的 Screen（安全区容器）与 Spinner 不属于 reusables 组件集，
// 保留在 apps/mobile/src/components/ui 下。

export * from "./components/ui";
export { PortalHost } from "@rn-primitives/portal";
