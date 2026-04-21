## 项目总览（`agent/`）

本仓库包含 3 个相互配合的子项目：

- **`ai-interview-agent-frontend`**：前端 Web（React + Vite），负责登录、聊天 UI、会话列表、流式展示与结构化卡片展示。
- **`career-planning-backend`**：后端服务（FastAPI），负责用户认证、会话/消息持久化、调用 LLM Agent、RAG 检索增强、SSE 流式输出。
- **`python-milvus-sandbox`**：Python 代码执行沙箱（FastAPI + subprocess + Docker），用于在隔离环境中运行带 Milvus 连接的 Python 代码（供后端“复杂 Milvus 操作/统计/多步骤查询”调用）。

---

## 1) 三个目录之间的逻辑关系、运行流程与要点

### 1.1 逻辑关系（谁依赖谁）

- **前端 → 后端**：
  - 通过 Vite 代理 `/api` 转发到后端（默认 `http://127.0.0.1:8001`）。
  - 认证成功后，前端把 `access_token` 写入 `localStorage`，后续请求在 header 中带 `Authorization: Bearer <token>`。
  - 聊天走 **SSE**：`POST /api/chat/stream`，前端逐行解析 `data: {...}\n\n` 的事件流，实时渲染。

- **后端 → sandbox（代码执行）**：
  - 后端通过 `app/sandbox_client.py` 请求 sandbox 的 `POST /execute`，把要执行的 Python 代码以字符串传入。
  - sandbox 在容器中运行该代码，并自动注入 Milvus 连接配置。

- **后端 → Milvus（间接）**：
  - `career-planning-backend` 不直接连接 Milvus。
  - 所有 Milvus 的操作通过 sandbox 执行（保证隔离、可控、支持复杂操作）。

### 1.2 运行流程（端到端）

#### A. 用户登录流程

1. 前端登录页 `Login.tsx`
2. `POST /api/auth/send-code`：后端发验证码邮件（Redis 做频控与验证码存储）
3. `POST /api/auth/login`：后端验证验证码，创建/更新用户并签发 JWT
4. 前端保存 `access_token`，跳转到主页 `/`
5. 主页路由通过 `useAuth` 调用 `GET /api/auth/me` 验证 token，成功进入聊天界面

#### B. 会话与历史加载流程

1. 侧边栏 `AppSidebar` 启动后调用 `loadConversations`：
   - `GET /api/chat/conversations?skip=0&limit=50`
2. 用户点击某会话后，聊天组件 `CareerChat`：
   - `GET /api/chat/conversations/{conversation_id}/messages`
   - 将历史消息映射到 UI（assistant 消息可带 `key_points/suggestions` 卡片）

#### C. 发送消息 + 流式输出 + 落库流程

1. 前端在 `CareerChat` 中组装 `messages`（取最近 10 条）并调用 `streamCareerChatStructured(messages, conversationId)`
2. 后端 `POST /chat/stream`：
   - 若没有 `conversation_id`：创建会话 `chat_conversations`
   - 先落库 user 消息到 `chat_messages`
   - 调用 `stream_reply(history)` 产生 SSE 流式事件
3. 后端 SSE 事件流（重要字段）：
   - `type=rag_status` / `type=rag_result`：提示检索状态
   - `type=streaming`：增量正文（前端拼接展示）
   - `type=reply`：最终正文 + `key_points/suggestions/retrieved_docs`
   - `type=end`：结束标记
   - 额外附带：`conversation_id`
4. 后端在流式结束时落库 assistant 最终消息（含结构化字段）

#### D. RAG 检索增强与结构化提取流程

1. `stream_reply` 获取最新 user 输入
2. `enhance_query_with_rag` 调用 `search_knowledge`（知识库检索）
3. 将检索结果拼接成增强 prompt 后再调用 Agent（LangChain Tools Agent）
4. Agent 输出末尾被强制追加结构化段落：
   - `【关键点】` 3 条
   - `【建议】` 2 条
5. 后端对流式做过滤：结构化段落不再向前端 `streaming` 透传，最终 `reply.content` 也会裁剪掉结构化段落，避免重复展示
6. `extract_key_points_from_text` / `extract_suggestions_from_text` 优先按结构化段落切分，兜底仍保留正则规则

