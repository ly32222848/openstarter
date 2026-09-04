// with-firebase-config 单测：文件缺失 no-op（同引用返回 + 一次警告）、
// 文件存在时写 android/ios.googleServicesFile 字段（Expo 默认链据此接线）。
// 不 mock 模块、不触碰真实 FS：直接 spy 内置 node:fs 的 existsSync——
// 插件的 require("node:fs") 拿到的是同一个缓存模块对象，spy 对其可见。

import { afterEach, describe, expect, it, vi } from "vitest";

import fs from "node:fs";
import withFirebaseConfig from "./with-firebase-config";

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
const existsSync = vi.spyOn(fs, "existsSync");

const onlyAndroid = (p) => String(p).endsWith("google-services.json");
const onlyIos = (p) => String(p).endsWith("GoogleService-Info.plist");

describe("with-firebase-config", () => {
  afterEach(() => {
    existsSync.mockReset().mockImplementation(() => false);
    warn.mockClear();
  });

  it("no Firebase config files: returns the same config reference and warns once", () => {
    const config = { name: "x", slug: "x" };

    const result = withFirebaseConfig(config);

    expect(result).toBe(config);
    expect(result.android?.googleServicesFile).toBeUndefined();
    expect(result.ios?.googleServicesFile).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("google-services.json"));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("*.example"));
  });

  it("google-services.json exists: returns a new config with both googleServicesFile fields set", () => {
    existsSync.mockImplementation(onlyAndroid);

    const config = { name: "x", slug: "x" };

    const result = withFirebaseConfig(config);

    expect(result).not.toBe(config);
    expect(config.android?.googleServicesFile).toBeUndefined(); // 原配置不被原地修改
    expect(result.android.googleServicesFile).toBe("google-services.json");
    expect(result.ios.googleServicesFile).toBe("GoogleService-Info.plist");
    expect(warn).not.toHaveBeenCalled();
  });

  it("GoogleService-Info.plist exists: sets both googleServicesFile fields", () => {
    existsSync.mockImplementation(onlyIos);

    const result = withFirebaseConfig({ name: "x", slug: "x" });

    expect(result.android.googleServicesFile).toBe("google-services.json");
    expect(result.ios.googleServicesFile).toBe("GoogleService-Info.plist");
    expect(warn).not.toHaveBeenCalled();
  });
});
