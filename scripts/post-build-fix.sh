#!/bin/bash
# 构建后修复：nitro 踢出的 node_modules 缺少两样运行时依赖，每次 build 后需补：
# 1. tslib/modules/index.js —— Node ESM 按 exports["."].import.node 解析到它，但 nitro 只拷了 tslib.es6.js
# 2. @libsql/linux-x64-gnu —— @libsql/client 原生模块，运行时 require("@libsql/linux-x64-gnu")
set -e
D=/opt/openstarter/apps/web/.output/server

# tslib 垫片
mkdir -p "$D/node_modules/.nf3/tslib@2.8.1/modules"
cat > "$D/node_modules/.nf3/tslib@2.8.1/modules/index.js" <<'EOF'
// Shim: Node ESM resolution (exports["."].import.node -> ./modules/index.js)
// re-exports the ESM build nitro shipped alongside. Fixes ERR_MODULE_NOT_FOUND
// raised when @better-auth/passkey chunk imports "tslib".
export * from "../tslib.es6.js";
export { default } from "../tslib.es6.js";
EOF

# libsql 原生模块（若 @libsql/client 版本更新，路径中的版本号可能变化，动态查找）
SRC=$(ls -d /opt/openstarter/node_modules/.pnpm/@libsql+linux-x64-gnu@*/node_modules/@libsql/linux-x64-gnu 2>/dev/null | head -1)
if [ -n "$SRC" ]; then
  mkdir -p "$D/node_modules/@libsql/linux-x64-gnu"
  cp "$SRC/index.node" "$D/node_modules/@libsql/linux-x64-gnu/index.node"
  printf '%s\n' '{ "name": "@libsql/linux-x64-gnu", "main": "index.node" }' > "$D/node_modules/@libsql/linux-x64-gnu/package.json"
  echo "libsql native copied from $SRC"
else
  echo "WARN: @libsql/linux-x64-gnu not found in pnpm store" >&2
fi

echo "post-build fixes applied"