### 1.3 详细要点（建议牢记）

- **SSE 事件是“增量正文 + 最终结构化”**：前端拼接 `streaming`，并在 `reply/end` 时落定最终消息。
- **会话持久化以 `conversation_id` 为主键**：前端必须在续聊时携带该 id，否则后端会新建会话。
- **Milvus 操作全部通过 sandbox**：后端不直接连 Milvus，复杂检索/统计用 `run_milvus_code`（内部再走 sandbox）。
- **认证依赖 JWT**：所有 chat/history 接口都需要 `Authorization` 头。

### 1.4 核心注意事项（简要）

- **前端必须带 token**（否则后端 401，前端拦截器会跳转 `/login`）。
- **SSE 流里不要把结构化段落当正文渲染**（后端已过滤，但前端仍应以 `type` 驱动 UI）。
- **消息持久化要“先存用户，再存 assistant 最终”**，避免半截流写入导致历史不完整。
- **sandbox 必须先启动且 Milvus 可用**，否则 RAG/复杂 Milvus 操作会降级或失败。

---

## 2) 后端接口与数据表（字段/创建细节）

### 2.1 后端服务入口与路由挂载

- **入口**：`career-planning-backend/app/main.py`
  - lifespan 启动时：初始化 Redis、`Base.metadata.create_all`
  - 挂载路由：
    - `auth.router`（前缀 `/auth`）
    - `chat_router`（前缀 `/chat`）

### 2.2 认证接口（`/auth`）

文件：`career-planning-backend/app/routers/auth.py`

- **POST `/auth/send-code`**
  - **请求体**：`{ email: string }`
  - **作用**：发送邮箱验证码
  - **依赖**：Redis（验证码 5 分钟、频控 60 秒）
  - **响应**：`{ message: string, email: string }`

- **POST `/auth/login`**
  - **请求体**：`{ email: string, code: string, username?: string }`
  - **作用**：校验验证码，登录/注册并返回 JWT
  - **响应**（`TokenResponse`）：
    - `access_token: string`
    - `token_type: "bearer"`
    - `expires_in: number`（当前写死 30 天）
    - `is_new_user: boolean`

- **GET `/auth/me`**
  - **Header**：`Authorization: Bearer <token>`
  - **作用**：获取当前用户信息
  - **响应**（`UserInfoResponse`）：
    - `id: int`
    - `email: string`
    - `username?: string`
    - `avatar_url?: string`
    - `created_at: datetime`
    - `last_login?: datetime`

- **PUT `/auth/username`**
  - **参数**：`username`（当前实现是 query 参数形式）
  - **Header**：`Authorization: Bearer <token>`
  - **作用**：更新用户名（若重名则报错）

### 2.3 聊天接口（`/chat`）

文件：`career-planning-backend/app/routers/chat.py`

#### 会话管理

- **POST `/chat/conversations`**
  - **Header**：`Authorization: Bearer <token>`
  - **请求体**：`{ title?: string }`
  - **响应**：
    - `id: number`
    - `title: string`
    - `last_message_at?: datetime`
    - `created_at?: datetime`

- **GET `/chat/conversations?skip=0&limit=20`**
  - **Header**：`Authorization: Bearer <token>`
  - **响应**：
    - `items: ConversationItem[]`
    - `total: number`

- **GET `/chat/conversations/{conversation_id}/messages`**
  - **Header**：`Authorization: Bearer <token>`
  - **响应**：`ChatMessageResponse[]`
    - `id: number`
    - `role: string`（`user|assistant|system`）
    - `content: string`
    - `key_points?: string[]`
    - `suggestions?: string[]`
    - `retrieved_docs?: object[]`
    - `seq: number`
    - `created_at?: datetime`

- **DELETE `/chat/conversations/{conversation_id}`**
  - **Header**：`Authorization: Bearer <token>`
  - **作用**：软删除（`is_deleted=true`）
  - **响应**：`{ message: "会话已删除" }`

#### 流式聊天（SSE）

