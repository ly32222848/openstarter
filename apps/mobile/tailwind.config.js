// 基础语义色走 CSS 变量（见 ./global.css 的 :root / .dark），随 setColorScheme
// 自动切换 —— reusables 组件（@openstarter/ui-mobile）直接消费这些 token。
// 历史的 dark- 前缀 token（dark 对象）仅为存量 className 保留，新代码勿用。
const dark = {
  accent: "#404040",
  "accent-foreground": "#fafafa",
  background: "#0a0a0a",
  border: "rgba(255,255,255,0.10)",
  card: "#171717",
  "card-foreground": "#fafafa",
  destructive: "#ff6467",
  foreground: "#fafafa",
  input: "rgba(255,255,255,0.15)",
  muted: "#262626",
  "muted-foreground": "#a1a1a1",
  primary: "#d4d4d4",
  "primary-foreground": "#171717",
  ring: "#737373",
  secondary: "#262626",
  "secondary-foreground": "#fafafa",
};

module.exports = {
  // @openstarter/ui-mobile 的组件源码也要被扫描，否则 Tailwind 不会产出对应样式。
  content: ["./src/**/*.{js,jsx,ts,tsx}", "../../packages/ui/mobile/src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // 存量 dark- 前缀 token（见文件头注释）。
        dark,
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
};
