---
title: Spec Kit 项目深度分析（github/spec-kit）
date: 2026-06-14
category: aicoding
tags: [SpecKit, constitution, governance, Placeholder, Hooks]
description: Spec Kit 项目深度分析：7 步核心流程、模板 Placeholder 系统、Pre/Post-Execution 钩子、handoffs 机制、老项目初始化方案。
---

# Spec Kit 项目分析

> 来源：https://github.com/github/spec-kit | Clone：`clawgithubtool/spec-kit/`

---

## 一、初始化后的项目目录

运行 `specify init` 后，生成的标准结构：

```Plain Text
my-project/
├── .specify/                         # Spec Kit 核心工作区
│   ├── memory/
│   │   └── constitution.md           # 项目治理原则（Constitution）
│   ├── specs/                       # 功能规格存放目录
│   │   └── 001-my-feature/
│   │       ├── spec.md              # 功能规格（含用户故事 + 验收标准）
│   │       ├── plan.md              # 技术实施方案
│   │       ├── tasks.md             # 可执行任务列表
│   │       ├── data-model.md        # 数据模型（plan 后生成）
│   │       ├── research.md           # 技术调研（plan 后生成）
│   │       ├── quickstart.md         # 快速验证指南（plan 后生成）
│   │       ├── contracts/           # API 契约（plan 后生成）
│   │       └── checklists/          # 质量检查清单
│   ├── templates/                   # 模板文件（可被预设覆盖）
│   │   ├── commands/               # 各命令的 prompt 模板
│   │   ├── spec-template.md
│   │   ├── plan-template.md
│   │   ├── tasks-template.md
│   │   └── constitution-template.md
│   ├── extensions/                  # 已安装的扩展
│   └── presets/                     # 已安装的预设
├── scripts/                         # 共享脚本（bash/powershell）
└── CLAUDE.md                       # AI Agent 上下文文件

```

---

## 二、核心流程（7 步）

```Plain Text
/speckit.constitution    # 建立项目治理原则（每个项目只需执行一次）
        ↓
/speckit.specify         # 描述要做什么（生成 spec.md）
        ↓
/speckit.clarify         # 澄清模糊点（推荐在 plan 前执行）
        ↓
/speckit.plan            # 制定技术方案（生成 plan.md 等）
        ↓
/speckit.analyze         # 一致性分析（plan 后、implement 前）
        ↓
/speckit.tasks           # 生成任务列表（生成 tasks.md）
        ↓
/speckit.implement        # 按任务执行（TDD 测试先行）

```

---

## 三、模板Placeholder 系统详解

### 3.1 什么是 Placeholder

Spec Kit 的每个模板文件（`.specify/templates/` 下的 `.md` 文件）是 **Template + Prompt 的合体**：

- 文件内容本身是模板（用 `[PLACEHOLDER]` 标记待填充位置）
- 文件开头的 `---` YAML front matter 是 **Prompt 逻辑**（告诉 Agent 怎么处理这个模板）

Placeholder 就是模板中用 `[大写字母下划线数字]` 格式包裹的占位符，Agent 在运行时必须用具体值替换。

---

### 3.2 各模板的 Placeholder 一览

**constitution-template.md 的 Placeholder：**

| Placeholder | 含义 |
|-|-|
| `[PROJECT_NAME]` | 项目名称 |
| `[PRINCIPLE_1_NAME]` / `[PRINCIPLE_1_DESCRIPTION]` | 原则一：名称 + 描述 |
| `[PRINCIPLE_2_NAME]` / `[PRINCIPLE_2_DESCRIPTION]` | 原则二 |
| `[PRINCIPLE_3_NAME]` / `[PRINCIPLE_3_DESCRIPTION]` | 原则三（通常含 TDD） |
| `[PRINCIPLE_4_NAME]` / `[PRINCIPLE_4_DESCRIPTION]` | 原则四（通常含集成测试） |
| `[PRINCIPLE_5_NAME]` / `[PRINCIPLE_5_DESCRIPTION]` | 原则五 |
| `[SECTION_2_NAME]` / `[SECTION_2_CONTENT]` | 附加约束章节 |
| `[SECTION_3_NAME]` / `[SECTION_3_CONTENT]` | 开发流程章节 |
| `[GOVERNANCE_RULES]` | 治理规则内容 |
| `[CONSTITUTION_VERSION]` | Constitution 版本号 |
| `[RATIFICATION_DATE]` | 批准日期 |
| `[LAST_AMENDED_DATE]` | 最后修改日期 |

