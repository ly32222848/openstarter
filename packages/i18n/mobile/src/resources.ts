import en from "../messages/en.json";
import zh from "../messages/zh.json";

// i18next 资源结构：{ 语言: { 命名空间: { 键: 文案 } } }。
// 键为带命名空间前缀的扁平字符串（如 "common.sign.sign_in_title"），
// 消费方需配置 keySeparator: false，让整串键原样匹配。
// 占位符使用 i18next 默认插值语法 {{var}}（如 {{email}}、{{seconds}}）。
export const resources: Record<string, { translation: Record<string, string> }> = {
  en: { translation: en },
  zh: { translation: zh },
};