- **POST `/chat/stream`**
  - **Header**：`Authorization: Bearer <token>`
  - **请求体**（`ChatStreamRequest`）：
    - `messages: {role, content}[]`（最后一条必须 `role=user`）
    - `conversation_id?: number`
    - `title?: string`（新建会话时用）
  - **输出**：SSE 流（每行 `data: <json>\n\n`）
    - 服务端会在事件里追加 `conversation_id`
    - `type` 可能包括：
      - `rag_status`
      - `rag_result`
      - `streaming`
      - `reply`
      - `error`
      - `end`

### 2.4 数据表（SQLAlchemy 模型字段）

> 注：当前项目通过 `Base.metadata.create_all` 自动建表（无 Alembic 迁移）。

#### `users`（文件：`career-planning-backend/app/models/user.py`）

- **id**：`Integer`，PK，index
- **email**：`String(100)`，unique，not null，index
- **username**：`String(50)`，nullable
- **avatar_url**：`String(500)`，nullable
- **is_active**：`Boolean`，default `true`
- **role**：`Enum(UserRole)`，default `user`
- **created_at**：`DateTime(tz)`，server_default `now()`
- **updated_at**：`DateTime(tz)`，onupdate `now()`
- **last_login**：`DateTime(tz)`，nullable

#### `chat_conversations`（文件：`career-planning-backend/app/models/chat.py`）

- **id**：`BigInteger`，PK，index
- **user_id**：`Integer`，FK `users.id`，`ON DELETE CASCADE`，index
- **title**：`String(120)`，default `"新会话"`，not null
- **last_message_at**：`DateTime(tz)`，server_default `now()`，index
- **is_deleted**：`Boolean`，default `false`，index
- **created_at**：`DateTime(tz)`，server_default `now()`
- **updated_at**：`DateTime(tz)`，server_default `now()`，onupdate `now()`
- **索引**：
  - `idx_chat_conversations_user_last_msg (user_id, last_message_at)`

#### `chat_messages`（文件：`career-planning-backend/app/models/chat.py`）

- **id**：`BigInteger`，PK，index
- **conversation_id**：`BigInteger`，FK `chat_conversations.id`，`ON DELETE CASCADE`，index
- **role**：`String(20)`，not null（`user|assistant|system`）
- **content**：`Text`，not null
- **key_points**：`JSON`，nullable（assistant 结构化）
- **suggestions**：`JSON`，nullable（assistant 结构化）
- **retrieved_docs**：`JSON`，nullable（RAG 检索的文档列表）
- **seq**：`Integer`，not null（同会话内消息顺序）
- **created_at**：`DateTime(tz)`，server_default `now()`，index
- **约束/索引**：
  - `uq_chat_messages_conversation_seq (conversation_id, seq)`（唯一）
  - `idx_chat_messages_conversation_created (conversation_id, created_at)`

---

## 3) 前端交互功能清单 + 实现过程简述

### 3.1 前端整体路由与布局

- `src/App.tsx`
  - `/login`：登录页
  - `/`：受保护路由（`PrivateRoute`），进入 `Layout` + `CareerChat`
- `src/components/Layout.tsx`
  - 使用 `SidebarProvider` 包裹
  - 左侧 `AppSidebar`，右侧渲染聊天主区域

### 3.2 登录/鉴权交互

- **发送验证码**
  - UI：`Login.tsx` 点击“发送验证码”
  - API：`src/apis/auth.ts` → `POST /api/auth/send-code`
  - UI 行为：60s 倒计时、禁用重复发送

- **登录/注册**
  - UI：`Login.tsx` 点击“登录/注册”
  - API：`POST /api/auth/login`
  - 成功：保存 `access_token`，跳转 `/`

- **路由守卫**
  - `useAuth`：启动时 `GET /api/auth/me`
  - 未登录：重定向到 `/login`
  - 401：`src/utils/request.ts` 会清理 token 并跳转 `/login`

### 3.3 会话列表（侧边栏）交互

文件：`src/components/app-sidebar.tsx`

- **进入页面自动加载会话列表**
  - 调用 store：`loadConversations()`
  - API：`GET /api/chat/conversations`
- **新建对话**
  - 点击“新对话”按钮
  - store：`createSession()` → API `POST /api/chat/conversations`
  - 增量优化：若当前 active 会话本身就是“新对话”（无消息，且标题为空/`新对话`），则复用当前会话，不再重复创建
  - 将新会话置顶并设为 active
