---
title: TencentDB Agent Memory 多层记忆系统
date: 2026-05-24
category: RAG
tags: [RAG, Memory]
description: 腾讯 LLM Agent 的 L0→L1→L2→L3 分层记忆架构，从原始对话到人格画像的完整解析。
---

> **TencentDB Agent Memory** — 腾讯 LLM Agent 多层记忆系统。核心思路是分层抽象：L0 即时捕获原始对话，L1 用 LLM 提炼结构化记忆，L2 按场景归类，L3 生成用户人格画像。写入时逐层触发（累计 N 轮 → 记忆够多 → 场景够多），召回时采用向量 + BM25 混合多路召回，Top-K 记忆注入 User 前缀，场景导航 + 用户画像常驻 System Prompt 末尾。

# 写入流程
```mermaid
flowchart TD
    A["🗣️ 用户完成一轮对话<br/>handleTurnCommitted()"] --> B

    B["📝 L0 同步写入<br/>auto-capture.ts<br/>─────────────────<br/>把每条消息立即持久化"] --> B1
    B --> B2

    B1["💾 JSONL 文件<br/>路径: conversations/*.jsonl<br/>内容: role + message_text + sessionId + timestamp"]
    B2["🗄️ SQLite 元数据<br/>表: l0_conversations<br/>内容: 同上，支持 SQL 过滤查询"]

    B --> C["⚙️ 后台异步: 向量化 L0 消息<br/>EmbeddingService.embedBatch()<br/>用 embedding 模型把消息转成 float[] 向量"]
    C --> C1["🔢 SQLite vec0 虚拟表<br/>表: l0_vec<br/>内容: record_id + float[N] 向量<br/>用途: 语义相似度搜索原始对话"]
    C --> C2["📖 SQLite FTS5 虚拟表<br/>表: l0_fts<br/>内容: Jieba 分词后的文本<br/>用途: 关键词全文检索"]

    B --> D{"累计 N 轮对话?<br/>达到 L1 触发阈值?"}
    D -- "否 → 跳过" --> Z
    D -- "是 → 触发 L1 Pipeline" --> E

    E["🤖 LLM 调用①: L1 记忆提取<br/>l1-extractor.ts<br/>─────────────────<br/>Prompt: 读取最近 L0 对话内容<br/>要求 LLM 提炼结构化记忆条目<br/>输出: 偏好/事件/技能/任务 等类型"] --> F

    F{"发现重复/冲突记忆?<br/>与已有 L1 条目语义相似?"} -- "有冲突 → LLM 判断" --> G
    F -- "无冲突 → 直接写入" --> H

    G["🤖 LLM 调用②: 去重判断<br/>l1-dedup.ts<br/>─────────────────<br/>Prompt: 给出新旧两条记忆<br/>判断是 UPDATE / KEEP / MERGE<br/>避免重复存储"] --> H

    H["💾 L1 写入<br/>l1-writer.ts<br/>─────────────────<br/>把最终记忆条目持久化"]
    H --> H1["📄 JSONL 文件<br/>路径: records/YYYY-MM-DD.jsonl<br/>内容: id + content + type + priority + scene_name + timestamps"]
    H --> H2["🗄️ SQLite 元数据<br/>表: l1_records<br/>内容: 同上，支持精确过滤"]
    H --> H3["🔢 SQLite vec0 虚拟表<br/>表: l1_vec<br/>内容: float[N] 语义向量<br/>用途: 召回时相似记忆搜索"]
    H --> H4["📖 SQLite FTS5 虚拟表<br/>表: l1_fts<br/>内容: Jieba 分词文本<br/>用途: 关键词匹配"]

    H --> I{"累计记忆够多?<br/>触发 L2 Scene 提取?"}
    I -- "否" --> Z
    I -- "是" --> J

    J["🤖 LLM 调用③: L2 场景提取<br/>scene-extractor.ts<br/>─────────────────<br/>读取全量 L1 记忆<br/>LLM 自动归类成不同'场景'<br/>如: 工作/学习/旅行/健身..."] --> J1
    J1["📂 Markdown 文件<br/>路径: scene_blocks/*.md<br/>内容: 每个场景一个 .md 文件<br/>包含该场景下的所有记忆摘要"]

    J1 --> K{"触发 L3 Persona 生成?"}
    K -- "否" --> Z
    K -- "是" --> L

    L["🤖 LLM 调用④: L3 画像生成<br/>persona-generator.ts<br/>─────────────────<br/>读取所有场景文件<br/>LLM 综合生成用户人格画像<br/>性格/偏好/习惯/专长..."] --> L3MD
    L3MD["📄 Markdown 文件<br/>路径: persona.md<br/>内容: 用户人格综合描述<br/>每次对话都会注入此文件"]

    Z["✅ 写入流程结束"]

    style A fill:#4A90D9,color:#fff
    style E fill:#E8A838,color:#fff
    style G fill:#E8A838,color:#fff
    style J fill:#E8A838,color:#fff
    style L fill:#E8A838,color:#fff
    style B1 fill:#52C41A,color:#fff
    style B2 fill:#52C41A,color:#fff
    style C1 fill:#1890FF,color:#fff
    style C2 fill:#1890FF,color:#fff
    style H1 fill:#52C41A,color:#fff
    style H2 fill:#52C41A,color:#fff
    style H3 fill:#1890FF,color:#fff
    style H4 fill:#1890FF,color:#fff
    style J1 fill:#722ED1,color:#fff
    style L3MD fill:#722ED1,color:#fff
```

