---
title: Superpowers 深度解析报告（obra/superpowers）
date: 2026-06-14
category: aicoding
tags: [Superpowers, TDD, subagent, Skills, 1%原则]
description: Superpowers 深度解析：14 个 Skills 详解、整体工作流程、TDD 铁律、多 subagent 两阶段审查、verification-before-completion 铁律。
---

# Superpowers 深度解析报告

> 来源：https://github.com/obra/superpowers | Clone：`clawgithub学习/superpowers/`

---

## 一、整体工作流程

### 1.1 核心流程链路

```Plain Text
brainstorming ──────────────→ writing-plans ──────────────→ using-git-worktrees
  理解需求/设计方案                制定可执行计划                创建隔离工作区
                                                                            ↓
                                                        subagent-driven-development
                                                              ↓
                                          receiving-code-review ← requesting-code-review
                                                              ↓
                                                  test-driven-development
                                                每个任务内 RED→GREEN→REFACTOR
                                                              ↓
                                          verification-before-completion
                                                              ↓
                                            finishing-a-development-branch
                                            验证测试 → Merge/PR/Keep/Discard

```

### 1.2 流程详解

**Step 1 — brainstorming（头脑风暴）**

任何创造性工作的最前面。触发方式：对话开始时 Agent 自动检测是否需要。先探索项目上下文，一次问一个问题澄清需求，提出 2-3 个方案并给出推荐，分段展示设计，每段获批后再展示下一段。写设计文档到 `docs/superpowers/specs/`。**唯一正确结束：调用 writing-plans skill。**

**Step 2 — writing-plans（制定计划）**

设计被批准后触发。将设计文档拆解为 2-5 分钟粒度的原子步骤，每步包含精确文件路径、完整代码、验证命令。禁止任何占位符（TBD/TODO/参考 Task N）。计划保存到 `docs/superpowers/plans/`。**执行前提供两种选择：subagent-driven（推荐）或 inline execution。**

**Step 3 — using-git-worktrees（隔离工作区）**

计划执行前必须触发。在独立分支上创建隔离工作区，自动检测项目类型并安装依赖，验证干净测试基线。目录选择优先级：`.worktrees/` > `worktrees/` > CLAUDE.md 配置 > 用户选择。

**Step 4 — subagent-driven-development（Subagent 执行）**

有计划后在当前 session 内执行。为每个任务派遣全新的 subagent，Implementer 完成后依次进行两阶段审查：① 规格符合性审查 ② 代码质量审查。所有任务完成后进行最终代码审查，再调用 finishing-a-development-branch。

**贯穿执行阶段 — test-driven-development**

每个 subagent 在实现任何功能时必须遵循 RED→GREEN→REFACTOR 循环。铁律：没有先写失败的测试，就不能写任何生产代码。如果代码先写了——删除它，从头开始。

**贯穿执行阶段 — verification-before-completion**

在任何宣称"完成/通过/修复"之前，必须运行验证命令并出具实际输出证据。不允许"应该可以了"、"看起来对"这类说法。

**按需触发 — systematic-debugging**

遇到任何 bug、测试失败、异常行为时触发。4 阶段：① 根本原因调查 ② 模式分析 ③ 假设与测试 ④ 实施修复。3 次以上修复失败 → 停止并质疑架构本身。

**按需触发 — dispatching-parallel-agents**

当多个问题相互独立时（如 3+ 个不同测试文件各自失败），并行派遣多个 subagent 同时调查。

**按需触发 — writing-skills**

当需要创建新 Skill 时触发。方法论：先跑 baseline 场景观察 Agent 如何失败，再写 Skill 文档让它通过。

**入口触发 — using-superpowers**

任何对话开始时自动触发。核心规则：只要有 1% 的可能性某个 Skill 适用，就必须调用它。

---

## 二、所有 Skills 详解（14个）

### Skill 1：`brainstorming`

**类型：** 协作 · **何时触发：** 任何创造性工作之前（新建功能/组件/修改行为）

**作用：** 通过 Socratic 对话（一次一问）将模糊想法精化为完整设计文档。

**完整流程：**

1. 探索项目上下文（文件、文档、最近提交）
2. 是否涉及视觉问题？→ 是 → 提供视觉伴侣工具（单独发一条消息）
3. 一次问一个澄清问题，直到理解完整需求
4. 提出 2-3 个方案 + 推荐
5. 分段展示设计方案，每段获取批准
6. 写设计文档到 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，提交 git
7. 自我审查：检查占位符、内在矛盾、范围歧义
8. 让用户审查书面 spec
9. **唯一正确结束：调用 writing-plans skill**

