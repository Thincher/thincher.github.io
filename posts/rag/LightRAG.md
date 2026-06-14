---
title: LightRAG 架构深度解析
date: 2026-05-24
category: RAG
tags: [RAG,Graph,VectorSearch]
description: 解析 LightRAG 的知识图谱 + 向量混合检索架构与写入检索流程。
---

## RAG

- [概述](#概述)
- [写入](#写入)
- [检索](#检索)
  - [存储详解](#存储详解)

# 概述

LightRAG 是一个基于知识图谱的检索增强生成（RAG）框架。写入时，文档经去重、Chunking 后并行存储，同时通过 LLM 提取实体和关系构建知识图谱。检索时支持多种模式（naive/local/global/hybrid/mix/bypass），mix 模式结合实体图遍历、关系检索和向量 chunks 检索，通过 Round-Robin 合并结果后交由 LLM 生成答案。LightRAG 采用 4 类存储：KV Storage（文档/chunks/索引）、Vector Storage（向量索引）、Graph Storage（实体关系图）、Doc Status Storage（处理状态）。

---

# 写入
```
原始文档（.md/.txt/.pdf...）
    │
    ▼
[1] 去重 & 入队
    │ 计算 MD5 doc_id，过滤已存在的文档
    ▼
[2] 文档切分（Chunking）
    │ 按 Token 数切分，每块最大 1200 tokens，重叠 100 tokens
    ▼
[3] 并行写入 Chunk 存储
    │
    ├── chunks_vdb（向量库）写入 chunk 原文 + embedding
    ├── text_chunks（KV 库）写入 chunk 原文（用于后续读取）
    └── doc_status（状态库）更新为 PROCESSING 状态
    │
    ▼
[4] LLM 提取实体和关系（每个 chunk 执行一次）
    │
    ├── 第 1 次 LLM 调用：初始提取
    │     同一次调用，实体和关系一起输出，格式如下：
    │     entity<|#|>Python<|#|>technology<|#|>一种编程语言...
    │     entity<|#|>Transformer<|#|>concept<|#|>注意力机制架构...
    │     relation<|#|>Python<|#|>Transformer<|#|>实现工具<|#|>Python 用于实现...
    │
    └── 第 2 次 LLM 调用：Gleaning（淘洗补充）
          带入第一次结果作为 history，再次提问"是否还有遗漏"
          两次结果合并（保留 description 更长的）
    │
    ├───────────────────────────────┐
    ▼                               ▼
[5a] 实体合并写入               [5b] 关系（边）合并写入
    │                               │
    从图库读取已有同名节点          从图库读取已有同名边
    合并 description（去重拼接）    合并 description（去重拼接）
    entity_type 频次投票            weight 累加（每次 +1.0）
    │                               keywords 去重合并
    │（description 过长时）         │（description 过长时）
    ▼                               ▼
    第 3 次 LLM：实体描述摘要       第 4 次 LLM：关系描述摘要
    │                               │
    ▼                               ▼
  upsert_node 写入图库            upsert_edge 写入图库
  entities_vdb 向量化写入         relationships_vdb 向量化写入
  entity_chunks KV 写入           relation_chunks KV 写入
    │                               │
    └───────────────┬───────────────┘
                    ▼
[6] 更新文档状态为 PROCESSED，写入 full_entities / full_relations 索引
```

# 检索

| 模式 | ll_keywords → entities_vdb | hl_keywords → relationships_vdb | query → chunks_vdb | Round-Robin | 说明 |
|------|:--------------------------:|:------------------------------:|:------------------:|:-----------:|------|
| `naive` | | | ✅ | | 仅向量检索 text chunks |
| `local` | ✅ | | | | 基于 ll_keywords 检索实体，再图遍历找邻接边 |
| `global` | | ✅ | | | 基于 hl_keywords 检索关系，找边的两端实体 |
| `hybrid` | ✅ | ✅ | | ✅ | local + global，Round-Robin 合并实体和关系 |
| `mix` | ✅ | ✅ | ✅ | ✅ | local + global + vector chunks，实体关系 Round-Robin，chunks 直接追加 |
| `bypass` | | | | | 跳过检索，直接发送对话历史+问题给 LLM |

Round-Robin：代码中出现两次，作用不同：
1. 实体/关系合并（两路）：local_entities + global_entities → final_entities，local_relations + global_relations → final_relations。交错合并，去重（seen_entities / seen_relations）。
2. Chunks 合并（三路）：vector_chunks + entity_chunks + relation_chunks → merged_chunks。交错合并，去重（seen_chunk_ids）。意义：让不同来源的 chunk 交替出现，避免同类内容扎堆，确保检索结果多样性。

mix 模式：
``` 
用户 Query："注意力机制的核心原理是什么？"
    │
    ▼
[1] 关键词提取（1 次 LLM 调用）
    │  hl_keywords（高层）：["注意力机制", "神经网络", "深度学习"]
    │  ll_keywords（低层）：["Attention", "Q/K/V", "Transformer"]
    │
    ├─────────────────────────────────────────────────────────────┐
    ▼                             ▼                             ▼
[2a] Local 路径           [2b] Global 路径           [2c] Vector Chunks
    │                             │                             │
ll_keywords →              hl_keywords →              query →
entities_vdb 向量检索       relationships_vdb 向量检索  chunks_vdb 向量检索
    │                             │                             │
    ▼                             ▼                             ▼
local_entities              global_relations              vector_chunks
local_relations             global_entities
    │                             │                             │
    └────────────┬────────────────┘                             │
                 ▼                                               │
[3a] Round-Robin 合并实体/关系（两路）                            │
    │  local_entities + global_entities → final_entities         │
    │  local_relations + global_relations → final_relations      │
    │  交错合并，去重                                             │
    │                                                            │
                 ▼                                               │
[3b] Token 预算截断                                              │
    │  实体 Token 数 ≤ max_entity_tokens（默认 6000）             │
    │  关系 Token 数 ≤ max_relation_tokens（默认 8000）           │
    │  vector_chunks 不受此限制，由 chunk_top_k 控制              │
    │                                                            │
                 ▼                                               │
[3c] 根据截断后的实体/关系找关联 chunks ◄────────────────────────┘
    │  entity_chunks：从 final_entities 的 source_id 找 chunks
    │  relation_chunks：从 final_relations 的 source_id 找 chunks
    │  vector_chunks：来自 [2c] 的向量检索结果
    │
                 ▼
[3d] Round-Robin 合并 chunks（三路）
    │  vector_chunks + entity_chunks + relation_chunks → merged_chunks
    │  交错合并，去重（seen_chunk_ids）
    │
                 ▼
[4] 拼装 Context 字符串（分类拼接）
    │
    │  ===== Entities =====
    │  │  Knowledge Graph Data (Entity)
    │  │  格式：```json
    │  │    {entity_name, entity_type, description, reference_id, file_path}
    │  │  ```
    │  │
    │  ===== Relationships =====
    │  │  Knowledge Graph Data (Relationship)
    │  │  格式：```json
    │  │    {src_id, tgt_id, description, keywords, weight, reference_id, file_path}
    │  │  ```
    │  │
    │  ===== Text Chunks =====
    │  │  Document Chunks（带 reference_id 引用 Reference Document List）
    │  │  格式：```json
    │  │    {reference_id, content}
    │  │  ```
    │  │
    │  ===== Reference Document List =====
    │     映射 reference_id → file_path，格式：[ref_id] /path/to/file.pdf
    │
                 ▼
[5] LLM 生成最终回答（1 次 LLM 调用）
    │  System Prompt = rag_response + Context
    │  User Query = 用户原始问题
    ▼
最终回答（含来源引用）
```


---

## 存储详解

LightRAG 使用 4 大类存储，底层支持多种后端实现。

### 统一存储表

| 存储类型 | 存储名 | 后端 | 用途 |
|----------|--------|------|------|
| **KV Storage** | `full_docs` | JSONKVStorage | 原始文档完整内容，key 是 doc_id，value 是文档原文或解析结果 |
| | `text_chunks` | JSONKVStorage | 切分后的 chunk 原文，key 是 chunk_id（`chunk-{md5}`），value 含 `content`、`tokens`、`full_doc_id`、`chunk_order_index` |
| | `full_entities` | JSONKVStorage | 每个文档关联的实体名列表，key 是 doc_id，value `{"entity_names": [...], "count": n}` |
| | `full_relations` | JSONKVStorage | 每个文档关联的关系对列表，key 是 doc_id，value `{"relation_pairs": [[src, tgt], ...], "count": n}` |
| | `entity_chunks` | JSONKVStorage | 追踪实体→chunks 关系，key 是实体名，value `{"chunk_ids": [...], "count": n}` |
| | `relation_chunks` | JSONKVStorage | 追踪关系→chunks 关系，key 是 `src\|tgt`，value 同上 |
| | `llm_response_cache` | JSONKVStorage | LLM 响应缓存，通过 prompt hash 的 cache_key 避免重复调用 LLM |
| **Vector Storage** | `chunks_vdb` | Faiss/Milvus/Qdrant/PGVector/Neo4j/MongoDB/Redis/OpenSearch/NanoVectorDB | chunk 向量 embedding，用于 naive/mix 模式检索 |
| | `entities_vdb` | 同上 | 实体向量 embedding，key 是实体名，用于 local 模式检索 |
| | `relationships_vdb` | 同上 | 关系向量 embedding，key 是 `src\|tgt`，用于 global 模式检索 |
| **Graph Storage** | `entity_relation_graph` | NetworkX（默认）/ Neo4jStorage / PGStorage / JsonGraphStorage / MemgraphStorage | 知识图谱核心存储，存储所有实体节点和关系边 |
| **Doc Status Storage** | `doc_status` | JsonDocStatusStorage（默认）/ PGDocStatusStorage | 追踪文档处理状态：`PENDING → PROCESSING → PROCESSED / FAILED` |

### 图存储详细属性

**节点属性**：
- `entity_name`: 实体名称
- `entity_type`: 实体类型（频次投票确定）
- `description`: 实体描述（多 chunk 合并后可能经 LLM 摘要）
- `source_id`: 关联的 chunk_id 列表（`GRAPH_FIELD_SEP` 分隔）
- `file_path`: 来源文件路径
- `created_at`: 创建时间戳

**边属性**：
- `src_id` / `tgt_id`: 源/目标实体名
- `weight`: 权重（合并时累加，默认 +1.0）
- `keywords`: 关系关键词（去重合并）
- `description`: 关系描述

### Doc Status 记录内容

- `status`: 当前状态
- `chunks_count`: chunk 数量
- `chunks_list`: chunk_id 列表
- `full_docs`: 解析后的文档内容
- `error`: 错误信息（如果失败）
- `metadata`: 元数据（处理时间、chunk 策略等）

### 存储隔离

通过 `workspace` 参数实现数据隔离：
- **文件后端**：不同 workspace 使用不同子目录
- **集合后端**（如 Milvus）：collection name 加 workspace 前缀
- **关系型后端**（如 PostgreSQL）：通过 workspace 列过滤