import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "ai-mobile",
    // 脚手架占位包暂无测试；首个测试落地后此开关不再生效。
    passWithNoTests: true,
  },
});