- **切换对话**
  - 点击某条会话
  - store：`setActiveSession(id)` 并跳转路由到 `/`（确保从任意功能页都能直接切回对话区并打开该会话）
  - 聊天区会触发加载该会话消息（见 3.4）
- **删除对话**
  - 点击垃圾桶
  - API：`DELETE /api/chat/conversations/{id}`
  - 前端从 sessions 中移除并自动切换到其他会话

### 3.4 聊天区交互（流式显示 + 结构化卡片）

文件：`src/components/career-chat.tsx`

- **首次进入会话时加载历史**
  - API：`GET /api/chat/conversations/{id}/messages`
  - 将后端字段映射到 UI：
    - `key_points` → `keyPoints`
    - `suggestions` → `suggestions`
- **发送消息**
  - UI：输入框 Enter 发送 / 点击发送按钮
  - 逻辑：
    - 追加一条 user message 到本地 state
    - 追加一条临时 assistant message（`isStreaming=true`）
    - 取最近 10 条作为 `historyMessages`
    - 调用 `streamCareerChatStructured(historyMessages, conversationId)`
- **流式渲染**
  - SSE `type=streaming`：把 `event.content` 追加到 `assistantContent` 并刷新最后一条 assistant message
  - SSE `type=reply`：更新最终正文、收集 `key_points/suggestions`
  - SSE `type=end`：把最后一条 assistant message 固化（`isStreaming=false`），并附加卡片数据
- **停止生成**
  - UI：生成中按钮变为“停止”
  - 调用 `AbortController.abort()` 中断请求
- **滚动体验**
  - 自动滚动到底部（可检测用户滚动打断）
  - 右下角“回到底部”按钮
- **结构化卡片展示**
  - assistant 消息下方展示：
    - **关键要点**卡片（蓝色）
    - **建议**卡片（绿色）

---

## 4) `python-milvus-sandbox` 集成概述

### 4.1 这个项目解决什么问题

- 为“**复杂 Milvus 操作**”提供隔离执行环境：
  - 多步骤查询/统计
  - 自定义数据处理
  - 跨集合操作
- 避免在主后端进程里直接执行任意 Python 代码，降低安全与稳定风险。

### 4.2 运行与网络

- `docker-compose-milvus.yml`：
  - 起 `etcd + minio + milvus standalone`
  - Milvus 暴露：`19530` / `9091`
- `docker-compose.yml`：
  - 起 sandbox 服务：`python-milvus-sandbox`（端口 `8000`）
  - 环境变量：
    - `MILVUS_HOST=host.docker.internal`
    - `MILVUS_PORT=19530`

### 4.3 对外 API

文件：`python-milvus-sandbox/src/server.py`

- **POST `/execute`**
  - 请求：`{ code: string, timeout?: number }`
  - 行为：
    - 把 `code` 包装进“自动连接 Milvus + 捕获 stdout/stderr”的模板
    - 写临时 `.py` 文件
    - `subprocess.run(["python", temp_file], timeout=...)`
  - 响应：
    - `success: boolean`
    - `output: string`（stdout）
    - `error?: string`（stderr）

- **GET `/health`**
  - 返回 sandbox 与 milvus host 信息

### 4.4 后端如何调用 sandbox

文件：`career-planning-backend/app/sandbox_client.py`

- `execute_python_code(code: str, timeout: int=60)`：
  - `httpx` 调用 `http://localhost:8000/execute`
  - 统一返回 `{"success","output","error"}`

文件：`career-planning-backend/app/rag_client.py`

- 通过 sandbox 执行 pymilvus 代码：
  - 初始化 collection / 创建索引
  - insert 知识条目
  - search 相似度检索
  - stats 统计信息

---

## 5) 技术栈清单（3 个项目合并）+ 作用简述

### 5.1 前端（`ai-interview-agent-frontend`）

