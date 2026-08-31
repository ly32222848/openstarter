// with-firebase-config —— Expo config plugin：prebuild 时接线 Firebase 原生工程。
//
// Android：应用 com.google.gms.google-services gradle 插件（读取 android/app/google-services.json）。
// iOS：注入一个复制 GoogleService-Info.plist 进 app bundle 的 build phase。
//
// 配置文件不存在时整个 plugin no-op（console 提示一次）——未使用 Firebase 的
// fork 者 prebuild 行为与从前完全一致。文件存在性在 plugin 内部检测（而非
// app.config.ts 里条件注册），保证 app.config.ts 恒定、无分支。

const fs = require("node:fs");
const path = require("node:path");
const { withAppBuildGradle, withProjectBuildGradle, withXcodeProject } = require("expo/config-plugins");

const ANDROID_CONFIG = "google-services.json";
const IOS_CONFIG = "GoogleService-Info.plist";

const withFirebaseConfig = (config) => {
  const projectRoot = path.join(__dirname, "..");
  const hasAndroid = fs.existsSync(path.join(projectRoot, ANDROID_CONFIG));
  const hasIos = fs.existsSync(path.join(projectRoot, IOS_CONFIG));

  if (!hasAndroid && !hasIos) {
    console.warn(
      `[with-firebase-config] Neither ${ANDROID_CONFIG} nor ${IOS_CONFIG} found in apps/mobile — skipping Firebase wiring. ` +
        "Copy the *.example templates and fill in your Firebase project values to enable GA mobile.",
    );
    return config;
  }

  let nextConfig = config;

  if (hasAndroid) {
    // app/build.gradle 需要：classpath 声明（project 级）与 apply plugin（app 级）。
    // expo prebuild 模板已含 google-services classpath 的场景由插件幂等处理。
    nextConfig = withProjectBuildGradle(nextConfig, (gradleConfig) => {
      if (gradleConfig.modResults.contents.includes("com.google.gms.google-services")) {
        return gradleConfig;
      }
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        "dependencies {\n        classpath 'com.google.gms:google-services:4.4.2'",
      );
      return gradleConfig;
    });

    nextConfig = withAppBuildGradle(nextConfig, (gradleConfig) => {
      if (gradleConfig.modResults.contents.includes("com.google.gms.google-services")) {
        return gradleConfig;
      }
      gradleConfig.modResults.contents = `${gradleConfig.modResults.contents}\napply plugin: 'com.google.gms.google-services'`;
      return gradleConfig;
    });
  }

  if (hasIos) {
    nextConfig = withXcodeProject(nextConfig, (xcodeConfig) => {
      const xcProject = xcodeConfig.modResults;
      // 幂等：已存在同名 build phase 就跳过
      const hasPhase = xcProject.hash.project.objects.PBXShellScriptBuildPhase
        ? Object.values(xcProject.hash.project.objects.PBXShellScriptBuildPhase).some(
            (phase) => phase && phase.name === "[Expo] Copy GoogleService-Info.plist",
          )
        : false;
      if (!hasPhase) {
        xcProject.addBuildPhase([], "PBXShellScriptBuildPhase", "[Expo] Copy GoogleService-Info.plist", null, {
          inputPaths: ['"$(SRCROOT)/GoogleService-Info.plist"'],
          outputPath: '"$(BUILT_PRODUCTS_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/GoogleService-Info.plist"',
          shellScript:
            'cp -f "${PROJECT_DIR}/../GoogleService-Info.plist" "${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"\n',
        });
      }
      return xcodeConfig;
    });
  }

  return nextConfig;
};

module.exports = withFirebaseConfig;
