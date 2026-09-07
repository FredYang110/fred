# octo-server 源码知识地图

本文件是回答前的索引，不替代逐行复核。下面的引用均相对于 `octo-server` 仓库根目录；对外回答必须复查对应行号后再引用。

## 1. 认证与身份

- API 启动时把自定义 `CacheTokenParser` 装入路由，并把 token 有效性、语言和实时系统角色解析器接入其中。来源: `main.go#L210-L227`
- Token Parser 从缓存载入 token，兼容 JSON envelope 和旧的 `uid@name[@role]` 编码；空 token、缺失 token、无效 token 都返回对应认证错误。来源: `pkg/auth/parser.go#L59-L79`、`pkg/auth/parser.go#L130-L164`
- 系统角色不是只信任签发时快照；解析时可经 Redis/DB 的 `RoleResolver` 覆盖，从而让降权在缓存 TTL 内生效。来源: `pkg/auth/parser.go#L45-L56`、`pkg/auth/parser.go#L189-L208`
- `Authorization: Bearer` 会在全局中间件阶段兼容回填为下游认证所用 token；显式 token 头优先，不接受 query 参数兜底。来源: `main.go#L279-L288`
- 本仓库可直接核验的 Cookie 读取是语言协商的 `i18n_lang`，不是登录 Cookie。若被问到 Cookie 登录的具体机制，应说明认证中间件位于外部 `octo-lib` 依赖，不能据此源码断言。来源: `pkg/i18n/lang.go#L13-L18`、`pkg/i18n/lang.go#L50-L83`
- Bot 注册返回 API URL、WebSocket URL 和 IM token；App Bot 复用同一个 token 用于 API 与 IM WebSocket，轮换时二者一起失效。来源: `modules/bot_api/register.go#L496-L508`、`modules/bot_api/register.go#L478-L494`

## 2. 鉴权模型

- 平台管理、Space 管理和用户发现是不同路由面：App Bot 平台 API 使用登录认证，Space API 还在 handler 中检查 Space 管理员，发现接口只要求登录。来源: `modules/app_bot/app_bot.go#L116-L154`
- Space 管理员门槛是有效成员且 `role >= 1`（1=admin，2=owner）；查询不到成员或角色不足时拒绝。来源: `modules/app_bot/app_bot.go#L45-L49`、`modules/app_bot/app_bot.go#L156-L168`
- App Bot 的平台/Space 作用域必须与访问路由匹配，避免通过全局 ID 跨租户读取或轮换 Space Bot token。来源: `modules/app_bot/app_bot.go#L171-L183`
- Bot 身份以 `robot` 和 `app_bot` 两张生命周期权威表为准；同一 UID 同时活跃于两表属于异常，解析器要求失败关闭。来源: `modules/botidentity/resolver.go#L1-L4`、`modules/botidentity/resolver.go#L59-L77`、`modules/botidentity/resolver.go#L92-L119`
- Channel/群/Space 访问不是单一 RBAC：路由上的系统角色检查、Space 成员资格、群成员/管理员检查以及 Bot 发送权限会叠加。回答“谁覆盖谁”时必须按具体路由追踪，不应把它们简化为一个统一 ACL。

## 3. 配置与启动校验

- 默认启动配置路径是 `configs/tsdd.yaml`；读取失败会 panic。环境变量使用 `TS_` 前缀并把点替换为下划线。来源: `main.go#L159-L177`
- 启动前会校验 token 过期配置；release 模式还会校验测试短信验证码配置。来源: `main.go#L176-L198`
- `tsdd.yaml` 是带注释的配置样例：WuKongIM、MySQL、Redis、外部访问地址等段落在文件中均可见，但样例中的绝大多数键被注释。回答“哪些必填”时要区分“文件样例”与“运行时由 octo-lib 配置默认值/环境变量提供”的部分。来源: `configs/tsdd.yaml#L1-L44`
- 文件服务支持 MinIO、Tencent COS、Aliyun OSS、Qiniu 和 SeaweedFS；预签名上传能力和 CORS/签名约束在配置样例中明示。来源: `configs/tsdd.yaml#L69-L170`

## 4. 业务模块清单

- 模块以 blank import 注册，实际启用清单应以 `internal/modules.go` 为准，而不是 README 架构图。来源: `internal/modules.go#L1-L13`
- 其中包括基础、消息、群组、Space、用户、文件、搜索、通知、OIDC、Webhook、Bot API、App Bot、Bot Provision 等模块。来源: `internal/modules.go#L20-L84`
- `runtime` 模块已移除，Bot 运行时/编排归 `octo-fleet`；不要把历史 README 或旧路径当作当前实现。来源: `internal/modules.go#L42-L47`
- 标准模块通常在 `1module.go` 注册 API 和嵌入式 SQL 迁移；例如 `app_bot`。来源: `modules/app_bot/1module.go#L1-L23`