- **React 19**：组件化 UI，渲染聊天/登录/侧边栏
- **TypeScript**：类型约束，减少运行时错误
- **Vite**：开发/构建工具，提供 dev server 与代理 `/api`
- **React Router**：路由与 PrivateRoute 守卫
- **Zustand**：轻量状态管理（会话列表、active 会话、消息缓存）
- **Tailwind CSS**：原子化样式
- **shadcn/ui + Radix**：UI 组件体系（Sidebar、Card、Button 等）
- **lucide-react**：图标库
- **axios**：非 SSE 请求封装（auth 等），含拦截器自动带 token
- **Fetch API**：用于 SSE 流式读取（`ReadableStream` + `TextDecoder`）
- **ESLint/Prettier**：代码规范与格式化

### 5.2 后端（`career-planning-backend`）

- **FastAPI**：HTTP API + SSE 输出
- **Uvicorn**：ASGI 运行器
- **Pydantic v2**：请求/响应模型校验
- **SQLAlchemy 2 + asyncpg**：异步 ORM + PostgreSQL 驱动
- **PostgreSQL**：持久化用户、会话、消息
- **Redis**：验证码/频控等短期状态
- **python-jose**：JWT 编解码（认证）
- **passlib[bcrypt]**：密码/哈希工具（当前主要用于安全工具集）
- **httpx**：后端调用 sandbox 的 HTTP 客户端
- **LangChain（core/openai）**：构建 Tools Agent、流式事件、工具调用编排
- **dotenv**：环境变量加载（API key、DB、Redis 等）

### 5.3 sandbox（`python-milvus-sandbox`）

- **FastAPI + Uvicorn**：提供 `/execute` 的 HTTP 服务
- **subprocess**：启动独立 Python 进程执行用户代码
- **tempfile**：临时文件管理
- **Docker / Docker Compose**：隔离执行环境、编排 Milvus/依赖服务
- **pymilvus**：Milvus Python SDK（collection、search、index 等）
- **Milvus + etcd + MinIO**：
  - Milvus：向量数据库
  - etcd：元数据/协调
  - MinIO：对象存储（Milvus 持久化依赖）

---

## 6) 增量补充：岗位画像 / 学生能力画像 / 发展报告（三个页面全链路）

> 说明：以下为新增功能的总结补充，原有章节内容保持不变。

### 6.1 前端路由入口与页面挂载

文件：`ai-interview-agent-frontend/src/App.tsx`

- `/career/jobs`：`CareerJobs`（岗位画像 & 图谱）
- `/career/profile`：`StudentProfilePage`（学生能力画像）
- `/career/reports`：`CareerReportsPage`（职业生涯发展报告）
- 三个路由均使用 `PrivateRoute`（依赖 `useAuth` → `GET /api/auth/me` 验证 token）

侧边栏入口：

- `src/components/app-sidebar.tsx` 中“功能”区：
  - 岗位画像&图谱 → `navigate('/career/jobs')`
  - 学生能力画像 → `navigate('/career/profile')`
  - 发展报告 → `navigate('/career/reports')`

### 6.2 前端 API 封装（统一带 token）

文件：`ai-interview-agent-frontend/src/lib/career-api.ts`

- 认证头：`getAuthHeaders()` 从 `localStorage.access_token` 取 token，组装 `Authorization: Bearer <token>`
- JSON 请求：`jsonFetch<T>()` 统一设置 `Content-Type: application/json` 并附加 token；非 2xx 会读取文本错误并抛异常
- 文件上传：`uploadResume()` 使用 `FormData`，仅附加 token（不显式设置 `Content-Type`，由浏览器生成 boundary）

### 6.3 后端路由总览与鉴权（`/career`）

文件：`career-planning-backend/app/routers/career.py`

- 路由前缀：`/career`
- 鉴权：全部接口依赖 `get_current_user`（Header：`Authorization: Bearer <token>`）
- 数据表创建：`career-planning-backend/app/main.py` lifespan 内执行 `Base.metadata.create_all`，包含本节涉及的所有 career 表

---

## 6.4 岗位画像 & 图谱（页面：`/career/jobs`）

### 6.4.1 前端页面交互（`CareerJobs`）

文件：`ai-interview-agent-frontend/src/components/career-jobs.tsx`

- 页面加载/切换筛选时刷新：
  - `refresh()` 会先调用 `seedCareerData()`（`POST /api/career/seed`），再并行请求：
    - `listJobs()`（`GET /api/career/jobs`）
    - `getJobGraph(relationType?)`（`GET /api/career/graph?relation_type=...`）
