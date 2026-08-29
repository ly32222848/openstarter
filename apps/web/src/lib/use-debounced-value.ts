import { useEffect, useState } from "react";

/**
 * 返回 value 的防抖副本：value 停止变化 delayMs 毫秒后才同步更新。
 * 用于搜索输入等高频更新源，避免每次按键都触发请求（如 admin 列表查询）。
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, value]);

  return debounced;
}
