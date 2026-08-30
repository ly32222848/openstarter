// i18next 运行时（仅本包内部持有）：封装初始化与实例导出，业务侧（apps/mobile）
// 不直接依赖 i18next/react-i18next，统一经包入口消费。
//
// 键为带命名空间前缀的扁平字符串（如 "common.sign.sign_in_title"），
// 因此 keySeparator / nsSeparator 均关闭；React 已负责转义，插值不再 escape。
// react: { useSuspense: false } —— Expo Router 下避免 Suspense 边界需求。
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "./locales";
import { resources } from "./resources";

export { i18next };

// 初始化 react-i18next 绑定的 i18next 实例。init 放在模块作用域调用：只应发生
// 一次，且必须在任何组件读取翻译之前完成。初始语言由应用侧按
// 「用户偏好 > 设备语言 > 默认语言」解析后传入（见 apps/mobile/src/lib/locale.ts）。
export function initI18next({ initialLocale }: { initialLocale: SupportedLocale }): void {
  void i18next.use(initReactI18next).init({
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    keySeparator: false,
    lng: initialLocale,
    nsSeparator: false,
    react: { useSuspense: false },
    resources,
    supportedLngs: [...SUPPORTED_LOCALES],
  });
}
