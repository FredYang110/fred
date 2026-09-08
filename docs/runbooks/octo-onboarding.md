# Octo 群接入与考前验收

## 接入

1. 请群管理员创建一个供产品管家使用的 Bot 身份，并在你选择的平台中配置它。将 [`AGENTS.md`](../../AGENTS.md) 作为系统指令，并把只读 `octo-server` 源码目录挂为知识源。
2. 在考试群创建 Incoming Webhook。把主考和产品管家 Bot 加入 webhook 的定向 @ 列表；Webhook 的 token 只保存在 GitHub Actions Secret `OCTO_WEBHOOK_URL_ACTIVE`。
3. 工作流只通过 `secrets.OCTO_WEBHOOK_URL_ACTIVE` 注入地址；不要把值写入 workflow、Issue、日志或群消息。
4. `/github` 适配器是可选能力，只在需要原始事件全文时启用。本考核方案不与 `Issue sweep` 同时启用它，以免评论等非状态变化产生重复噪声。该适配器的路径、事件头与输入格式由 `modules/incomingwebhook/adapter_github.go` 定义。来源: `modules/incomingwebhook/adapter_github.go#L3-L20`
5. 启用 `Issue sweep`。它每 10 分钟检查状态和标签变化，只有变化才调用 native Webhook 发一条简明回报。

## 验收脚本

- 在群内问一个九域知识问题：回答必须带真实 `来源: path#Lx-Ly`。
- 在群内报告一个可复现 Bug：Agent 应创建 `type:bug` Issue，并补齐预期、实际、复现、影响和证据。
- 在群内提出新需求：Agent 应创建 `type:feature` Issue，认领后写 What-only PRD，再走一次打回和修订。
- 手工关闭一张 Issue 并加 `resolution:wontfix`：下一次扫描应回报“已关闭为 wontfix”，不能说“已修复”。
- 连续等待两次无变化的定时执行：群内不应有“无更新”类消息；Actions 运行历史应显示扫描确实执行。

## 证据留存

考前保留：公开需求池链接、最近几次 GitHub Actions 定时运行记录、一张完整 PRD/Review Issue，以及一条带可核验行号的群内问答。不要截图或提交任何密钥。
