# Octo Product Steward

这是 `octo-server` 的产品管家 Agent 需求池。它把群内收到的产品问题、Bug 和新需求，沉淀为可追踪的 GitHub Issue，并用定时巡检把评审状态变化回报到 Octo 群。

## 交付设计

- 一个 Agent：`Octo Product Steward`。它在群内回答产品问题、分流反馈、维护 Issue，并在需要时切换为 PRD 作者或评审人。
- 九域源码知识地图：[`docs/knowledge-base/source-map.md`](docs/knowledge-base/source-map.md)。所有面向考官的技术结论都必须附目标仓库相对路径和行号。
- 需求池：Issue Form、标签体系、PRD 模板与评审闭环都在本仓库。
- 长时闭环：GitHub Actions 每 10 分钟扫描 Issue 的状态/标签变化。仅发现真实变化才向 Octo 群投递通知；没有变化时不发群消息。

## 首次接入（按顺序完成）

1. 在 GitHub 建立一个 **public** 空仓库，例如 `octo-product-steward`，并将本目录推送为 `main`。
2. 在 Octo 考试群创建一个 Incoming Webhook。创建时将“主考”和本 Agent 配为定向 @ 目标；保存其 native URL 到 GitHub Actions Secret `OCTO_WEBHOOK_URL_ACTIVE`。URL/Token 绝不能进入代码、Issue 或群消息。
3. 在仓库 Actions 页面手动运行 `Bootstrap labels` 一次。它只创建或更新本项目需要的标签。
4. 在仓库 Settings → Webhooks 新增一个 Webhook：Payload URL 使用步骤 2 所获 URL 的 `/github` 后缀，Content type 为 `application/json`；订阅 Issues、Issue comments 和 Pull requests。Octo-server 原生支持该 GitHub 适配器。
5. 在 Actions 页面手动运行 `Issue sweep` 一次建立基线；第二次及之后的定时运行才会就新增或状态变化通知群内。
6. 用 [`AGENTS.md`](AGENTS.md) 作为你部署平台（Claude Code / OpenClaw / Hermes）的系统指令，创建并接入同一个 Octo Bot 身份。测试它能在群内回复并能创建 GitHub Issue 后，保留最近几次 Actions 运行记录供考核。

完整的事件和 PRD 规则见 [`docs/runbooks/issue-lifecycle.md`](docs/runbooks/issue-lifecycle.md)，群接入与验收见 [`docs/runbooks/octo-onboarding.md`](docs/runbooks/octo-onboarding.md)。

## 本地源码位置

知识地图按 `octo-server` 仓库根目录引用路径。当前工作区中，该只读源码位于相邻的 `../octo-server`；部署 Agent 时请把实际克隆目录设为它的只读知识源。