## 5. API 与错误约定

- 面向业务的错误通过本地化门面 `ResponseErrorL` 或 `ResponseErrorLWithStatus` 输出；前者为兼容旧客户端固定传输层 400，后者才使用错误码语义 HTTP 状态。来源: `pkg/httperr/respond.go#L13-L56`
- 两种门面的 body envelope 相同，并由注册错误码、默认文案、参数、经白名单过滤的 details 和 internal 标记共同渲染。来源: `pkg/httperr/respond.go#L57-L81`
- 错误码带稳定 ID、HTTP 状态、默认文案、安全 detail 白名单；5xx 示例设置 `Internal: true`。来源: `pkg/errcode/server.go#L10-L16`、`pkg/errcode/server.go#L110-L115`

## 6. IM 控制面与 WuKongIM 边界

- `octo-server` 负责业务 API 与控制面；Bot 注册时调用 `UpdateIMToken` 将 Bot token 同步给 IM，然后返回客户端连接所需的 WS/API 地址。来源: `modules/bot_api/register.go#L331-L379`
- WS 地址由外部 BaseURL/IP 或 WuKongIM API URL 派生：带域名的反代模式是 `/ws`，直连模式用 5200。来源: `pkg/botutil/ws.go#L11-L44`
- Incoming Webhook 自己做鉴权、限流、群状态与成员资格检查，最终通过 `ctx.SendMessageWithResult` 把消息投递给 IM。来源: `modules/incomingwebhook/api.go#L1294-L1403`、`modules/incomingwebhook/api.go#L1544-L1562`

## 7. Bot 与 Agent

- `botfather` 已不再承接 `/v1/bot/*` 主 API；它保留 Bot 文档、User Bot 管理、用户 API Key、Robot Apply 与运行时 onboarding。来源: `modules/botfather/api.go#L83-L115`
- `bot_provision` 是 server 和 fleet/daemon 之间的 Bot contract：浏览器 session 可 mint Bot，daemon 用 `uk_` API key 取 token，并检查创建者和绑定 Space。来源: `modules/bot_provision/bot_api.go#L1-L18`、`modules/bot_provision/bot_api.go#L94-L171`
- App Bot 只有 published 状态才能注册；其发布记录会装入共享 Redis registry，使 token 吊销跨副本立即可见。来源: `modules/app_bot/app_bot.go#L92-L111`、`modules/bot_api/register.go#L435-L452`
- User Bot 与 App Bot 的身份、创建者和 Space scope 的权威来源不同，必须经 `botidentity` 区分。来源: `modules/botidentity/resolver.go#L14-L24`、`modules/botidentity/resolver.go#L105-L119`

## 8. 存储与外部依赖

- MySQL 使用 `gocraft/dbr`；迁移由 `sql-migrate` 执行，并递归收集 SQL 文件后按 migration ID 排序。来源: `pkg/db/mysql.go#L10-L13`、`pkg/db/mysql.go#L16-L49`、`pkg/db/mysql.go#L58-L111`
- Redis 连接经统一选项和 instrumentation 构造，支持普通 key、带过期 key、hash、list、set 等用法；具体缓存键必须按相关模块查证，不能笼统宣称“Redis 只缓存登录态”。来源: `pkg/redis/redis.go#L19-L36`、`pkg/redis/redis.go#L43-L69`、`pkg/redis/redis.go#L99-L109`
- App Bot 认证 registry 使用共享 Redis，设计目的就是让发布/吊销在多副本间立即生效。来源: `modules/app_bot/app_bot.go#L92-L103`
- 对象存储服务、预签名 URL 和浏览器 CORS 注意事项列在配置文件中。来源: `configs/tsdd.yaml#L69-L170`

## 9. 构建与发布

- `Dockerfile` 是源码多阶段构建：下载 Go module、编译静态 Linux binary，并把 binary、assets、configs 放入 Alpine 运行镜像。来源: `Dockerfile#L11-L48`
- `Dockerfile.ghcr` 是已编译的 `linux_${TARGETARCH}` binary 打包到 Debian 运行镜像，不负责编译源码。来源: `Dockerfile.ghcr#L1-L17`
- `make build` 等价于 `docker build -t octo-server .`；旧 push/deploy 目标包含遗留私有仓库配置，文档明确不应作为正式发布面。来源: `Makefile#L1-L13`、`BUILDING.md#L43-L62`
- 全量运行栈（WuKongIM、MySQL、Redis、MinIO、nginx、compose/Helm）由 `octo-deployment` 维护；本仓库旧 compose 栈已退役。来源: `BUILDING.md#L33-L41`、`BUILDING.md#L49-L55`

