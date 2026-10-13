# 控糖健康管理系统（AI控糖助手）· 后台管理前端

PC 端管理后台（Vue3 + TypeScript + Vite + Pinia + Element Plus + ECharts）。

本机联调可直接双击 `..\scripts\start-admin.cmd`。脚本会检查 Node/npm、首次自动安装依赖、检测后端 8080，并启动管理端后打开浏览器。

## 联调（当前）

已对接后端 `/admin/v1`：

| 能力 | 说明 |
|------|------|
| 登录 | `POST /admin/v1/auth/sessions` |
| 资讯 / Banner | 列表、保存、删除、资讯状态 |
| 营养库 | 分类与食物 CRUD |
| C 端用户 | 真实数据库用户列表、禁用与解禁 |

反馈管理已接入真实 `/admin/v1/feedbacks` 查询与审批回复接口。用户管理已接入真实 `/admin/v1/users`，数据来自 `user_account` 及其关联表。看板、媒体、导出等未完成接口仍使用 `src/mock`。

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


## 独立仓库

当前目录就是构建根目录，Docker 构建使用 `docker build -t glucopilot-admin:accepted-tag .`。
独立部署步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。
