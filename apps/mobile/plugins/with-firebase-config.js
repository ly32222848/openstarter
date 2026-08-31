// with-firebase-config —— Expo config plugin：声明 Firebase 配置文件位置。
//
// 原生接线全部交给 Expo 默认插件链：@expo/prebuild-config 已无条件挂载
// AndroidConfig.GoogleServices.{withClassPath,withApplyPlugin,withGoogleServicesFile}
// 与 IOSConfig.Google.withGoogleServicesFile。这些 mod 在执行时读取
// config.android/ios.googleServicesFile 字段，幂等地完成 gradle classpath 声明、
// apply plugin、plist 拷贝与 Xcode 资源注册——本插件只写这两个字段作为开关，
// 不再 hand-rolled 任何 gradle/xcode mod。
//
// 配置文件不存在时整个 plugin no-op（console 提示一次）——未使用 Firebase 的
// fork 者 prebuild 行为与从前完全一致。文件存在性在 plugin 内部检测（而非
// app.config.ts 里条件注册），保证 app.config.ts 恒定、无分支。

const fs = require("node:fs");
const path = require("node:path");

const ANDROID_CONFIG = "google-services.json";
const IOS_CONFIG = "GoogleService-Info.plist";

const withFirebaseConfig = (config) => {
  const projectRoot = path.join(__dirname, "..");
  const hasFirebaseConfig =
    fs.existsSync(path.join(projectRoot, ANDROID_CONFIG)) ||
    fs.existsSync(path.join(projectRoot, IOS_CONFIG));

  if (!hasFirebaseConfig) {
    console.warn(
      `[with-firebase-config] Neither ${ANDROID_CONFIG} nor ${IOS_CONFIG} found in apps/mobile — skipping Firebase wiring. ` +
        "Copy the *.example templates and fill in your Firebase project values to enable GA mobile.",
    );
    return config;
  }

  return {
    ...config,
    android: { ...config.android, googleServicesFile: ANDROID_CONFIG },
    ios: { ...config.ios, googleServicesFile: IOS_CONFIG },
  };
};

module.exports = withFirebaseConfig;
