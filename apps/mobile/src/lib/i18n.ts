// apps/mobile/src/lib/i18n.ts —— i18next 初始化与语言切换入口。
//
// i18next 技术栈（依赖、初始化、资源）统一由 @openstarter/i18n-mobile 持有，
// 本模块只负责：启动时按「用户偏好 > 设备语言 > 默认语言」确定初始语言
// （见 ./locale.ts），交给 initI18next 完成一次初始化，并暴露切换入口。
// init 必须在任何组件读取翻译之前完成。
//
import { i18next, initI18next, type SupportedLocale } from "@openstarter/i18n-mobile";
import { useCallback, useState } from "react";

import { getLocales } from "expo-localization";

import { resolveInitialLocale } from "./locale";
import { loadLocalePreference, saveLocalePreference } from "./preferences";

const initialLocale = resolveInitialLocale(
  getLocales().map((entry) => entry.languageTag),
  loadLocalePreference(),
);

initI18next({ initialLocale });

export function useAppLocale() {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale);

  const setAppLocale = useCallback((next: SupportedLocale) => {
    saveLocalePreference(next);
    void i18next.changeLanguage(next);
    setLocaleState(next);
  }, []);

  return { locale, setAppLocale };
}