**spec-template.md 的 Placeholder：**

| Placeholder | 含义 |
|-|-|
| `[FEATURE NAME]` | 功能名称 |
| `[###-feature-name]` | 功能分支名（如 `001-user-auth`） |
| `[DATE]` | 创建日期 |
| `$ARGUMENTS` | 用户在命令后输入的原始描述 |
| `[Describe this user journey]` | 用户故事描述 |
| `[Explain the value]` | 优先级原因 |
| `[specific action]` | 独立测试描述 |
| `[initial state]` / `[action]` / `[expected outcome]` | Given/When/Then 场景 |
| `[boundary condition]` / `[error scenario]` | 边界情况和错误场景 |
| `[Entity N]` | 数据实体名称 |
| `[What it represents]` | 实体含义 |
| `[Measurable metric]` | 可量化指标 |
| `[Assumption about...]` | 假设条件 |

**plan-template.md 的 Placeholder：**

| Placeholder | 含义 |
|-|-|
| `[PROJECT]` | 项目名 |
| `[DATE]` | 日期 |
| `[link]` | spec.md 链接 |
| `[ARGUMENTS]` | 原始功能描述 |
| `[Language/Version]` | 编程语言和版本 |
| `[Primary Dependencies]` | 主要依赖 |
| `[Storage]` | 存储方案 |
| `[Testing]` | 测试框架 |
| `[Target Platform]` | 目标平台 |
| `[Project Type]` | 项目类型 |
| `[Performance Goals]` | 性能目标 |
| `[Constraints]` | 约束条件 |
| `[Scale/Scope]` | 规模范围 |

---

### 3.3 命令 Prompt 的标准结构

每个命令文件（`templates/commands/*.md`）的结构完全一致：

```YAML
---
description: 命令描述
handoffs:       # 执行完毕后，自动建议的下一步
  - label: ...
    agent: speckit.xxx
    prompt: ...
    send: true   # 是否自动发送上下文
scripts:        # 执行前运行的脚本
  sh: scripts/bash/xxx.sh --json
  ps: scripts/powershell/xxx.ps1 -Json
---

## User Input
$ARGUMENTS    # 用户在 /speckit.xxx 后面输入的内容

## Pre-Execution Checks
# 钩子检查：读取 .specify/extensions.yml
# 检查 hooks.before_xxx 下的扩展钩子
# optional=true → 输出提示，让用户决定是否运行
# optional=false → 自动运行，等待结果再继续

## Outline
# 核心 Prompt 逻辑（Agent 必须遵循的步骤）

## Post-Execution Checks
# 钩子检查：读取 hooks.after_xxx

## Context
{ARGS}        # 用户输入的原始内容，传给扩展使用

```

---

### 3.4 Pre/Post-Execution 钩子机制

每个命令在**执行前**和**执行后**都会检查 `.specify/extensions.yml`，查找对应的钩子：

```YAML
# .specify/extensions.yml 结构
hooks:
  before_constitution: [...]   # /speckit.constitution 执行前
  after_constitution: [...]    # /speckit.constitution 执行后
  before_specify: [...]       # /speckit.specify 执行前
  after_specify: [...]        # /speckit.specify 执行后
  before_plan: [...]
  after_plan: [...]
  before_clarify: [...]
  after_clarify: [...]
  before_tasks: [...]
  after_tasks: [...]
  before_implement: [...]
  after_implement: [...]
  before_analyze: [...]
  after_analyze: [...]
  before_checklist: [...]
  after_checklist: [...]

```

钩子配置：

