# 控糖健康管理系统（AI控糖助手）· 后台管理前端

PC 端管理后台（Vue3 + TypeScript + Vite + Pinia + Element Plus + ECharts）。

## 联调（当前）

已对接后端 `/admin/v1`：

| 能力 | 说明 |
|------|------|
| 登录 | `POST /admin/v1/auth/sessions` |
| 资讯 / Banner | 列表、保存、删除、资讯状态 |
| 营养库 | 分类与食物 CRUD |

看板、用户、反馈、媒体、系统配置等仍用 `src/mock`（`config.useMock=false` 时仅上述模块走真实接口）。

```bash
# 1. 后端已启动 :8080（Flyway V3 含联调账号；见 backend/sql/README.md）
# 2. 本目录
npm install
npm run dev   # http://127.0.0.1:5180 ，Vite 代理到 8080
```

账号：

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 管理员 |
| editor01 | editor123 | 运营编辑 |

切回全 Mock：改 `src/config.ts` → `useMock: true`。

## 快速开始（纯 Mock）

```bash
npm install
npm run dev
npm run build
```
