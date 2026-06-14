---
title: OpenSpec 深度解析报告（Fission-AI/OpenSpec）
date: 2026-06-14
category: aicoding
tags: [OpenSpec, Spec-Driven, specs/changes, Delta Spec, Schema]
description: OpenSpec 深度解析：4 个核心原则、Schema 机制、4 个 Artifact 详解、命令体系、Delta Spec 与 Archive 机制、Workspace 模式。
---

# OpenSpec 深度解析报告

> 来源：https://github.com/Fission-AI/OpenSpec | Clone：`aicoding流程/OpenSpec/`

---

## 一、整体设计哲学与目录结构

### 1.1 四个核心原则

```Plain Text
fluid not rigid         — 没有阶段门，可以按需进入任意动作
iterative not waterfall — 学习中演进，过程中修订
easy not complex        — 轻量初始化，零仪式感
brownfield-first        — 优先服务老项目，不只是新项目

```

OpenSpec 把传统 Spec-Driven 的「PLANNING → IMPLEMENTING → DONE」线性阶段改成「proposal → specs → design → tasks → implement」的**动作链**：每个动作都是可独立调用的命令，不锁阶段。

---

### 1.2 核心目录结构（`openspec init` 后）

```Plain Text
openspec/
├── specs/              # Source of truth（系统当前行为的真实描述）
│   └── <domain>/
│       └── spec.md
├── changes/            # Proposed updates（每个 change 一个文件夹）
│   └── <change-name>/
│       ├── proposal.md  # Why + What （提案）
│       ├── design.md    # How（架构决策）
│       ├── tasks.md     # 实施清单（带 checkbox）
│       └── specs/       # Delta specs（与 source of truth 的差异）
│           └── <domain>/
│               └── spec.md
└── config.yaml         # 项目级配置（可选但推荐）

```

**两个目录的核心区分：**

- **specs/**——系统现状的「事实之源」，按 domain 组织（`specs/auth/`、`specs/payments/`）。
- **changes/**——提案的「暂存区」，每个 change 一个独立文件夹，archive 后整文件夹移到 `changes/archive/`。

这种分离带来三个核心收益：**并行工作不冲突**、**合并前可单独 review**、**archive 时 delta 干净合并到 source of truth**。

---

## 二、Schema 机制（核心创新）

### 2.1 什么是 Schema

Schema 是 OpenSpec 工作流的「配方」：一组 YAML 文件，定义**工件（artifact）清单、依赖关系、模板路径、Agent 指令**。它是 OpenSpec 跟 Spec Kit / Superpowers 最不一样的地方——流程不再硬编码在 TypeScript 里，而是数据。

### 2.2 Schema 文件结构（`schemas/spec-driven/schema.yaml`）

```YAML
name: spec-driven
version: 1
description: Default OpenSpec workflow - proposal → specs → design → tasks

artifacts:
  - id: proposal
    generates: proposal.md
    description: Initial proposal document outlining the change
    template: proposal.md
    instruction: |  # 喂给 Agent 的指令
      Create the proposal document that establishes WHY this change is needed.
      Sections:
      - **Why**: ...
      - **What Changes**: ...
      - **Capabilities**: ...
      - **Impact**: ...
    requires: []  # 无前置依赖

  - id: specs
    generates: "specs/**/*.md"
    template: spec.md
    instruction: |  # 详细指令覆盖 delta spec 的 ADDED/MODIFIED/REMOVED/RENAMED 规范
      ...
    requires:
      - proposal  # 必须在 proposal 之后

  - id: design
    ...
    requires:
      - proposal

  - id: tasks
    ...
    requires:
      - specs
      - design

apply:
  requires: [tasks]
  tracks: tasks.md  # apply 阶段跟进的 checklist 文件
  instruction: |
    Read context files, work through pending tasks, mark complete as you go.

```

### 2.3 三层抽象

| 层级 | 作用 | 修改者 |
|-|-|-|
| **schema.yaml** | 定义工件清单 + 依赖图 + Agent 指令 | 团队 / 高级用户 |
| **templates/\*.md** | 每个工件的 markdown 骨架（含 HTML 注释占位） | 团队 / 高级用户 |
| **instruction（YAML 里）** | 告诉 Agent 怎么用这个模板、填什么、格式约束 | 团队 / 高级用户 |

改这三层任意一层，**不需要重新发版**，立刻生效。CLI 运行时读取 schema → 生成对应 AI 工具的 skill / command 文件。

---

### 2.4 内置 Schema

| Schema | 适用场景 |
|-|-|
| **spec-driven**（默认） | 单仓单模块的标准 SDD：proposal → specs → design → tasks |
| **workspace-planning** | 跨仓 / monorepo 的协调：`specs/<area-or-repo>/<capability>/spec.md` 路径，linked repos 在实现前只读 |

自定义 schema：

```Bash
openspec schema init my-workflow    # 基于内置 schema 派生
openspec schema fork spec-driven team-flow
openspec schema validate my-workflow
openspec schema which <change-name>

