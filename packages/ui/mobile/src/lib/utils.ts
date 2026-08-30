// cn 助手（react-native-reusables 约定）：clsx 合并 + twMerge 去重冲突类。
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
