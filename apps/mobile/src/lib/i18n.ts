// apps/mobile/src/lib/i18n.ts —— i18next 初始化与语言切换入口。
//
// 资源来自 @openstarter/i18n-mobile（i18next resources 结构），启动时按
// 「用户偏好 > 设备语言 > 默认语言」确定初始语言（见 ./locale.ts）。
// init 放在模块作用域：只应发生一次，且必须在任何组件读取翻译之前完成。
//
// 键为带命名空间前缀的扁平字符串（如 "common.sign.sign_in_title"），
// 因此 keySeparator / nsSeparator 均关闭；React 已负责转义，插值不再 escape。
import {
  DEFAULT_LOCALE,
  resources,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@openstarter/i18n-mobile";
import i18next from "i18next";
import { useCallback, useState } from "react";
import { initReactI18next } from "react-i18next";

import { getLocales } from "expo-localization";

import { resolveInitialLocale } from "./locale";
import { loadLocalePreference, saveLocalePreference } from "./preferences";

const initialLocale = resolveInitialLocale(
  getLocales().map((entry) => entry.languageTag),
  loadLocalePreference(),
);

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

export function useAppLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  const setAppLocale = useCallback((next: SupportedLocale) => {
    saveLocalePreference(next);
    void i18next.changeLanguage(next);
    setLocaleState(next);
  }, []);

  return { locale, setAppLocale };
}