```

自定义 schema 放在项目的 `openspec/schemas/` 下，与代码一同版本管理。

---

## 三、4 个 Artifact 详解

### 3.1 `proposal.md`（Why + What）

**定位：**变更的「立项书」，确立 Why。

```Markdown
# Proposal: <name>

## Why
<!-- 1-2 句：解决什么问题、为什么现在做 -->

## What Changes
<!-- 具体变更清单，破坏性变更标注 **BREAKING** -->

## Capabilities
### New Capabilities
- `<name>`: <简述>  # 每个生成 specs/<name>/spec.md
### Modified Capabilities
- `<existing-name>`: <改了什么需求>  # 必须跟 openspec/specs/ 里的实际 spec 名对齐

## Impact
<!-- 受影响的代码 / API / 依赖 / 系统 -->

```

**关键约束：**

- 保持 1-2 页篇幅；只写 Why，不写 How（How 归 design.md）
- **Capabilities 区段是 proposal ↔ specs 的契约**——列出的每个 capability 都必须有对应的 spec 文件
- Modified Capabilities 必须严格匹配已有 spec 名（否则 archive 时 merge 会失败）

---

### 3.2 `specs/<capability>/spec.md`（Delta Spec）

**定位：**描述变更的「WHAT should change」——用 delta 格式表达「相对 source of truth 的差异」。

```Markdown
# Delta for <Capability>

## ADDED Requirements
### Requirement: <name>
The system MUST/SHALL ...

#### Scenario: <name>
- **WHEN** <condition>
- **THEN** <expected outcome>

## MODIFIED Requirements
### Requirement: <name>
<完整新内容>  # 必须包含整个 requirement 块，不能只贴差异

#### Scenario: ...

## REMOVED Requirements
### Requirement: <name>
**Reason**: <为何移除>
**Migration**: <迁移路径>

## RENAMED Requirements
- FROM: `<old-name>`
- TO: `<new-name>`

```

**格式硬约束（来自 schema 的 instruction）：**

- Requirement 标题必须是 `### Requirement: <name>`（3 个 #）
- Scenario 标题必须是 `#### Scenario: <name>`（**正好 4 个 #**，3 个 # 会静默失败）
- 每个 Requirement 至少配一个 Scenario
- 规范化词用 SHALL / MUST（避免 should / may）
- **MODIFIED 必须是完整内容**（从 `### Requirement:` 到所有 Scenario 整块复制），否则 archive 时丢失细节

**Common pitfall：**新增关注点但不改变旧行为时，用 ADDED 而不是 MODIFIED。

---

### 3.3 `design.md`（How）

**定位：**解释如何实现变更，聚焦架构决策而非逐行实现。

```Markdown
# Design: <name>

## Context
<背景 + 现状 + 约束 + 干系人>

## Goals / Non-Goals
**Goals:** <本设计要达成什么>
**Non-Goals:** <明确排除什么>

## Decisions
<关键决策 + 为什么选 X 不选 Y + 备选方案>

## Risks / Trade-offs
[Risk] → Mitigation

## Migration Plan
<部署步骤、回滚策略>

## Open Questions
<未决项>

```

**何时必须写 design.md：**

- 跨服务/跨模块的横向变更
- 新外部依赖或重大数据模型变更
- 涉及安全/性能/迁移复杂度
- 有歧义、值得在编码前对齐技术决策

---

### 3.4 `tasks.md`（实施清单）

**定位：**把设计拆成可勾选的任务列表，`apply` 阶段通过解析 checkbox 状态跟踪进度。

```Markdown
## 1. <任务组名>
- [ ] 1.1 <任务描述>
- [ ] 1.2 <任务描述>

## 2. <任务组名>
- [ ] 2.1 <任务描述>

```

**apply 阶段的硬要求：**

- 任务必须是 `- [ ]` checkbox 格式（其他格式不计入进度）
- 每任务粒度小到一 session 内可完成
- 按依赖顺序排列（Setup → 基础 → 用户故事 → Polish）
- 每任务可验证——「完成」是有明确定义的
- 不写占位符（TODO、TBD、参考 Task N）