| 字段 | 含义 |
|-|-|
| `command` | 扩展提供的命令名 |
| `description` | 描述 |
| `prompt` | 传给扩展的提示词 |
| `optional: true` | 可选：输出提示，用户决定是否运行 |
| `optional: false` | 强制：自动运行，等待完成后再继续 |
| `condition` | 条件表达式（由 HookExecutor 评估，Agent 不解释） |
| `enabled: false` | 明确禁用 |

---

### 3.5 handoffs（交接）

每个命令执行完毕后，会告诉 Agent 下一步可以调用什么：

```YAML
handoffs:
  - label: Build Specification
    agent: speckit.specify
    prompt: Implement the feature specification based on the updated constitution. I want to build...
    send: true    # 自动把 constitution 内容发送给 speckit.specify

```

---

## 四、各命令 Prompt 核心逻辑

### `/speckit.constitution`

```Plain Text
1. 加载 .specify/memory/constitution.md（从 constitution-template.md 初始化的模板）
2. 找出所有 [ALL_CAPS_IDENTIFIER] 占位符
3. 从对话推断值，或从仓库上下文（README/docs）派生
4. 替换所有占位符为具体内容
5. 一致性同步：检查 plan-template / spec-template / tasks-template / 各命令文件是否需要同步更新
6. 生成 Sync Impact Report（版本变化、修改列表、待处理文件）
7. 验证：无残留占位符、版本正确递增、日期 ISO 格式
8. 写回 .specify/memory/constitution.md

```

---

### `/speckit.specify`

```Plain Text
1. 根据描述生成简短功能名（如 "user-auth"）
2. 在 specs/ 下创建目录（序号-功能名）
3. 复制 spec-template.md 作为起点
4. 填充内容：User Scenarios（含 Given/When/Then）、Functional Requirements、
   Key Entities、Success Criteria、Assumptions
5. [NEEDS CLARIFICATION] 标记：最多 3 个，影响范围/安全/UX 才标记
6. 生成 requirements.md 质量检查清单并运行验证
7. 若有未澄清项 → 每次只问 1 个多选题 → 回答后立即写入 spec.md
8. 完成后自动 handoff 到 /speckit.clarify 或 /speckit.plan

```

---

### `/speckit.clarify`

```Plain Text
1. 加载 spec.md，扫描 10 个维度（功能范围、数据模型、UX、非功能属性、集成、边界情况等）
2. 生成候选澄清问题队列（最多 5 个，每次只问 1 个）
3. 每个问题附推荐选项，优先推荐置顶
4. 回答后立即写入 spec.md 的 Clarifications 区，并更新相关章节
5. 完成后报告：问题数量、涉及章节、覆盖摘要

```

---

### `/speckit.plan`

```Plain Text
Phase 0（研究）：
1. 从 spec.md 提取 NEEDS CLARIFICATION → 并行派遣研究 agent
2. 汇总到 research.md

Phase 1（设计）：
1. 从 spec.md 提取实体 → data-model.md
2. 定义接口契约 → contracts/ 目录
3. 生成 quickstart.md
4. 运行 agent context 更新脚本
5. 再次检查 Constitution Check

```

---

### `/speckit.analyze`

**纯只读分析**，不修改任何文件：

```Plain Text
1. 加载 spec.md、plan.md、tasks.md、constitution.md
2. 构建语义模型：Requirements inventory、User story inventory、Task coverage mapping
3. 执行 6 类检测：重复、模糊、不足、Constitution 对齐、覆盖缺口、不一致
4. 输出分析报告（Markdown 表格，含 Severity 级别）
5. Constitution 违规 → 始终 CRITICAL，必须调整 spec/plan/tasks，不允许忽略
6. 输出 Next Actions 和 remediation 建议（需用户确认才会执行）

```

---

### `/speckit.tasks`