# 召回流程

> **⚡ 分层召回策略**
> - **L2 场景导航 + L3 用户画像**：每次拼入 System Prompt 末尾（内容可缓存，不频繁读取 storage）
> - **L1 记忆**：每轮自动搜索（L1 向量 + L1 FTS → RRF 融合 → Top-K 注入 User 前缀）
> - **L0 对话**：**LLM 主动调用** `tdai_conversation_search` 才搜索，不在每轮自动召回链路里

```mermaid
flowchart TD
    A["🗣️ 用户发出新消息<br/>handleBeforeRecall()"] --> B
    B["🔤 构建查询文本<br/>取最近 1~3 轮对话拼成 queryText"] --> C

    C["⚡ L1 自动召回（每轮）"] --> D & E

    D["🔢 L1 向量召回<br/>l1_vec KNN<br/>语义相似度搜索结构化记忆"]
    E["📖 L1 关键词召回<br/>l1_fts BM25<br/>Jieba分词 → FTS5 MATCH"]
    D --> G["🔀 RRF 融合排序<br/>D/E 合并 → 去重 → Top-K"]
    E --> G

    G --> I["📂 加载场景导航<br/>scene_blocks/*.md<br/>按场景分类的记忆摘要"]
    I --> J["👤 加载用户画像<br/>persona.md<br/>性格/偏好/专长综合描述"]
    J --> K["📦 拼装注入 Prompt<br/>① System末尾: persona + 场景导航（可缓存）<br/>② User前缀: Top-K L1记忆（每轮新鲜）"]
    K --> L["✅ LLM 收到带记忆的完整 Prompt<br/>0 次额外 LLM 调用"]

    M["🛠️ LLM 主动调用工具"] --> N["tdai_memory_search<br/>hybrid / embedding / fts<br/>搜索 L1 记忆，支持 type/scene 过滤"]
    M --> O["tdai_conversation_search<br/>hybrid / embedding / fts<br/>搜索 L0 原始对话"]
    N --> P["🔁 复用同一套 SQLite 向量/FTS 查询"]
    O --> P

    style A fill:#4A90D9,color:#fff
    style D fill:#1890FF,color:#fff
    style E fill:#1890FF,color:#fff
    style G fill:#FA8C16,color:#fff
    style I fill:#722ED1,color:#fff
    style J fill:#722ED1,color:#fff
    style K fill:#52C41A,color:#fff
    style L fill:#52C41A,color:#fff
```

# 存储概览

## 存储内容详情

### L1 记忆条目（JSONL 示例）