---

## 四、命令体系

### 4.1 两种 Profile

OpenSpec 装好后默认是 **core** profile；想用 expanded 命令需手动选：

```Bash
openspec config profile    # 交互式选择
openspec update           # 应用所选 profile，重新生成 skill / command 文件

```

| Profile | 命令 |
|-|-|
| **core**（默认） | `propose` · `explore` · `apply` · `sync` · `archive` |
| **expanded** | `new` · `continue` · `ff` · `apply` · `verify` · `bulk-archive` · `onboard` |

---

### 4.2 各命令详解

| 命令 | Profile | 做什么 |
|-|-|-|
| `/opsx:explore` | core | 无结构地想清楚问题、调查、对比方案。结构不强求——纯思考伴侣 |
| `/opsx:propose <name>` | core | 一步创建 change 文件夹 + 全部 planning artifacts（proposal / specs / design / tasks） |
| `/opsx:new <name>` | expanded | 只搭脚手架（创建 change 目录，不生成任何 artifact） |
| `/opsx:continue` | expanded | 基于依赖关系，按序创建下一个 artifact。可反复调用 |
| `/opsx:ff <name>` | expanded | 一口气创建所有 planning artifacts（一次性 fast-forward） |
| `/opsx:apply [<name>]` | 两者 | 读 tasks.md，按顺序执行，每完成一个改 `- [ ]` 为 `- [x]`。可选指定 name 来在多 change 并行时消歧 |
| `/opsx:verify` | expanded | 用 artifacts 反向验证实现是否合规（contract check） |
| `/opsx:sync` | core | 把 delta specs 同步到主 specs（archive 之前可选步骤） |
| `/opsx:archive` | 两者 | 合并 delta → 主 specs，change 文件夹移到 `changes/archive/`，提示同步 |
| `/opsx:bulk-archive` | expanded | 一次性批量 archive 多个已完成 change |
| `/opsx:onboard` | expanded | 引导式走完端到端 change（教学用） |

---

### 4.3 5 种典型工作流模式

**1. Quick Feature（你清楚要做什么）**

```Plain Text
core:     /opsx:propose → /opsx:apply → /opsx:sync → /opsx:archive
expanded: /opsx:new → /opsx:ff → /opsx:apply → /opsx:verify → /opsx:archive

```

**2. Exploratory（需求不清）**

```Plain Text
/opsx:explore → /opsx:new → /opsx:continue → /opsx:apply

```

**3. Parallel Changes（多 change 并行）**

```Plain Text
Change A: /opsx:new → /opsx:ff → /opsx:apply (in progress)
                                          │
                                     context switch
                                          │
Change B: /opsx:new → /opsx:ff ─────────► /opsx:apply

```

回到 Change A 时用 `/opsx:apply add-dark-mode`，OpenSpec 自动接回断点。

**4. Verify-Before-Done**（expansion 模式才有）

```Plain Text
/opsx:apply → /opsx:verify → /opsx:archive

```

**5. Bulk Archive**（多个 change 都跑完了）

```Plain Text
/opsx:bulk-archive   # 一次性扫所有 completed change

```

---

## 五、Delta Spec 与 Archive 机制

### 5.1 4 种 Delta 操作

| 操作 | Header | archive 时行为 |
|-|-|-|
| **ADDED** | `## ADDED Requirements` | 追加到主 spec |
| **MODIFIED** | `## MODIFIED Requirements` | 替换主 spec 中的对应 requirement（必须包含完整内容） |
| **REMOVED** | `## REMOVED Requirements` | 从主 spec 中删除（必须含 Reason + Migration） |
| **RENAMED** | `## RENAMED Requirements` | 改名（用 FROM:/TO: 格式） |

---

### 5.2 Archive 流程

`/opsx:archive` 触发时：

1. 读取 `changes/<name>/specs/` 的所有 delta 文件
2. 按 delta 操作类型合并到 `openspec/specs/<capability>/spec.md`：ADDED 追加、MODIFIED 替换、REMOVED 删除、RENAMED 改名
3. change 文件夹整包移动到 `openspec/changes/archive/<日期>-<name>/`（保留审计历史）
4. 删除 change 目录的 `.openspec.yaml` 元数据

**archive 前可手动调整 delta**（比如把 MODIFIED 改回 ADDED，或者修正 requirement 文本）。archive 后 source of truth 已更新，再想追溯就得到 `changes/archive/` 找原始 delta。