**HARD-GATE：** 没有展示设计方案并获批之前，禁止调用任何实现 Skill、禁止写代码。

---

### Skill 2：`using-git-worktrees`

**类型：** 协作 · **何时触发：** 设计批准后、实施计划执行前

**作用：** 创建隔离的 Git worktree 工作区，支持多分支并行开发且互不干扰。

**目录选择优先级：**

| 优先级 | 目录 | 验证 |
|-|-|-|
| 1 | `.worktrees/` | 必须已加入 .gitignore |
| 2 | `worktrees/` | 必须已加入 .gitignore |
| 3 | `~/.config/superpowers/worktrees/<项目>/` | 无需验证（在项目外） |
| 4 | CLAUDE.md 指定 | 直接使用 |
| 5 | 询问用户 | — |

---

### Skill 3：`writing-plans`

**类型：** 协作 · **何时触发：** 设计文档被批准后

**作用：** 将设计文档转化为可执行的、精确到分钟级的实施计划。

**核心原则：** 计划要足够清晰，让"技术不错但毫无品味、没有判断力、对测试有抵触情绪的热情初级工程师"也能照着执行。

**任务粒度：** 每步 2-5 分钟，包含精确文件路径、完整代码、验证命令。

**禁止占位符：** "TBD"、"TODO"、"参考 Task N"、"添加适当错误处理"——这些全是计划失败。

**计划文件格式：**

```Markdown
# [功能名] 实现计划

**Goal:** 一句话描述
**Architecture:** 2-3 句话
**Tech Stack:** 关键技术

---
## Task N：[组件名]

- [ ] Step 1: 写失败测试
- [ ] Step 2: 运行验证失败
- [ ] Step 3: 写最小代码
- [ ] Step 4: 运行验证通过
- [ ] Step 5: 提交

```

**执行前提供两种选择：**

- Subagent-Driven（推荐）：每个任务派遣 fresh subagent，两阶段审查
- Inline Execution：本 session 内批量执行，设置人工检查点

---

### Skill 4：`subagent-driven-development`

**类型：** 协作 · **何时触发：** 有实施计划，在当前 session 内执行

**作用：** 为每个任务派遣全新 subagent，Implementer 完成后进行两阶段审查。

**三种子 Agent 角色：**

| 角色 | 职责 |
|-|-|
| Implementer | 执行任务、遵循 TDD、提交、自审查 |
| Spec Reviewer | 验证是否符合规格 |
| Code Quality Reviewer | 验证代码质量 |

**Implementer 四种状态处理：**

| 状态 | 处理 |
|-|-|
| DONE | 进入规格审查 |
| DONE_WITH_CONCERNS | 阅读疑虑，决定是否处理 |
| NEEDS_CONTEXT | 提供缺失信息，重新派遣 |
| BLOCKED | 分析原因：调整模型或拆分任务 |

**审查顺序：** 必须先规格审查通过，才能进入代码质量审查。

---

### Skill 5：`executing-plans`

**类型：** 协作 · **何时触发：** 有计划，在独立并行 session 中执行

**作用：** 与 subagent-driven-development 流程相同，但运行在独立并行 session 中，适合长时间无人值守运行。

---

### Skill 6：`test-driven-development`

**类型：** 测试 · **何时触发：** 实施任何功能或修复 bug 之前

**作用：** RED → GREEN → REFACTOR 强制循环，测试先行是铁律。

**铁律：** 在写生产代码之前没有先写失败的测试？→ 删除它，从头开始。

**RED 阶段：** 写一个最小化失败测试，必须亲眼看到测试失败。

**GREEN 阶段：** 写最简单的代码让测试通过，不要多写一行不需要的代码。

**REFACTOR 阶段：** 在测试保护下清理代码，保持所有测试绿色。

---

### Skill 7：`requesting-code-review`

**类型：** 协作 · **何时触发：** 任务之间、重大功能完成后、合并前

**作用：** agent 主动发起审查——我完成了任务，主动派遣 reviewer subagent 去审查我的成果。

**强制审查时机：** 每个任务完成后、重大功能实施完成后、合并到 main 前。

**审查三级：**

