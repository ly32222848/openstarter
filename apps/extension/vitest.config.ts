import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineProject } from "vitest/config";

export default defineProject({
  plugins: [viteReact()],
  resolve: {
    alias: {
      // #i18n 由 @wxt-dev/i18n 在构建期生成（.wxt/i18n/index.ts，调 browser.i18n）；
      // 测试环境无 browser.i18n，替换为读 @openstarter/i18n-extension 目录的 stub。
      "#i18n": resolve(__dirname, "src/test/i18n-stub.ts"),
      "~": resolve(__dirname, "src"),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    name: "extension",
    setupFiles: ["./src/test/setup.ts"],
  },
});
