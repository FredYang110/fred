# 需求归档、PRD 与 Review 闭环

## 1. 先判断，再建单

| 情形 | Issue 类型 | 最小信息 |
| --- | --- | --- |
| 现有行为与预期不符 | `type:bug` | 预期、实际、复现步骤、影响、证据 |
| 希望新增或改变用户可感知能力 | `type:feature` | 用户问题、目标用户、成功标准、范围 |
| 仅需解释，未要求变更 | `type:question` | 问题、已查来源 |

所有 Issue 初始都有一个类型、一个优先级和 `status:triaged`。信息不足时可以建单，但必须标为 `priority:p3` 并在正文写出待补信息；不能虚构复现或优先级。

## 2. 标签规则

- 类型：`type:bug`、`type:feature`、`type:question`
- 优先级：`priority:p0`（阻断/安全/数据风险）、`priority:p1`（核心路径严重受损）、`priority:p2`（重要但有替代）、`priority:p3`（一般改进/待澄清）
- 状态：`status:triaged`、`status:needs-prd`、`status:in-review`、`status:changes-requested`、`status:ready`、`status:closed`
- 结论：`resolution:fixed`、`resolution:duplicate`、`resolution:wontfix`、`resolution:cannot-reproduce`

同一 Issue 同时只能有一个类型、一个优先级、一个状态；结论只在关闭时出现。若考官手动把 Issue 关成 `wontfix`，不要把它改写成“已修复”。

## 3. PM 链路

1. 在评论中认领，说明本轮要补齐的事实与预计交付。
2. 加 `status:needs-prd`，将 PRD 写入同一个 Issue 的 `## PRD` 节；避免另建无法关联的文档。
3. 申请 Review，改为 `status:in-review`，并 @ 指定评审人和主考。
4. 收到打回意见后改为 `status:changes-requested`，逐条回应并修改 PRD。
5. 复审通过后改为 `status:ready`；只有有真实交付证据时才关闭并标 `resolution:fixed`。

## 4. PRD 模板（只写 What）

```markdown
## PRD

### 用户问题
<谁在什么情境下遇到什么问题>

### 目标与非目标
- 目标：<用户可感知的结果>
- 非目标：<本次明确不解决的内容>

### 用户故事
作为 <用户>，我希望 <能力>，从而 <价值>。

### 需求范围
1. <可观察行为>
2. <可观察行为>

### 验收标准
- 当 <前置条件>，用户在 <时间/界面> 能看到 <结果>。
- 当 <异常条件>，用户会得到 <可理解的结果>，且不会 <不希望的后果>。

### 风险与待确认
- <尚未确认的产品决策、依赖或数据风险>

### Review 记录
- <评审人>：<通过/打回原因与结论>
```

不要写“加 Redis 缓存”“建一张表”“调用某内部接口”“返回 200”，也不要贴代码或内部字段名。实现方案应由研发设计决定，PRD 只约束用户价值和验收。