| 级别 | 含义 | 行为 |
|-|-|-|
| Critical | 严重问题 | 阻止继续，直到修复 |
| Important | 重要问题 | 建议修复，不阻止 |
| Suggestion | 建议 | 可选修复 |

---

### Skill 8：`receiving-code-review`

**类型：** 协作 · **何时触发：** 收到审查反馈后

**作用：** agent 被动接收审查意见——别人给我提了 review 意见，我收到后去处理和回应。

**工作流向：**

- 每个任务完成后 → agent 调用 requesting-code-review → 派遣 reviewer subagent 去审查 Implementer 的产出
- 审查意见回来之后 → agent 调用 receiving-code-review → 去消化和处理那些意见，决定是接受、反驳、还是问清楚

**本质是同一个工作的两个方向：** 主动审查别人 vs 被动回应别人的审查。

**核心规则：**

- 不允许表演性同意："You're absolutely right!"、"Great point!"（违反 CLAUDE.md）
- 应该：复述技术要求确认理解，有疑问先问清楚再实现
- 发现审查者判断有误 → 技术性反驳，不盲目执行
- 反馈不清晰 → 先问清楚，不能部分实现后再说

---

### Skill 9：`finishing-a-development-branch`

**类型：** 协作 · **何时触发：** 所有任务完成后

**作用：** 验证测试 → 给出 Merge/PR/Keep/Discard 四个选项 → 执行选择 → 清理 worktree。

**四选项：**

| 选项 | 含义 |
|-|-|
| Merge | 本地合并到主分支 |
| PR | 推送并创建 Pull Request |
| Keep | 保持开放继续工作 |
| Discard | 永久丢弃（需输入 "discard" 确认） |

**关键规则：** Discard 必须输入精确确认；Merge 后必须验证测试。

---

### Skill 10：`systematic-debugging`

**类型：** 调试 · **何时触发：** 遇到任何 bug、测试失败、异常行为时

**作用：** 4 阶段根本原因分析，防止乱修乱改制造新 bug。

**4 阶段：**

| 阶段 | 活动 |
|-|-|
| 1. 根本原因调查 | 仔细阅读错误信息、可复现性验证、最近变更检查 |
| 2. 模式分析 | 找到类似工作的代码、对比参考资料、识别差异 |
| 3. 假设与测试 | 形成单一假设，最小化改动验证 |
| 4. 实施修复 | 先写失败测试、单次修复、验证 |

**关键规则：** 3 次以上修复失败 → 停止并质疑架构本身，不是继续打补丁。

---

### Skill 11：`verification-before-completion`

**类型：** 调试 · **何时触发：** 任何宣称"完成/通过/修复"之前

**作用：** 必须在声称成功之前运行验证命令并出具实际输出证据。

**铁律：** 没有运行验证命令，就不能声称通过。

**Gate 函数：**

1. 识别：哪个命令能证明这个说法？
2. 运行：执行完整命令
3. 阅读：检查完整输出和退出码
4. 验证：输出是否确实证明了说法？
5. 然后：才能做出声明

---

### Skill 12：`dispatching-parallel-agents`

**类型：** 协作 · **何时触发：** 2 个以上相互独立的问题（不同测试文件/不同子系统/不同 bug）

**作用：** 并行派遣多个 subagent 同时调查不同问题域，节省时间。

**何时用：** 3+ 个测试文件各自独立失败、多个子系统独立出问题。

**何时不用：** 失败相互关联、需要完整系统上下文、探索性调试。

---

### Skill 13：`writing-skills`

**类型：** Meta · **何时触发：** 创建新 Skill 时

**作用：** 用 TDD 的方式编写新 Skill——先跑 baseline 场景观察 Agent 如何失败，再写 Skill 文档让它通过。

**TDD 映射：**

| TDD 概念 | Skill 创建 |
|-|-|
| 测试失败（RED） | Agent 无 Skill 时违反规则 |
| 测试通过（GREEN） | 有 Skill 时 Agent 遵守规范 |
| REFACTOR | 封堵漏洞同时保持合规 |

---

### Skill 14：`using-superpowers`

**类型：** Meta · **何时触发：** 任何对话开始时

**作用：** 入口 Skill，介绍如何找到和使用 Skills，确保 Agent 在任何行动前先检查是否有适用的 Skill。

**核心规则：** 只要有 1% 的可能性某个 Skill 适用，就必须调用它。

**优先级：** 用户显式指令 > Superpowers Skills > 默认系统行为。