---

## 六、Project Config 机制（`openspec/config.yaml`）

### 6.1 完整示例

```YAML
schema: spec-driven  # 默认 schema，省去 --schema 参数

context: |
  Tech stack: TypeScript, React, Node.js
  API conventions: RESTful, JSON responses
  Testing: Vitest for unit tests, Playwright for e2e
  Style: ESLint with Prettier, strict TypeScript

rules:
  proposal:
    - Include rollback plan
    - Identify affected teams
  specs:
    - Use Given/When/Then format for scenarios
  design:
    - Include sequence diagrams for complex flows

```

### 6.2 Schema 优先级（高 → 低）

1. CLI flag：`openspec new change my-feature --schema workspace-planning`
2. Change metadata：`changes/<name>/.openspec.yaml` 里的 `schema` 字段
3. Project config：`openspec/config.yaml` 里的 `schema`
4. 默认：`spec-driven`

---

### 6.3 Context / Rules 注入机制

OpenSpec 在生成每个 artifact 的 AI prompt 时，会把 config 里的内容按规则注入：

```XML
<context>
Tech stack: TypeScript, React, Node.js
...
</context>

<rules>
- Include rollback plan
- Identify affected teams
</rules>

<template>
[Schema's built-in template]
</template>

```

| 字段 | 行为 |
|-|-|
| `context` | **所有** artifact 都注入（前缀位置） |
| `rules.<artifact-id>` | **仅匹配**该 artifact 注入（在 context 之后，template 之前） |
| context 体积 | 上限 50KB（超出报错） |

**校验规则：**

- `rules` 里的 artifact ID 必须在 schema 里存在（否则警告）
- schema 名必须存在于已安装 schema 列表
- YAML 语法错误会带行号报告
- config 变更**立即生效**，无需重启

---

## 七、Workspace 模式（多仓 / 多模块）

### 7.1 概念模型

OpenSpec 的 **workspace** 是「跨多个 repo/folder 的本地协调视图」：

```Plain Text
workspace     = private local view over context stores, initiatives, repos, and folders
context store = durable shared context container
initiative    = durable coordination context inside a context store
link          = a stable name for a repo or folder the workspace can resolve locally
change        = one planned piece of work; implementation belongs in the owning repo

```

### 7.2 目录布局

```Plain Text
getGlobalDataDir()/workspaces/<name>/
├── .openspec-workspace/
│   └── view.yaml                  # 私有本地视图记录
├── AGENTS.md                      # 自动生成的运行时指引
└── <name>.code-workspace          # VS Code / Copilot 多根工作区文件

```

**关键点：**workspace 文件夹不是 repo。**不会**创建 `.gitignore`、不会创建 `changes/`，纯本地协调面。

仓库侧保持原状：

```Plain Text
repo-root/
└── openspec/
    ├── specs/     # repo-owned specs
    └── changes/   # repo-local changes

```

---

### 7.3 `.openspec-workspace/view.yaml`

```YAML
version: 1
name: platform
context:
  kind: initiative
  store:
    id: platform
    selector:
      kind: registry      # 通过 id 选 store（可移植）
      id: platform
  initiative:
    id: billing-launch   # 当前打开的 initiative
links:
  api: /repos/api          # 链接到本地的别名
  web: /repos/web

```

link 命名是稳定的逻辑名（`api`、`web`），workspace 记录里映射到运行时本地路径。换机器时路径可不同，逻辑名不变。

---

### 7.4 常用 workspace 命令

```Bash
openspec workspace setup                              # 交互式
openspec workspace setup --no-interactive \           # 自动化
  --name platform --link /repos/api --link web=/repos/web \
  --opener codex-cli
openspec workspace list                              # 列出本机所有 workspace
openspec workspace link /repos/api                   # 添加 link
openspec workspace relink api-service /new/path/to/api
openspec workspace doctor                            # 健康检查
openspec workspace update --tools codex,claude       # 刷新 skill / command
openspec workspace open platform --agent github-copilot
openspec workspace open --initiative billing-launch --store platform

```

**Workspace visibility ≠ change commitment。**建 workspace 只是让 OpenSpec 知道哪些 repo 跟当前工作相关；具体的 feature/fix 仍要 `openspec new change` 在具体 repo 里建。

**实现阶段：**linked repos / folders 在 **workspace planning** 阶段是只读的；只有 `/opsx:apply` 在特定 repo 的 change 目录里才允许写。