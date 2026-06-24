# CLAUDE.md — 时光轴项目 AI 助手指引

## 项目概览

**时光轴** — 浏览器端日记分析软件，支持多平台同步。

详细需求见：[docs/requirements.md](docs/requirements.md)
技术规格见：[docs/tech-spec.md](docs/tech-spec.md)
UI 设计见：[docs/design-spec.md](docs/design-spec.md)
开发计划见：[docs/dev-plan.md](docs/dev-plan.md)
变更记录见：[docs/changelog.md](docs/changelog.md)

## 工作约定

### 文档先行
- 开始任何开发前，先阅读 `docs/` 下的对应文档
- 需求不清楚时参考 `requirements.md`
- UI 设计参考 `design-spec.md`
- 技术方案参考 `tech-spec.md`

### 开发日志
- 每次开发会话结束时，在 `dev-logs/` 下创建 `YYYY-MM-DD.md` 日志文件
- 日志内容：已完成事项、待办事项、遇到的问题、下一步计划
- 格式参考 `dev-logs/_template.md`

### 代码规范
- 使用 TypeScript 严格模式
- 组件放在 `src/components/` 对应子目录
- 工具函数放在 `src/lib/`
- 类型定义放在 `src/types/index.ts`
- 自定义 Hook 放在 `src/hooks/`
- 页面路由遵循 Next.js App Router 约定

### 开发顺序
按 `docs/dev-plan.md` 中的阶段顺序执行，不跳阶段，不做超前开发。
每完成一个阶段验证后再进入下一阶段。

### 环境变量
- `.env.local` 存放敏感配置（Supabase URL/Key），不提交到 Git
- 需要时手动创建此文件

### 验证
- 每阶段完成后执行 `npm run dev` 验证
- 检查浏览器控制台无报错
- 确认前后端数据流通正常