- 关系筛选：
  - `relationType = all|vertical|transition`
  - `all` 不传参；其他传 `relation_type`
- UI 展示：
  - 左侧按 `category` 分组展示岗位画像（名称/级别/简介/技能/证书）
  - 右侧展示岗位关系列表（from → to + relation_type + title/rationale）
- 错误处理：
  - 捕获异常后展示 `error` 文案（来自后端返回文本或 HTTP status）

### 6.4.2 后端接口与核心逻辑

文件：`career-planning-backend/app/routers/career.py`

- **POST `/career/seed`**
  - 作用：确保岗位画像与关系图谱存在（MVP 允许普通用户触发）
  - 内部：`ensure_seed_job_data(db)`
- **GET `/career/jobs`**
  - 可选 query：`category`
  - 内部：先 `ensure_seed_job_data(db)`，再按 `(category asc nulls last, name asc)` 排序返回
- **GET `/career/graph?relation_type=vertical|transition`**
  - 内部：先 `ensure_seed_job_data(db)`
  - 返回：`jobs` 全量 + `relations` 按类型过滤（不传则返回全部）

文件：`career-planning-backend/app/services/career_service.py`

- `ensure_seed_job_data(db)`：
  - 若 `job_profiles` 已有数据则直接返回
  - 否则一次性插入：
    - >=10 条 `JobProfile`（覆盖技能/证书/通用能力/实习等字段）
    - 关系图谱 `JobRelation`：
      - `vertical`（垂直发展/晋升）
      - `transition`（换岗路径，带 `requirements_gap` 的 JSON 提示）

### 6.4.3 数据表（岗位画像/关系图谱）

文件：`career-planning-backend/app/models/career.py`

#### `job_profiles`

- **id**：`BigInteger`，PK，index
- **code**：`String(80)`，unique（`uq_job_profiles_code`），index（稳定标识）
- **name**：`String(120)`，index
- **category**：`String(120)`，nullable，index
- **level**：`String(50)`，nullable，index
- **description**：`Text`，nullable
- **skills/certificates/competencies/internship/other_requirements**：`JSON`，nullable
- **created_at/updated_at**：`DateTime(tz)`（`updated_at` onupdate）
- **索引**：
  - `idx_job_profiles_category_level (category, level)`

#### `job_relations`

- **id**：`BigInteger`，PK，index
- **relation_type**：`String(30)`，index（`vertical|transition`）
- **from_job_id/to_job_id**：FK → `job_profiles.id`（`ON DELETE CASCADE`）
- **title**：`String(200)`，nullable
- **rationale**：`Text`，nullable
- **requirements_gap**：`JSON`，nullable
- **created_at**：`DateTime(tz)`
- **索引**：
  - `idx_job_relations_type_from (relation_type, from_job_id)`
  - `idx_job_relations_type_to (relation_type, to_job_id)`

---

## 6.5 学生能力画像（页面：`/career/profile`）

### 6.5.1 前端页面交互（`StudentProfilePage`）

文件：`ai-interview-agent-frontend/src/components/student-profile.tsx`

- 页面启动加载历史：
  - `listStudentProfiles()` → `GET /api/career/student-profiles`（按创建时间倒序，最多 50 条）
- 生成画像（方式一：手动录入）：
  - 文本 >=10 字才可提交
  - `createStudentProfileManual(text)` → `POST /api/career/student-profiles/manual`
- 生成画像（方式二：简历上传）：
  - 支持 `txt/md/text/pdf/docx`
  - 可选补充 `textHint`（例如城市/意向/额外信息）一起提交以提高提取质量
  - `uploadResume(file, textHint?)` → `POST /api/career/student-profiles/resume`（multipart/form-data）
- UI 展示：
  - 右侧列表展示历史画像概览（来源、技能/证书摘要、完整度/竞争力评分）
  - 对最新一条画像做“摘要聚合展示”（从 JSON 字段中抽取教育/技能/证书/项目/实习/通用素质/评分依据摘要）

### 6.5.2 后端接口与核心逻辑

