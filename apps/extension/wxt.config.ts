import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

import { EXTENSION_DEFAULT_LOCALE } from "@openstarter/i18n-extension";

// 加载根 .env，把跨端共享的 OPENSTARTER_API_URL 派生为 VITE_APP_URL。
// host_permissions 与 API base URL 都由 VITE_APP_URL 派生，二者不会漂移
// （见 docs/superpowers/specs/2026-08-01-browser-extension-app-design.md §5）。
// manifest 支持函数形式（(env) => manifest），故可在构建期读取 process.env。
//
// 优先级（高 → 低）：显式 process.env.VITE_APP_URL（CI/shell 覆盖）>
// 根 .env 的 OPENSTARTER_API_URL（与 web/cli/desktop/mobile 同源）>
// localhost 兜底。Wxt 只在 Node 构建期读本文件，不向上遍历 monorepo，故需手动加载根 .env。
const extensionDir = resolve(fileURLToPath(import.meta.url), "..");
const monorepoRoot = resolve(extensionDir, "..", "..");
const require = createRequire(import.meta.url);
const dotenvPath = require.resolve("dotenv", { paths: [extensionDir] });
const { config: loadDotenv } = await import(dotenvPath);
loadDotenv({ path: resolve(monorepoRoot, ".env"), quiet: true });

const APP_URL_FALLBACK = "http://localhost:3000";

// 插件端 i18n：@wxt-dev/i18n（browser.i18n 封装）。消息目录在
// packages/i18n/extension/locales（插件专属精简目录，与 web 端 Paraglide 目录独立），
// 构建期由该模块编译为 _locales/<locale>/messages.json 并生成 #i18n 的类型安全 i18n.t。
// 语言跟随浏览器 UI 语言 —— browser.i18n 不支持运行时切换，也不读 web 端 locale cookie
// （用户确认的取舍）；localesDir 必须是绝对路径（模块内部不基于 config 解析相对路径）。
const extensionLocalesDir = resolve(extensionDir, "../../packages/i18n/extension/locales");

function resolveAppUrl(): string {
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL;
  }
  if (process.env.OPENSTARTER_API_URL) {
    return process.env.OPENSTARTER_API_URL;
  }
  return APP_URL_FALLBACK;
}

export default defineConfig({
  manifest: () => {
    const appUrl = resolveAppUrl();
    const { origin } = new URL(appUrl);
    return {
      default_locale: EXTENSION_DEFAULT_LOCALE,
      host_permissions: [`${origin}/*`],
      name: "OpenStarter Account",
      permissions: ["cookies"],
    };
  },
  // wxt module 在 "@wxt-dev/i18n/module" 子导出（根入口是运行时 createI18n，无 default module 导出）。
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  srcDir: "src",
  i18n: {
    localesDir: extensionLocalesDir,
  },
});
