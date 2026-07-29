---
ref: dev-server-watcher
parent: component-troubleshooting
---

# dev server watcher 行为

`manifestPlugin` 在 dev server 启动时挂一个 `chokidar` watcher,监听 `packages/{vue,react}-components/src/` 目录。当 `component.config.ts` 增/删/改时,自动重新生成 manifest + 让浏览器 full-reload。

## 加载方式

`packages/manifest-generator/src/vite-plugin.ts` 的 `configureServer(server)`:

```text
server.watcher.add(watchRoots)  // 显式监听 packages/*/src/(默认 server root 在 apps/showcase,packages 在外面)
server.watcher.on('add', onConfigChange)
server.watcher.on('change', onConfigChange)
server.watcher.on('unlink', onConfigChange)

onConfigChange (file):
  if (!file.includes('component.config')) return  // 只关心 config
  debounce 200ms(避免 Windows 写入竞态)
  regenerateManifest()
  server.ws.send({type: 'full-reload'})
```

## 何时 watcher 不响应

| 现象 | 原因 |
|---|---|
| 添加 component.config.ts 后 manifest 不变 | 1) manifestPlugin 没装上(查 vite.config);2) 路径不在 watchRoots(检查 componentRoots 配置);3) debounce 还没触发(等 200ms) |
| 浏览器没 full-reload | dev server 的 ws 连接断了,手动刷一次就好 |
| 删除组件后 manifest 仍含旧条目 | watcher 的 `unlink` 没触发,通常是因为文件路径里包含 symlink 或跨设备边界(Windows 下少) |

## 验证 watcher 工作

```bash
# 1. 启动 dev
pnpm --filter @style-library/showcase dev

# 2. baseline
curl -s http://localhost:5173/__component-manifest.json | jq '.components | length'

# 3. 添加一个临时组件(Write 工具创建,避免 cat heredoc 竞态)
mkdir -p packages/vue-components/src/temp-test
# 写合法的 component.config.ts + index.vue(参考 how-to-add-component)

# 4. 等 1 秒,查 manifest
sleep 1
curl -s http://localhost:5173/__component-manifest.json | jq '.components | length'
# 应该比 baseline +1

# 5. 删掉
rm -rf packages/vue-components/src/temp-test
sleep 1
curl -s http://localhost:5173/__component-manifest.json | jq '.components | length'
# 应该回到 baseline

# 6. 清理临时文件,确保没污染 git status
```

## 何时不需要重启 dev server

- 改 `index.vue` / `index.tsx` 内部代码:Vite HMR 自动,无需 manifest 重新生成
- 改 `component.config.ts` 字段:watcher 自动响应
- 添加新组件:watcher 自动响应
- 删除组件:watcher 自动响应

## 何时**需要**重启 dev server

- 改了 `manifestPlugin` 自身源码:watcher 是 plugin 启动时挂的
- 改了 `vite.config.ts`:Vite 配置变了必须重启
- 改了 `packages/manifest-generator/src/*`:插件代码
- 改了 `packages/component-contract/src/*`:类型契约(可能要清 `.vite/` 缓存)