```Plain Text
1. 加载 plan.md 和 spec.md（用户故事及优先级）
2. 按用户故事分组组织任务：
   Phase 1: Setup → Phase 2: Foundational → Phase 3+: 用户故事（P1/P2/P3）→ Polish
3. 任务格式：- [ ] T001 [P?] [US?] 描述（精确文件路径）
   [P] = 可并行，[US?] = 所属用户故事
4. 禁止占位符（"参考 Task 3"、"TBD"、"TODO"）
5. 输出：总任务数、并行机会、MVP 范围建议

```

---

### `/speckit.implement`

```Plain Text
1. 检查 checklists/ 状态，有未完成项则 STOP 并询问用户
2. 按技术栈自动创建/验证忽略文件（.gitignore、.dockerignore 等）
3. 按顺序执行任务（Setup → Foundational → 用户故事 → Polish）
   [P] 标记的任务可并行
   测试任务先于实现任务（TDD）
4. 每完成 1 个 → 将 - [ ] 改为 - [x]
5. 失败：非并行任务停止；并行任务继续并报告失败
6. 完成验证：所有任务完成、测试通过、实现符合规格

```

---

## 五、老项目如何初始化

### 5.1 问题：标准 init 不适合老项目

标准 `specify init` 生成通用占位符模板，对老项目有 5 个摩擦点：

1. Constitution 是空白模板，不反映实际技术栈、架构或编码规范
2. 模板引用占位符路径，不是真实模块
3. 多模块项目（monorepo）没有代码边界指导
4. 无法将现有功能反向纳入 SDD 工作流
5. 手动创建 Constitution 对大型代码库既繁琐又容易出错

---

### 5.2 方案一：Lean 预设（轻量替代）

内置预设，简化命令，移除标准版中的复杂验证和自动生成逻辑。

**安装：** `specify preset add lean`

| 命令 | 标准 init | Lean 预设 |
|-|-|-|
| Constitution | 完整模板，含版本管理、同步检查、钩子处理、占位符验证 | 极简版：项目名称 + 指导原则 + 不可妥协规则，从仓库上下文派生 |
| Specify | 自动生成目录序号+名称，大量验证和质量清单逻辑 | 用户**自己提供**功能目录路径，直接写 spec.md |
| Plan | Phase 0 研究 + Phase 1 设计，含 agent context 更新、constitution 再次检查 | 直接读取 feature.json，生成 plan.md |
| Tasks | 完整任务生成，含并行分析、MVP 范围建议、完整 checklist 格式 | 直接读取 feature.json，生成 tasks.md |
| Implement | checklists 状态检查、忽略文件自动创建、完整 phase 执行、TDD 强制 | 直接读取 feature.json，按顺序执行 tasks |

---

### 5.3 方案二：Brownfield Bootstrap 扩展（完整方案）

社区扩展，完整解决老项目的 5 个摩擦点。

**安装：**

```Bash
specify extension add --from https://github.com/Quratulain-bilal/spec-kit-brownfield/archive/refs/tags/v1.0.0.zip

```

**4 个专用命令：**

| 命令 | 作用 | 是否修改文件 |
|-|-|-|
| `/speckit.brownfield.scan` | 自动扫描代码库，生成项目画像 | 否（只读） |
| `/speckit.brownfield.bootstrap` | 根据项目画像生成定制 Constitution 和模板 | 是 |
| `/speckit.brownfield.validate` | 验证配置是否与真实项目吻合 | 否（只读） |
| `/speckit.brownfield.migrate` | 将现有功能反向工程，纳入 SDD | 是 |

**完整工作流：**

```Plain Text
specify init → scan → bootstrap → validate → migrate → 以后新功能走标准流程

```

**Scan 输出（项目画像示例）：**

```Plain Text
Project Profile
├── Tech Stack: TypeScript (68%), Python (32%)
├── Frontend: React 18, Vite, TailwindCSS
├── Backend: FastAPI, SQLAlchemy, PostgreSQL
├── Architecture: Frontend + Backend（分离）
├── Modules: client/, server/, shared/
├── Testing: Jest (frontend), pytest (backend)
├── CI/CD: GitHub Actions
├── Branch Pattern: feat/*, fix/*, chore/*
└── Conventions: kebab-case (frontend), snake_case (backend)

```