```jsonl
{"id":"m_1750000000_a1b2","content":"用户偏好使用中文交流","type":"persona","priority":85,"scene_name":"工作","source_message_ids":["msg_001","msg_002"],"metadata":{},"timestamps":["2025-06-14T10:00:00Z","2025-06-15T14:30:00Z"],"createdAt":"2025-06-14T10:00:00Z","updatedAt":"2025-06-15T14:30:00Z","sessionKey":"openclaw","sessionId":"sess_abc123"}
{"id":"m_1750000001_c3d4","content":"昨天下午3点在健身房跑步1小时","type":"episodic","priority":60,"scene_name":"健身","source_message_ids":["msg_010"],"metadata":{"activity_start_time":"2025-06-15T15:00:00Z","activity_end_time":"2025-06-15T16:00:00Z"},"timestamps":["2025-06-15T16:05:00Z"],"createdAt":"2025-06-15T16:05:00Z","updatedAt":"2025-06-15T16:05:00Z","sessionKey":"openclaw","sessionId":"sess_xyz"}
```

**字段说明：** `type` = persona（人格偏好）/ episodic（事件经历）/ instruction（指令规则）；`priority` = 0-100 重要度，-1 为强制全局指令；`scene_name` = L1 提炼时 LLM 打的初步场景标签；`source_message_ids` = 记忆来源的 L0 消息 ID。

### L2 场景文件（Markdown 示例）

```markdown
-----META-START-----
created: 2025-06-10T08:00:00Z
updated: 2025-06-15T18:00:00Z
summary: 用户在健身、饮食方面的习惯和偏好
heat: 85
-----META-END-----

## 健身场景

### 记忆摘要
- 昨天下午3点在健身房跑步1小时
- 每周健身2-3次，偏好有氧运动
- 最近在尝试增肌食谱

### 相关记忆 ID
- m_1750000001_c3d4
- m_1750000002_e5f6
```

**META 字段：** `created`/`updated` = 创建/更新时间；`summary` = LLM 生成的场景一句话摘要；`heat` = 场景活跃度得分（影响 L3 生成优先级）。

### L3 用户画像（Markdown 示例）

```markdown
-----META-START-----
created: 2025-06-01T00:00:00Z
updated: 2025-06-15T20:00:00Z
-----META-END-----

## 用户人格画像

### 性格特征
- 注重效率，喜欢简洁直接的表达方式
- 对新知识有好奇心，愿意尝试新工具

### 偏好习惯
- 偏好中文交流
- 每周健身2-3次，关注健康饮食
- 工作认真，有明确的目标感

### 专长领域
- 软件开发，擅长 TypeScript 和 Python

### 沟通风格
- 简洁明了，不喜欢冗长的解释
- 喜欢直接给出结论再补充细节
```

## 存储介质总览

| 层级 | 存储名称 | 存储介质 | 路径 / 表名 | 作用 |
|------|---------|---------|------------|------|
| **L0 原始对话层** | 对话原文 | JSONL 文件 | `conversations/*.jsonl` | 持久化每条消息原文（role / message_text / sessionKey / timestamp） |
| | 对话元数据 | SQLite 普通表 | `l0_conversations` | 结构化元数据，支持 SQL 过滤查询 |
| | 对话语义向量 | SQLite vec0 虚拟表 | `l0_vec` | 语义向量索引，KNN 相似度搜索原始对话 |
| | 对话全文索引 | SQLite FTS5 虚拟表 | `l0_fts` | Jieba 分词索引，关键词全文检索 |
| **L1 结构化记忆层** | 记忆条目 | JSONL 文件 | `records/YYYY-MM-DD.jsonl` | 持久化记忆条目（id / content / type / priority / scene_name / timestamps） |
| | 记忆元数据 | SQLite 普通表 | `l1_records` | 结构化元数据，支持精确过滤 |
| | 记忆语义向量 | SQLite vec0 虚拟表 | `l1_vec` | 语义向量索引，召回时相似记忆搜索 |
| | 记忆全文索引 | SQLite FTS5 虚拟表 | `l1_fts` | Jieba 分词索引，关键词匹配 |
| **L2 场景归类层** | 场景文件 | Markdown 文件 | `scene_blocks/*.md` | 每个场景一个 .md 文件，含 META + 记忆摘要 + 来源 ID |
| **L3 用户画像层** | 用户画像 | Markdown 文件 | `persona.md` | 用户人格综合描述，末尾附带场景导航，注入 System Prompt |
