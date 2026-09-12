// 列表 URL 状态 schema 的边界行为：脏查询参数必须安全回落，不能让手改地址栏
// （?page=0 / ?page=abc）把 loader 炸成整页错误。

import { describe, expect, it } from "vitest";

import { countTotalPages, listSearchParams, listUsersSearchParams } from "./list-search";

describe("listSearchParams", () => {
  it("parses page numbers from the wire (string) form", () => {
    expect(listSearchParams.parse({ page: "3" })).toEqual({ page: 3 });
  });

  it("defaults missing page to 1", () => {
    expect(listSearchParams.parse({})).toEqual({ page: 1 });
  });

  it.each([
    [{ page: "0" }, 1],
    [{ page: "-2" }, 1],
    [{ page: "abc" }, 1],
    [{ page: "2.5" }, 1],
    [{ page: NaN }, 1],
  ])("falls back to page 1 for dirty input %j", (input, expected) => {
    expect(listSearchParams.parse(input)).toEqual({ page: expected });
  });
});

describe("listUsersSearchParams", () => {
  it("keeps a valid query string and truncates an over-long one", () => {
    expect(listUsersSearchParams.parse({ q: "user@x.com" })).toMatchObject({
      page: 1,
      q: "user@x.com",
    });
    // 超长输入截断到 200 字符（仍可搜索前缀），而非整段丢弃。
    expect(listUsersSearchParams.parse({ q: "x".repeat(500) }).q).toHaveLength(200);
    // 非字符串脏值回落空串。
    expect(listUsersSearchParams.parse({ q: 42 }).q).toBe("");
  });

  it("defaults q to empty string when absent", () => {
    expect(listUsersSearchParams.parse({})).toEqual({ page: 1, q: "" });
  });
});

describe("countTotalPages", () => {
  it("never returns less than 1 page", () => {
    expect(countTotalPages(0)).toBe(1);
  });

  it("rounds up partial pages", () => {
    expect(countTotalPages(21)).toBe(2);
    expect(countTotalPages(40)).toBe(2);
    expect(countTotalPages(41)).toBe(3);
  });
});