文件：`career-planning-backend/app/routers/career.py`

- **POST `/career/student-profiles/manual`**
  - 请求体：`{ text: string(min_length=10) }`
  - 内部：`build_student_profile_from_text(db, user_id, source_type="manual", source_text=text)`
- **POST `/career/student-profiles/resume`**
  - 表单：
    - `file`（必填）
    - `text_hint`（可选）
  - 内部流程：
    - `extract_text_from_upload(filename, content_type, raw)` 尝试提取文本（txt/pdf/docx）
    - 合并：`merged = text_hint + extracted`
    - 若 `merged` 长度 < 10：
      - 返回 400
      - 若 PDF 为扫描件无文本层，会附带提示“可能是扫描件图片版”
    - 再调用 `build_student_profile_from_text(..., source_type="resume_upload", source_text=merged)`
- **GET `/career/student-profiles`**
  - 返回当前用户画像列表（倒序、limit 50）
- **GET `/career/student-profiles/{profile_id}`**
  - 只能读取自己的画像；不存在则 404

文件：`career-planning-backend/app/services/career_service.py`

- `build_student_profile_from_text(...)`：
  - 使用 LLM（`create_llm(streaming=False)`）按固定字段输出 JSON：
    - `skills/certificates/competencies/internship/projects/education/awards`
    - `completeness_score/competitiveness_score/scoring_detail`
  - 解析：`_safe_json_loads()` 兼容 ```json 包裹、截取第一个 `{...}` 块
  - 兜底：若解析失败，仍会落库一份“空画像 + 默认分数 40”
  - 入库后返回 `StudentCapabilityProfile`

文件：`career-planning-backend/app/utils/resume_extract.py`

- `extract_text_from_upload()`：
  - txt：utf-8，失败再尝试 gbk
  - pdf：优先 PyMuPDF，其次 pypdf；若无文本层返回 `pdf(no_text_layer)`
  - docx：python-docx 读取段落与表格文本

### 6.5.3 数据表（学生能力画像）

文件：`career-planning-backend/app/models/career.py`

#### `student_capability_profiles`

- **id**：`BigInteger`，PK，index
- **user_id**：`Integer`，FK → `users.id`（`ON DELETE CASCADE`），index
- **source_type**：`String(30)`（`manual|resume_upload`）
- **source_text**：`Text`（原始输入/提取文本，MVP 直接存）
- **source_filename**：`String(260)`，nullable
- **skills/certificates/competencies/internship/projects/education/awards**：`JSON`，nullable
- **completeness_score/competitiveness_score**：`Integer`（0-100），nullable
- **scoring_detail**：`JSON`，nullable
- **created_at/updated_at**：`DateTime(tz)`
- **索引**：
  - `idx_student_profiles_user_created (user_id, created_at)`

---

## 6.6 职业生涯发展报告（页面：`/career/reports`）

### 6.6.1 前端页面交互（`CareerReportsPage`）

文件：`ai-interview-agent-frontend/src/components/career-reports.tsx`

- 页面启动时统一加载所需数据：
  - `listJobs()`（岗位下拉）
  - `listStudentProfiles()`（画像下拉）
  - `listReports()`（历史报告列表）
  - 若未选择：默认选择第一条画像/岗位/报告作为 active
- 生成报告：
  - 选择画像 + 目标岗位 +（可选）意愿约束 intention
  - `createReport(profileId, jobId, intention?)` → `POST /api/career/reports`
  - 生成后 `refresh()` 并切换到新报告
- 编辑保存：
  - 编辑标题与 Markdown（实际上是“纯文本结构”，但存放在 `content_markdown` 字段）
  - `updateReport(reportId, {title, content_markdown})` → `PUT /api/career/reports/{id}`
- 智能润色：
  - `polishReport(reportId)` → `POST /api/career/reports/{id}/polish`
  - 返回的新内容直接覆盖编辑器内容
- 导出：
  - `exportReport(reportId, fmt=txt|md|html)` → `GET /api/career/reports/{id}/export?fmt=...`
  - 前端将 `content` 生成 Blob 并触发下载（文件名使用当前编辑器标题）

### 6.6.2 后端接口与核心逻辑

文件：`career-planning-backend/app/routers/career.py`

- **POST `/career/reports`**
  - 请求体：`{ student_profile_id, target_job_id, intention? }`
  - 内部：`ensure_seed_job_data(db)` → `build_report_for_student(...)`
- **GET `/career/reports`**
  - 返回当前用户报告列表（倒序、limit 50）
- **GET `/career/reports/{report_id}`**
  - 只能读取自己的报告；不存在则 404
- **PUT `/career/reports/{report_id}`**
  - patch：`{ title?, content_markdown?, status? }`
  - status 仅允许 `draft|finalized`
  - 更新 `updated_at = utcnow()` 后 commit
- **POST `/career/reports/{report_id}/polish`**
  - MVP：复用“导出/润色”逻辑，让 LLM 对现有报告做语言优化与完整性检查
- **GET `/career/reports/{report_id}/export?fmt=txt|md|html`**
  - `txt`：返回“纯文本结构”（去掉 Markdown 符号）
  - `md`：把“纯文本结构”转换为 Markdown 标题层级
  - `html`：用 `<pre>` 包裹并做简单转义
  - 同时写入 `ReportExportArtifact`（记录导出格式/内容/生成时间）

文件：`career-planning-backend/app/services/career_service.py`

- `build_report_for_student(...)`：
  - 读取并校验：
    - `StudentCapabilityProfile` 必须属于当前用户，否则报错
    - `JobProfile` 必须存在
  - `match = _score_match(student, job)`：
    - 专业技能：按 `skills` 交集比例打分
    - 通用素质：按 `competencies` 关键字段是否存在粗估
    - 综合：\(overall = 0.6 * skill\_match + 0.4 * comp\_match\)
    - 输出 notes（重叠/缺失技能列表）
  - LLM 生成报告：
    - 强约束输出为“纯文本结构”，禁止 Markdown 符号
    - 必须包含“一、二、三、四”四章（匹配/路径/行动计划/完整性检查）
    - 对未知信息以“需补充：...”标注，避免胡编
  - 入库：`CareerDevelopmentReport`（`content_markdown` 存“纯文本结构”）
- `to_markdown_export(content_markdown, mode)`：
  - `markdown`：用于 `txt` 导出（返回纯文本结构）
  - `md`：将“标题：...”与“一、二、三...”转换为 Markdown `# / ##`（用于 md 导出）
  - `html`：转义后 `<pre>` 包裹（用于 html 导出）
  - `polish`：LLM 对原报告润色，仍输出纯文本结构

### 6.6.3 数据表（报告与导出产物）

文件：`career-planning-backend/app/models/career.py`

#### `career_development_reports`

- **id**：`BigInteger`，PK，index
- **user_id**：`Integer`，FK → `users.id`（`ON DELETE CASCADE`），index
- **student_profile_id**：FK → `student_capability_profiles.id`（`ON DELETE SET NULL`），index
- **target_job_id**：FK → `job_profiles.id`（`ON DELETE SET NULL`），index
- **title**：`String(200)`，default `职业生涯发展报告`
- **status**：`String(30)`，default `draft`（`draft|finalized`）
- **content_markdown**：`Text`（实际存“纯文本结构报告”，编辑/润色/导出均以此为准）
- **content_json**：`JSON`，nullable（预留结构化段落）
- **match_summary**：`JSON`，nullable（各维度匹配度/差距）
- **overall_match_score**：`Integer`，nullable（0-100）
- **action_plan**：`JSON`，nullable（预留行动计划结构化）
- **created_at/updated_at**：`DateTime(tz)`
- **索引**：
  - `idx_reports_user_created (user_id, created_at)`
  - `idx_reports_profile_job (student_profile_id, target_job_id)`

#### `report_export_artifacts`

- **id**：`BigInteger`，PK，index
- **report_id**：`BigInteger`，FK → `career_development_reports.id`（`ON DELETE CASCADE`）
- **export_format**：`String(30)`（`txt|md|html`）
- **artifact_text**：`Text`（MVP：直接保存导出文本）
- **artifact_meta**：`JSON`（例如 `generated_at`）
- **created_at**：`DateTime(tz)`
- **索引**：
  - `idx_export_report_created (report_id, created_at)`
