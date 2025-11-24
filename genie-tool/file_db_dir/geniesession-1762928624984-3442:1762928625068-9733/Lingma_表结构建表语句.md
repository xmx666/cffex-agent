# （一）lingma_chat_info 表结构定义

```sql
CREATE TABLE lingma_chat_info (
    chat_id VARCHAR(64) NOT NULL COMMENT '会话唯一标识符，采用UUID格式',
    user_id VARCHAR(64) NOT NULL COMMENT '发起会话的用户唯一标识符',
    project_id VARCHAR(64) NULL COMMENT '关联的项目ID，若会话未绑定项目则为NULL',
    session_name VARCHAR(255) NULL COMMENT '用户自定义的会话名称，用于界面展示',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '会话创建时间，精确到毫秒',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '会话最后更新时间，自动更新',
    status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active' COMMENT '会话状态：active（活跃）、archived（归档）、deleted（已删除）',
    model_name VARCHAR(128) NULL COMMENT '本次会话所使用的AI模型名称，如 "lingma-7b"、"lingma-13b" 等',
    temperature DECIMAL(3,2) NULL COMMENT '采样温度参数，范围0.0~1.0，用于控制生成随机性',
    top_p DECIMAL(3,2) NULL COMMENT '核采样阈值，范围0.0~1.0，用于控制生成词汇的累积概率',
    max_tokens INT NULL COMMENT '单次响应最大生成token数量限制',
    language VARCHAR(16) NULL COMMENT '会话交互语言，如 "zh-CN"、"en-US" 等',
    context_length INT NULL COMMENT '当前会话上下文保留的token总数',
    total_messages INT NOT NULL DEFAULT 0 COMMENT '该会话中累计发送的消息总数',
    total_tokens_used BIGINT NOT NULL DEFAULT 0 COMMENT '该会话累计消耗的总token数',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE COMMENT '是否被用户置顶，用于界面排序',
    metadata JSON NULL COMMENT '扩展元数据，存储用户自定义的会话配置或标签信息',
    PRIMARY KEY (chat_id),
    INDEX idx_user_id (user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status),
    INDEX idx_model_name (model_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储用户与Lingma AI系统的对话会话元信息';
```

该表用于记录用户与Lingma AI系统之间所有对话会话的元数据信息。每一条记录代表一个独立的对话会话，其生命周期由用户创建、交互、归档或删除控制。`chat_id` 作为主键，采用全局唯一UUID格式，确保在分布式系统中不会发生冲突。`user_id` 为外键引用，关联至用户系统，用于权限控制与数据隔离。`project_id` 为可选字段，允许用户将对话绑定至特定项目，便于项目级会话管理与检索。

会话状态 `status` 字段采用枚举类型，支持三种状态：`active` 表示当前正在使用的会话；`archived` 表示用户主动归档、不再活跃但保留历史的会话；`deleted` 表示用户已删除但系统可能仍保留逻辑删除记录（用于审计或恢复）。该设计支持用户对会话进行精细化管理，避免数据丢失。

`model_name` 字段记录了用户在该会话中实际调用的AI模型版本，这对于后续的模型性能分析、用户偏好追踪、计费策略制定具有重要意义。例如，部分用户可能偏好使用 `lingma-13b` 模型进行复杂代码生成，而另一些用户则使用轻量级 `lingma-7b` 模型进行快速问答。该字段支持按模型维度进行会话量、token消耗、响应质量等多维度统计分析。

`temperature` 与 `top_p` 是AI生成模型的核心超参数，分别控制生成结果的随机性与多样性。`temperature` 值越高，生成结果越随机；`top_p` 则通过累积概率截断词汇表，仅保留概率最高的部分词汇进行采样。这两个字段的记录使得系统能够分析用户在不同任务场景下的参数偏好，例如在代码补全场景中用户倾向于使用较低的 `temperature`（如0.2），而在创意写作中则偏好较高的值（如0.8）。

`max_tokens` 字段限制了单次响应的最大长度，防止过长输出导致资源浪费或界面渲染异常。该值由用户在前端设置或由系统默认值决定，记录该值有助于分析用户对响应长度的期望，进而优化模型输出策略。

`language` 字段记录了会话交互语言，支持多语言环境下的本地化服务。系统可根据该字段自动调整提示词模板、错误信息、界面文案等，提升非中文用户的使用体验。例如，当 `language` 为 `en-US` 时，系统将使用英文提示词引导用户输入。

`context_length` 记录了当前会话中保留的上下文token总数，用于评估模型的上下文窗口利用率。Lingma系统支持最大上下文长度为32K tokens，该字段可帮助识别用户是否频繁接近上下文上限，从而触发系统自动提示“上下文过长，建议新建会话”等优化建议。

`total_messages` 和 `total_tokens_used` 为累计统计字段，分别记录该会话中所有消息的总数与消耗的总token数。这两个字段是计费系统的核心依据，也是用户使用行为分析的关键指标。例如，可分析单个会话的平均消息数与token消耗比，识别高价值用户或异常使用模式（如机器人刷量）。

`is_pinned` 字段用于实现用户界面中的“置顶”功能，允许用户将高频使用的会话固定在顶部，提升操作效率。该字段为布尔型，默认为 `FALSE`，用户可通过点击操作切换状态。

`metadata` 字段为JSON类型，用于存储用户自定义的扩展信息，如标签（tags）、自定义分类、会话主题、关联的代码文件路径等。该字段设计为灵活扩展，避免因新增业务需求而频繁修改表结构。例如，用户可存储 `{"tags": ["bug-fix", "python"], "related_file": "/src/main.py"}`，便于后续通过标签进行会话检索。

索引设计方面，对 `user_id`、`project_id`、`created_at`、`status`、`model_name` 均建立了非唯一索引，以支持高频查询场景，如“查询某用户所有活跃会话”、“查询某项目下所有会话”、“按时间范围统计会话增长趋势”等。复合索引未在此处定义，但可根据实际查询模式在后续优化中添加，如 `(user_id, status, created_at)`。

该表为Lingma系统的核心会话管理表，支撑了用户界面的会话列表、历史记录、搜索、归档、删除、置顶等全部交互功能，是连接用户行为与AI服务的枢纽。

# （二）lingma_coding_info 表结构定义

```sql
CREATE TABLE lingma_coding_info (
    coding_id VARCHAR(64) NOT NULL COMMENT '代码生成任务唯一标识符，UUID格式',
    chat_id VARCHAR(64) NOT NULL COMMENT '关联的对话会话ID，外键引用 lingma_chat_info',
    user_id VARCHAR(64) NOT NULL COMMENT '发起代码生成的用户ID，外键引用用户系统',
    project_id VARCHAR(64) NULL COMMENT '关联的项目ID，用于代码上下文定位',
    file_path VARCHAR(512) NULL COMMENT '目标代码文件的完整路径，如 "/src/utils/helper.py"',
    file_language VARCHAR(32) NOT NULL COMMENT '目标文件的编程语言，如 "python"、"java"、"javascript"、"go"、"rust" 等',
    file_extension VARCHAR(16) NULL COMMENT '文件扩展名，如 ".py"、".java"、".js"，用于文件类型识别',
    original_code TEXT NULL COMMENT '用户提供的原始代码片段，用于上下文理解',
    prompt TEXT NOT NULL COMMENT '用户输入的代码生成提示词，包含自然语言描述与需求',
    generated_code TEXT NOT NULL COMMENT 'AI系统生成的完整代码片段，包含注释与格式',
    generated_lines INT NOT NULL COMMENT '生成代码的总行数',
    generated_tokens INT NOT NULL COMMENT '生成代码所消耗的token数量',
    generation_time_ms INT NOT NULL COMMENT 'AI生成代码所耗时间，单位为毫秒',
    model_name VARCHAR(128) NOT NULL COMMENT '用于本次代码生成的AI模型名称',
    temperature DECIMAL(3,2) NULL COMMENT '生成时使用的温度参数',
    top_p DECIMAL(3,2) NULL COMMENT '生成时使用的top_p参数',
    max_tokens INT NULL COMMENT '生成时设置的最大token限制',
    is_accepted BOOLEAN NULL COMMENT '用户是否接受该生成结果，NULL表示未操作，TRUE为接受，FALSE为拒绝',
    acceptance_time TIMESTAMP NULL COMMENT '用户接受生成结果的时间，若未接受则为NULL',
    edit_distance INT NULL COMMENT '用户修改后与原始生成代码的编辑距离（Levenshtein距离）',
    edit_lines INT NULL COMMENT '用户在生成代码基础上修改的行数',
    comment_count INT NULL COMMENT '生成代码中AI自动添加的注释行数',
    code_quality_score DECIMAL(4,3) NULL COMMENT '系统评估的代码质量分数，范围0.0~1.0，基于静态分析与规则匹配',
    has_syntax_error BOOLEAN NULL COMMENT '生成代码是否包含语法错误（通过语言服务器检测）',
    has_lint_warning BOOLEAN NULL COMMENT '生成代码是否触发代码规范警告（如PEP8、ESLint等）',
    is_duplicate BOOLEAN NULL COMMENT '是否检测到与已有代码高度重复（基于代码指纹比对）',
    refactoring_suggestion TEXT NULL COMMENT '系统建议的重构优化点，JSON格式存储',
    metadata JSON NULL COMMENT '扩展元数据，如调用的API、依赖库、是否启用多文件生成等',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '代码生成请求创建时间',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '代码生成记录最后更新时间',
    PRIMARY KEY (coding_id),
    FOREIGN KEY (chat_id) REFERENCES lingma_chat_info(chat_id) ON DELETE CASCADE,
    INDEX idx_chat_id (chat_id),
    INDEX idx_user_id (user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_file_path (file_path(255)),
    INDEX idx_file_language (file_language),
    INDEX idx_model_name (model_name),
    INDEX idx_created_at (created_at),
    INDEX idx_is_accepted (is_accepted),
    INDEX idx_code_quality_score (code_quality_score),
    INDEX idx_has_syntax_error (has_syntax_error),
    INDEX idx_is_duplicate (is_duplicate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='记录Lingma AI系统生成代码的详细过程与结果，用于质量评估与用户行为分析';
```

`lingma_coding_info` 表是Lingma系统中用于追踪和分析AI代码生成行为的核心数据表。每一条记录代表一次独立的AI代码生成请求，其数据来源于用户在IDE或Web界面中触发的“生成代码”、“补全函数”、“编写单元测试”等操作。该表的设计目标是全面记录从用户输入到AI输出、再到用户反馈的完整闭环，为模型迭代、用户体验优化、安全合规审计提供数据支撑。

`coding_id` 为主键，采用UUID格式，确保在分布式部署环境下唯一性。`chat_id` 为外键，关联至 `lingma_chat_info` 表，表明该次代码生成行为属于某次对话会话的一部分，便于将代码生成行为与上下文对话关联分析。例如，用户可能在对话中先询问“如何实现一个快速排序算法？”，随后点击“生成代码”按钮，系统将此次生成行为与该对话绑定，形成完整的“问答-生成”链条。

`file_path` 字段记录了目标代码文件的完整路径，支持多层级目录结构，最大长度为512字符，足以覆盖绝大多数项目结构。该字段对于分析用户在哪些项目、哪些模块中频繁使用AI生成代码至关重要。例如，可发现用户在 `src/api/` 目录下生成REST接口代码的频率远高于 `test/` 目录，从而优化模型对API生成的训练数据。

`file_language` 与 `file_extension` 字段分别记录目标文件的编程语言与扩展名。`file_language` 采用标准化语言名称（如 "python"、"java"），便于聚合统计；`file_extension` 用于文件类型识别，辅助IDE插件进行语法高亮与格式化。这两个字段支持按语言维度分析生成效果，例如发现Python生成的接受率高于Java，或Go语言的语法错误率较高，从而指导模型微调方向。

`original_code` 字段存储用户提供的原始代码片段，用于上下文理解。例如，用户可能选中一段函数，然后输入“添加日志记录”，系统将该函数代码与提示词一同送入模型。该字段是实现“上下文感知生成”的关键，避免模型脱离上下文胡乱生成。

`prompt` 字段存储用户输入的自然语言提示词，是AI生成的核心输入。该字段内容丰富，可能包含模糊需求（如“让它快一点”）、具体需求（如“使用async/await实现并发请求”）、甚至多语言混合（如“用Python写一个函数，输入是list，输出是去重后的sorted list”）。该字段是NLP模型训练与提示工程优化的核心数据源。

`generated_code` 字段存储AI生成的完整代码，包含所有缩进、注释、换行符，确保可直接复制使用。该字段为TEXT类型，支持超长代码块（如生成整个类或模块）。该字段是后续代码质量评估、抄袭检测、用户编辑行为分析的基础。

`generated_lines` 与 `generated_tokens` 分别记录生成代码的行数与token数。行数用于评估生成复杂度，token数用于计费与资源消耗统计。例如，生成一个50行的函数可能消耗1200 tokens，而生成一个10行的工具函数仅消耗200 tokens。

`generation_time_ms` 记录AI模型从接收请求到返回结果所耗时间，单位为毫秒。该字段是系统性能监控的关键指标，用于识别模型响应延迟问题。例如，若某次生成耗时超过5000ms，可能表明模型负载过高或网络延迟，系统可触发告警或降级策略。

`model_name`、`temperature`、`top_p`、`max_tokens` 字段与 `lingma_chat_info` 表中对应字段一致，用于追踪本次生成所使用的模型配置。这些参数直接影响生成质量与效率，记录它们可实现参数-效果关联分析。例如，发现使用 `temperature=0.7` 时生成代码的接受率最高，可作为默认推荐值。

`is_accepted`、`acceptance_time` 字段记录用户对生成结果的反馈。`is_accepted` 为三态：`NULL` 表示用户未操作（可能直接关闭窗口），`TRUE` 表示用户点击“接受”，`FALSE` 表示用户点击“拒绝”或“重试”。`acceptance_time` 记录用户接受的时间点，用于计算“首次接受延迟”，即从生成完成到用户接受所用时间。该指标是衡量生成结果“即用性”的核心指标，若平均延迟低于2秒，说明生成结果高度符合预期。

`edit_distance` 与 `edit_lines` 字段记录用户对生成代码的修改程度。`edit_distance` 使用Levenshtein距离算法计算原始生成代码与用户修改后代码的差异，数值越小说明生成越精准。`edit_lines` 记录用户实际修改的行数，例如用户仅修改了1行参数名，说明生成质量高；若修改了10行以上，说明生成结果与需求偏差较大。这两个字段是评估AI生成“精准度”的黄金指标。

`comment_count` 记录AI自动生成的注释行数，用于评估AI的“文档意识”。高注释率可能表明模型倾向于“过度解释”，而低注释率可能影响代码可维护性。系统可分析用户是否偏好带注释的代码，从而调整生成策略。

`code_quality_score` 为系统自动评估的代码质量分数，范围0.0~1.0，基于静态分析引擎（如SonarQube、ESLint、pylint）的规则匹配结果。评分维度包括：命名规范、圈复杂度、重复代码、安全漏洞、未使用变量等。该分数是模型优化的直接反馈信号，高分生成结果被用于正样本训练，低分结果用于负样本过滤。

`has_syntax_error` 与 `has_lint_warning` 字段记录生成代码是否包含语法错误或规范警告。语法错误会导致代码无法运行，是严重缺陷；规范警告虽不影响运行，但影响代码风格一致性。系统可统计各语言的错误率，例如发现Java生成的空指针检查缺失率高达15%，则需加强该类提示的训练。

`is_duplicate` 字段通过代码指纹（code fingerprint）比对，判断生成代码是否与项目中已有代码高度相似（相似度>90%）。该功能用于避免AI生成重复代码，提升代码库的多样性与创新性。若检测到重复，系统可提示“该代码已在文件X中存在，是否复用？”。

`refactoring_suggestion` 字段为JSON格式，存储系统建议的重构优化点，例如：
```json
{
  "suggestions": [
    {
      "type": "extract_method",
      "message": "建议将第15-25行提取为独立方法，降低圈复杂度",
      "line_range": [15, 25],
      "confidence": 0.92
    },
    {
      "type": "use_builtin",
      "message": "建议使用内置函数 sorted() 替代手动排序",
      "line_range": [8, 12],
      "confidence": 0.88
    }
  ]
}
```
该字段支持AI提供“主动式优化建议”，提升用户代码质量，是Lingma区别于普通代码补全工具的核心功能。

`metadata` 字段用于存储扩展信息，如是否启用“多文件生成”（`"multi_file": true`）、是否引用了特定库（`"dependencies": ["requests", "pandas"]`）、是否生成了单元测试（`"test_generated": true`）等。该字段为未来功能扩展预留空间。

索引设计覆盖了所有高频查询字段，包括 `chat_id`、`user_id`、`project_id`、`file_path`、`file_language`、`model_name`、`created_at`、`is_accepted`、`code_quality_score`、`has_syntax_error`、`is_duplicate`。其中，`file_path` 建立了前缀索引（255字符），避免过长路径导致索引过大。复合索引如 `(user_id, file_language, created_at)` 可用于分析“某用户在Python项目中最近的代码生成行为”。

该表是Lingma系统AI代码生成能力的“数字孪生”，每一行数据都是AI与人类协作的微观记录，是构建下一代智能编程助手的基石。

# （三）lingma_completion_info 表结构定义

```sql
CREATE TABLE lingma_completion_info (
    completion_id VARCHAR(64) NOT NULL COMMENT '代码补全请求唯一标识符，UUID格式',
    chat_id VARCHAR(64) NULL COMMENT '关联的对话会话ID，外键引用 lingma_chat_info，可为空',
    user_id VARCHAR(64) NOT NULL COMMENT '发起补全的用户ID，外键引用用户系统',
    project_id VARCHAR(64) NULL COMMENT '关联的项目ID，用于上下文加载',
    file_path VARCHAR(512) NOT NULL COMMENT '目标文件的完整路径，如 "/src/components/Button.jsx"',
    file_language VARCHAR(32) NOT NULL COMMENT '目标文件的编程语言，如 "javascript"、"typescript"、"csharp" 等',
    file_extension VARCHAR(16) NULL COMMENT '文件扩展名，如 ".js"、".ts"、".cs"',
    cursor_position INT NOT NULL COMMENT '用户光标在文件中的字符位置（从0开始）',
    line_number INT NOT NULL COMMENT '用户光标所在行号（从1开始）',
    column_number INT NOT NULL COMMENT '用户光标所在列号（从1开始）',
    prefix TEXT NOT NULL COMMENT '光标前的代码上下文，最多保留2048字符',
    suffix TEXT NULL COMMENT '光标后的代码上下文，最多保留1024字符，用于预测后续结构',
    prompt TEXT NULL COMMENT '用户输入的补全提示词（如注释或自然语言指令）',
    generated_completions JSON NOT NULL COMMENT 'AI生成的多个补全候选，JSON数组格式，每个元素包含 code、score、rank、reason 等字段',
    selected_completion_index INT NULL COMMENT '用户选择的补全候选索引（从0开始），NULL表示未选择',
    selected_completion_code TEXT NULL COMMENT '用户最终选择的补全代码内容',
    completion_time_ms INT NOT NULL COMMENT 'AI生成补全所耗时间，单位为毫秒',
    model_name VARCHAR(128) NOT NULL COMMENT '用于本次补全的AI模型名称',
    temperature DECIMAL(3,2) NULL COMMENT '生成时使用的温度参数',
    top_p DECIMAL(3,2) NULL COMMENT '生成时使用的top_p参数',
    max_tokens INT NULL COMMENT '生成时设置的最大token限制',
    is_accepted BOOLEAN NULL COMMENT '用户是否接受该补全结果，NULL为未操作，TRUE为接受，FALSE为拒绝',
    acceptance_time TIMESTAMP NULL COMMENT '用户接受补全的时间，若未接受则为NULL',
    edit_distance INT NULL COMMENT '用户选择后修改的代码与原始补全的编辑距离',
    edit_lines INT NULL COMMENT '用户在补全基础上修改的行数',
    context_window_used INT NULL COMMENT '本次补全实际使用的上下文token数',
    code_quality_score DECIMAL(4,3) NULL COMMENT '系统评估的补全代码质量分数，范围0.0~1.0',
    has_syntax_error BOOLEAN NULL COMMENT '生成的补全代码是否包含语法错误',
    has_lint_warning BOOLEAN NULL COMMENT '生成的补全代码是否触发代码规范警告',
    is_duplicate BOOLEAN NULL COMMENT '是否检测到与当前文件中已有代码高度重复',
    refactoring_suggestion TEXT NULL COMMENT '系统建议的重构优化点，JSON格式',
    metadata JSON NULL COMMENT '扩展元数据，如是否启用多行补全、是否基于文档字符串生成等',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '补全请求创建时间',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '补全记录最后更新时间',
    PRIMARY KEY (completion_id),
    FOREIGN KEY (chat_id) REFERENCES lingma_chat_info(chat_id) ON DELETE SET NULL,
    INDEX idx_chat_id (chat_id),
    INDEX idx_user_id (user_id),
    INDEX idx_project_id (project_id),
    INDEX idx_file_path (file_path(255)),
    INDEX idx_file_language (file_language),
    INDEX idx_cursor_position (cursor_position),
    INDEX idx_line_number (line_number),
    INDEX idx_model_name (model_name),
    INDEX idx_created_at (created_at),
    INDEX idx_is_accepted (is_accepted),
    INDEX idx_code_quality_score (code_quality_score),
    INDEX idx_has_syntax_error (has_syntax_error),
    INDEX idx_is_duplicate (is_duplicate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='记录Lingma AI系统在代码编辑器中进行实时代码补全的详细过程与用户反馈，用于优化补全准确率与响应速度';
```

`lingma_completion_info` 表专门用于记录Lingma系统在代码编辑器中执行的**实时代码补全**（Code Completion）行为，区别于 `lingma_coding_info` 表中“完整代码生成”场景。补全行为通常发生在用户输入过程中，如输入函数名后按Tab键、输入 `if` 后自动补全 `else` 分支、或在注释后生成函数体。该表的设计聚焦于**低延迟、高精度、上下文感知**的补全场景，是提升开发者编码效率的核心数据源。

`completion_id` 为主键，采用UUID格式，确保唯一性。`chat_id` 为可选外键，允许补全行为独立于对话会话发生，因为大多数补全操作是用户在IDE中独立进行的，无需启动对话。`user_id`、`project_id`、`file_path`、`file_language`、`file_extension` 字段与 `lingma_coding_info` 表一致，用于用户身份、项目上下文与文件类型识别。

`cursor_position`、`line_number`、`column_number` 三个字段精确记录用户光标在文件中的位置。`cursor_position` 为字符级偏移量（从0开始），是模型定位上下文的关键；`line_number` 和 `column_number` 为行/列坐标，便于IDE插件进行高亮与错误定位。例如，用户在第15行第8列输入 `con`，系统需基于此位置提取前后文进行补全。

`prefix` 字段存储光标前最多2048字符的代码上下文，是模型理解当前语义的核心输入。例如，若用户正在编写一个Python函数，`prefix` 可能包含函数定义、导入语句、前序逻辑等。`suffix` 字段存储光标后最多1024字符的代码，用于预测后续结构，例如在 `if` 语句后，系统可看到 `:` 和缩进，从而判断应补全条件块内容。

`prompt` 字段记录用户输入的自然语言提示词，例如在注释中写 `// 计算用户年龄`，系统据此生成相应代码。该字段是实现“自然语言驱动补全”的关键，使AI能理解用户意图而非仅依赖代码模式。

`generated_completions` 字段为JSON数组，存储AI生成的多个补全候选。每个候选对象包含以下字段：
- `code`: 补全生成的代码片段
- `score`: 模型对该候选的置信度分数（0~1）
- `rank`: 候选排序（1为最高优先级）
- `reason`: 模型生成该候选的依据（如“匹配相似函数模式”、“基于文档字符串推断”）

例如：
```json
[
  {
    "code": "console.log('Hello World');",
    "score": 0.95,
    "rank": 1,
    "reason": "匹配当前文件中其他console.log调用模式"
  },
  {
    "code": "alert('Hello World');",
    "score": 0.78,
    "rank": 2,
    "reason": "项目中使用了alert作为通知方式"
  }
]
```
该设计支持“多候选推荐”，用户可按Tab键切换不同选项，提升选择自由度与满意度。

`selected_completion_index` 记录用户选择的候选索引（从0开始），`selected_completion_code` 记录用户最终选择的代码内容。这两个字段用于计算“首次选择准确率”——即用户是否在第一个候选中就选择了正确结果。若该值高达80%，说明模型推荐精准；若用户常选择第3或第4个候选，说明推荐排序需优化。

`completion_time_ms` 记录从用户触发补全到AI返回结果的耗时，单位为毫秒。该字段是用户体验的核心指标，理想值应低于200ms。若超过500ms，用户将感知延迟，导致放弃使用。系统可据此优化模型推理速度或缓存策略。

`model_name`、`temperature`、`top_p`、`max_tokens` 字段与前表一致，用于追踪补全所用模型配置。补全场景通常使用轻量级模型或蒸馏模型，以保证低延迟。

`is_accepted`、`acceptance_time`、`edit_distance`、`edit_lines` 字段与 `lingma_coding_info` 表逻辑一致，用于评估用户对补全结果的接受度与修改程度。补全场景中，用户修改通常较少（如仅修改变量名），因此 `edit_distance` 值普遍较低，若出现高值，说明生成内容与上下文不匹配。

`context_window_used` 记录本次补全实际使用的上下文token数，用于评估模型对上下文的利用效率。Lingma系统支持最大上下文窗口为32K tokens，但补全通常仅使用前500~2000 tokens，该字段可帮助优化上下文截断策略。

`code_quality_score`、`has_syntax_error`、`has_lint_warning`、`is_duplicate` 字段与 `lingma_coding_info` 表一致，用于质量评估。补全代码通常较短，但语法错误率仍需严格控制，例如在JavaScript中补全 `let x =` 后生成 `x = 1;` 而非 `let x = 1;` 会导致语法错误。

`refactoring_suggestion` 字段为JSON格式，存储系统对补全代码的优化建议，例如：
```json
{
  "suggestions": [
    {
      "type": "use_const",
      "message": "建议将变量声明改为 const，因未被重新赋值",
      "line_range": [15, 15],
      "confidence": 0.91
    }
  ]
}
```
该功能可引导用户写出更规范的代码。

`metadata` 字段用于存储扩展信息，如是否启用“多行补全”（`"multi_line": true`）、是否基于JSDoc注释生成（`"from_docstring": true`）、是否触发了“智能补全”（`"smart_completion": true`）等。

索引设计覆盖了所有高频查询字段，特别是 `cursor_position`、`line_number`、`file_path`、`model_name`、`created_at`、`is_accepted`、`code_quality_score`。复合索引如 `(user_id, file_language, created_at)` 可用于分析“某用户在TypeScript项目中补全行为的时间分布”。

该表是Lingma系统“实时智能补全”能力的微观记录，每一行数据都是开发者与AI在编码瞬间的协作证据。通过分析数百万次补全行为，系统可不断优化推荐算法，实现“越用越懂你”的智能体验。

# （四）lingma_developer_members 表结构定义

```sql
CREATE TABLE lingma_developer_members (
    member_id VARCHAR(64) NOT NULL COMMENT '成员唯一标识符，UUID格式',
    user_id VARCHAR(64) NOT NULL COMMENT '系统用户ID，外键关联用户认证系统',
    team_id VARCHAR(64) NULL COMMENT '所属团队ID，用于组织架构管理',
    organization_id VARCHAR(64) NULL COMMENT '所属组织ID，用于企业级权限控制',
    username VARCHAR(128) NOT NULL COMMENT '用户登录名，唯一，用于界面展示',
    email VARCHAR(255) NOT NULL COMMENT '用户邮箱地址，用于通知与认证',
    full_name VARCHAR(255) NULL COMMENT '用户全名，用于显示与审计',
    avatar_url VARCHAR(512) NULL COMMENT '用户头像URL，支持第三方服务如Gravatar或企业图床',
    role ENUM('developer', 'manager', 'admin', 'guest') NOT NULL DEFAULT 'developer' COMMENT '用户角色：developer（开发者）、manager（团队经理）、admin（系统管理员）、guest（访客）',
    status ENUM('active', 'inactive', 'suspended', 'deleted') NOT NULL DEFAULT 'active' COMMENT '账户状态：active（活跃）、inactive（未激活）、suspended（暂停）、deleted（已删除）',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '账户创建时间',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '账户信息最后更新时间',
    last_login_at TIMESTAMP NULL COMMENT '用户最后一次登录时间',
    login_count BIGINT NOT NULL DEFAULT 0 COMMENT '用户总登录次数',
    preferred_language VARCHAR(16) NULL COMMENT '用户偏好语言，如 "zh-CN"、"en-US"，用于界面本地化',
    preferred_theme ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system' COMMENT '用户偏好主题：light（浅色）、dark（深色）、system（跟随系统）',
    code_completion_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用代码补全功能',
    code_generation_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用代码生成功能',
    auto_suggest_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否启用自动建议（如括号补全、行补全）',
    model_preference VARCHAR(128) NULL COMMENT '用户默认使用的AI模型，如 "lingma-7b"、"lingma-13b"，覆盖全局默认值',
    context_window_size INT NULL COMMENT '用户自定义的上下文窗口大小（token数），如 8192、16384，覆盖全局默认值',
    notification_email_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否接收邮件通知',
    notification_in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否接收应用内通知',
    notification_slack_enabled BOOLEAN NULL COMMENT '是否接收Slack通知，NULL表示未配置',
    metadata JSON NULL COMMENT '扩展元数据，如绑定的IDE插件版本、SSH密钥指纹、企业LDAP属性等',
    PRIMARY KEY (member_id),
    UNIQUE KEY uk_user_id (user_id),
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_email (email),
    INDEX idx_team_id (team_id),
    INDEX idx_organization_id (organization_id),
    INDEX idx_role (role),
    INDEX idx_status (status),
    INDEX idx_last_login_at (last_login_at),
    INDEX idx_created_at (created_at),
    INDEX idx_preferred_language (preferred_language),
    INDEX idx_code_completion_enabled (code_completion_enabled),
    INDEX idx_code_generation_enabled (code_generation_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储Lingma系统中所有开发者成员的账户信息、权限配置与使用偏好，用于用户管理、个性化服务与组织权限控制';
```

`lingma_developer_members` 表是Lingma系统中用于管理**用户身份、权限与个性化配置**的核心数据表。该表不仅记录用户的基本信息，更深度整合了用户对AI功能的使用偏好与系统行为设置，是实现“千人千面”智能编程体验的基础。

`member_id` 为主键，采用UUID格式，确保在分布式系统中唯一。`user_id` 为外键，关联至企业统一认证系统（如LDAP、OAuth2、SAML），实现单点登录（SSO）与权限同步。该设计避免了Lingma系统独立维护用户密码，提升安全性。

`team_id` 与 `organization_id` 字段用于构建组织架构层级。`team_id` 表示用户所属的开发团队（如“前端组”、“后端组”），`organization_id` 表示所属企业或部门（如“腾讯云”、“阿里巴巴国际站”）。这两个字段支持企业级权限管理，例如：限制某团队只能使用 `lingma-7b` 模型，或禁止访客访问代码生成功能。

`username`、`email`、`full_name` 为用户身份标识字段。`username` 为登录名，唯一且用于界面展示；`email` 为认证与通知渠道，必须唯一；`full_name` 用于显示完整姓名，提升协作体验。`avatar_url` 字段支持第三方头像服务，避免存储二进制数据，降低数据库负载。

`role` 字段采用枚举类型，定义四种角色：
- `developer`：普通开发者，可使用所有AI功能；
- `manager`：团队经理，可查看团队使用统计、管理成员、设置团队策略；
- `admin`：系统管理员，可管理所有组织、配置全局模型、审计日志；
- `guest`：访客，仅可查看公开示例，无权限使用AI功能。

该角色体系支持细粒度权限控制，例如：`manager` 可关闭某成员的代码生成功能，但不能修改系统模型配置。

`status` 字段定义账户状态：
- `active`：正常可用；
- `inactive`：账户已创建但未激活（如未验证邮箱）；
- `suspended`：因违规行为被临时暂停；
- `deleted`：用户主动删除或管理员删除，数据保留用于审计。

`created_at` 与 `updated_at` 为标准时间戳字段，`last_login_at` 记录最后一次登录时间，用于识别活跃用户与僵尸账户。`login_count` 记录总登录次数，用于用户生命周期分析。

`preferred_language` 字段控制界面语言，支持多语言本地化。例如，用户设置为 `zh-CN`，则所有提示词、错误信息、帮助文档均显示为中文。

`preferred_theme` 字段控制UI主题，支持深色/浅色模式，提升长时间编码的舒适度。

`code_completion_enabled`、`code_generation_enabled`、`auto_suggest_enabled` 为功能开关，允许用户按需启用或禁用AI功能。例如，部分用户可能因安全合规要求禁用代码生成，仅保留补全功能。

`model_preference` 字段允许用户自定义默认使用的AI模型。例如，某用户偏好 `lingma-13b` 用于复杂逻辑生成，而另一用户使用 `lingma-7b` 以获得更快响应。该设置覆盖系统默认值，实现个性化体验。

`context_window_size` 字段允许用户自定义上下文窗口大小（token数），如设置为8192以节省资源，或设置为32768以支持大型文件分析。该设置直接影响模型性能与响应速度，需与系统资源配额联动。

`notification_email_enabled`、`notification_in_app_enabled`、`notification_slack_enabled` 控制通知渠道。`notification_slack_enabled` 为NULL表示未配置，用户需在第三方平台绑定Slack账号后才可启用。

`metadata` 字段为JSON类型，用于存储扩展信息，如：
- 绑定的IDE插件版本：`{"ide_plugin_version": "1.2.3", "ide": "IntelliJ IDEA"}`
- SSH密钥指纹：`{"ssh_fingerprint": "sha256:abc123..."}`
- 企业LDAP属性：`{"ldap_dn": "cn=john,ou=dev,dc=company,dc=com", "department": "Engineering"}`

索引设计覆盖了所有高频查询字段，特别是 `user_id`、`username`、`email`（唯一索引）、`team_id`、`organization_id`、`role`、`status`、`last_login_at`、`created_at`、`preferred_language`、`code_completion_enabled`、`code_generation_enabled`。复合索引如 `(organization_id, team_id, role)` 可用于快速查询“某组织下所有管理员”。

该表是Lingma系统用户生态的基石，通过记录用户身份、权限、偏好与行为设置，实现了从“通用AI工具”到“个性化智能编程伙伴”的转变。企业可基于此表实现用户行为分析、权限审计、功能策略推送、安全合规监控等高级管理能力。

# （五）lingma_feedbacks_info 表结构定义

```sql
CREATE TABLE lingma_feedbacks_info (
    feedback_id VARCHAR(64) NOT NULL COMMENT '反馈记录唯一标识符，UUID格式',
    user_id VARCHAR(64) NOT NULL COMMENT '提交反馈的用户ID，外键引用 lingma_developer_members',
    chat_id VARCHAR(64) NULL COMMENT '关联的对话会话ID，若反馈针对某次会话',
    coding_id VARCHAR(64) NULL COMMENT '关联的代码生成任务ID，若反馈针对某次代码生成',
    completion_id VARCHAR(64) NULL COMMENT '关联的代码补全请求ID，若反馈针对某次补全',
    feedback_type ENUM('bug', 'feature_request', 'usability', 'performance', 'other') NOT NULL COMMENT '反馈类型：bug（缺陷）、feature_request（功能请求）、usability（易用性）、performance（性能）、other（其他）',
    category VARCHAR(128) NULL COMMENT '反馈子类别，如 "代码生成不准确"、"响应太慢"、"界面卡顿"、"模型不支持Go语言" 等',
    title VARCHAR(255) NOT NULL COMMENT '反馈标题，简明扼要描述问题',
    description TEXT NOT NULL COMMENT '反馈详细描述，用户输入的完整问题说明',
    reproduction_steps TEXT NULL COMMENT '问题复现步骤，用于开发人员复现Bug',
    expected_result TEXT NULL COMMENT '用户期望的结果',
    actual_result TEXT NULL COMMENT '用户实际看到的结果',
    screenshot_url VARCHAR(512) NULL COMMENT '截图上传的URL地址，用于可视化问题',
    video_url VARCHAR(512) NULL COMMENT '操作视频上传的URL地址，用于复杂问题分析',
    device_info JSON NULL COMMENT '用户设备信息，包含操作系统、IDE版本、插件版本、屏幕分辨率等',
    system_info JSON NULL COMMENT '系统环境信息，包含Lingma插件版本、模型版本、网络延迟、代理设置等',
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium' COMMENT '用户标记的优先级',
    status ENUM('open', 'in_progress', 'resolved', 'closed', 'duplicate', 'wont_fix') NOT NULL DEFAULT 'open' COMMENT '反馈处理状态',
    assigned_to VARCHAR(64) NULL COMMENT '分配给的处理人员ID，外键引用 lingma_developer_members',
    resolved_at TIMESTAMP NULL COMMENT '反馈解决时间',
    resolution_notes TEXT NULL COMMENT '处理人员填写的解决方案或原因说明',
    upvotes INT NOT NULL DEFAULT 0 COMMENT '其他用户对该反馈的点赞数，用于社区投票',
    downvotes INT NOT NULL DEFAULT 0 COMMENT '其他用户对该反馈的点踩数',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '反馈提交时间',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '反馈最后更新时间',
    metadata JSON NULL COMMENT '扩展元数据，如反馈来源（插件内/网页端）、是否匿名提交、是否关联项目等',
    PRIMARY KEY (feedback_id),
    FOREIGN KEY (user_id) REFERENCES lingma_developer_members(user_id) ON DELETE CASCADE,
    FOREIGN KEY (chat_id) REFERENCES lingma_chat_info(chat_id) ON DELETE SET NULL,
    FOREIGN KEY (coding_id) REFERENCES lingma_coding_info(coding_id) ON DELETE SET NULL,
    FOREIGN KEY (completion_id) REFERENCES lingma_completion_info(completion_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES lingma_developer_members(user_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_chat_id (chat_id),
    INDEX idx_coding_id (coding_id),
    INDEX idx_completion_id (completion_id),
    INDEX idx_feedback_type (feedback_type),
    INDEX idx_category (category),
    INDEX idx_priority (priority),
    INDEX idx_status (status),
    INDEX idx_assigned_to (assigned_to),
    INDEX idx_created_at (created_at),
    INDEX idx_resolved_at (resolved_at),
    INDEX idx_upvotes (upvotes),
    INDEX idx_downvotes (downvotes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收集用户对Lingma AI系统的反馈信息，涵盖缺陷报告、功能请求与体验建议，用于产品迭代与服务质量提升';
```

`lingma_feedbacks_info` 表是Lingma系统中用于**收集、追踪与管理用户反馈**的核心数据表。该表设计全面覆盖了从用户提交反馈到产品团队处理的完整生命周期，是连接用户声音与产品演进的桥梁。

`feedback_id` 为主键，采用UUID格式，确保唯一性。`user_id` 为外键，关联至 `lingma_developer_members` 表，确保反馈可追溯至具体用户，便于后续沟通与奖励机制（如“最佳反馈奖”）。

`chat_id`、`coding_id`、`completion_id` 为可选外键，用于将反馈与具体AI交互行为绑定。例如，用户在使用代码生成功能后提交“生成的代码有语法错误”，系统可自动关联 `coding_id`，便于开发人员直接查看生成的原始代码与上下文，极大提升问题复现效率。

`feedback_type` 字段定义五种反馈类型：
- `bug`：系统功能异常或错误，如“生成的Python代码缺少冒号”；
- `feature_request`：用户希望新增的功能，如“支持Dockerfile生成”；
- `usability`：界面或交互体验问题，如“补全候选太多，无法快速选择”；
- `performance`：响应速度或资源消耗问题，如“生成代码耗时超过3秒”；
- `other`：无法归类的反馈。

`category` 字段为自由文本，用于细化反馈子类，如“代码生成不准确”、“模型不支持Go语言”、“界面在Mac上字体模糊”等。该字段支持自然语言输入，便于用户自由表达，后续可通过NLP聚类自动归类。

`title` 与 `description` 为必填字段，分别用于快速浏览与详细描述。`title` 应简洁明确，`description` 需包含完整上下文，如“我在编写一个Django视图时，要求生成一个处理POST请求的函数，但生成的函数未验证CSRF token”。

`reproduction_steps`、`expected_result`、`actual_result` 为结构化Bug报告字段，遵循标准缺陷报告模板。`reproduction_steps` 要求用户描述如何复现问题，如“1. 打开main.py；2. 输入def calculate():；3. 点击生成代码；4. 生成的代码未包含return语句”。该字段是开发人员修复问题的关键依据。

`screenshot_url` 与 `video_url` 字段支持用户上传视觉证据。截图用于展示UI错误，视频用于展示复杂交互流程（如“补全候选项在滚动时消失”）。系统应提供一键截图与录屏功能，降低用户提交门槛。

`device_info` 与 `system_info` 为JSON字段，自动收集用户环境信息，避免用户手动填写。`device_info` 包含：
```json
{
  "os": "macOS 14.5",
  "ide": "IntelliJ IDEA 2024.1",
  "plugin_version": "1.3.2",
  "screen_resolution": "2560x1600",
  "language": "zh-CN"
}
```
`system_info` 包含：
```json
{
  "lingma_version": "v2.1.0",
  "model_name": "lingma-13b",
  "network_latency_ms": 120,
  "proxy_enabled": true,
  "proxy_server": "http://corp-proxy:8080"
}
```
这些信息对诊断环境相关问题（如“仅在Windows上出现”、“使用代理时超时”）至关重要。

`priority` 字段由用户标记，影响处理顺序。`status` 字段定义处理状态，支持标准工单流程：`open` → `in_progress` → `resolved` → `closed`。`duplicate` 表示重复反馈，`wont_fix` 表示产品团队决定不修复。

`assigned_to` 字段将反馈分配给具体处理人员（开发、测试、产品经理），支持团队协作。`resolved_at` 与 `resolution_notes` 记录解决时间与说明，形成闭环。

`upvotes` 与 `downvotes` 字段支持社区投票机制。用户可对他人反馈点赞或点踩，系统自动按投票数排序，优先处理高票反馈。例如，某功能请求获得500个赞，即使提交者为普通用户，也应被纳入Roadmap。

`metadata` 字段存储扩展信息，如：
```json
{
  "source": "ide_plugin",
  "anonymous": false,
  "project_id": "proj-abc123",
  "trigger_event": "code_generation"
}
```

索引设计覆盖了所有查询维度，特别是 `user_id`、`feedback_type`、`category`、`priority`、`status`、`assigned_to`、`created_at`、`resolved_at`、`upvotes`、`downvotes`。复合索引如 `(status, priority, created_at)` 可用于生成“待处理高优先级反馈列表”。

该表是Lingma产品迭代的“用户之声”数据库，每一行反馈都是用户对AI助手的直接评价。通过分析反馈类型分布、高频关键词、解决周期、投票热度，产品团队可精准识别痛点，制定优先级，实现“以用户为中心”的持续进化。

# （六）lingma_statistics_info 表结构定义

```sql
CREATE TABLE lingma_statistics_info (
    stat_id VARCHAR(64) NOT NULL COMMENT '统计记录唯一标识符，UUID格式',
    date_key DATE NOT NULL COMMENT '统计日期，格式为 YYYY-MM-DD，用于按天聚合',
    organization_id VARCHAR(64) NULL COMMENT '所属组织ID，用于企业级统计',
    team_id VARCHAR(64) NULL COMMENT '所属团队ID，用于团队级统计',
    user_id VARCHAR(64) NULL COMMENT '用户ID，用于个体用户统计',
    metric_type ENUM(
        'total_users',
        'active_users_daily',
        'active_users_weekly',
        'active_users_monthly',
        'total_chats',
        'active_chats_daily',
        'total_coding_tasks',
        'total_completions',
        'total_tokens_consumed',
        'total_code_lines_generated',
        'avg_generation_time_ms',
        'avg_completion_time_ms',
        'code_acceptance_rate',
        'completion_acceptance_rate',
        'avg_code_quality_score',
        'syntax_error_rate',
        'lint_warning_rate',
        'duplicate_code_rate',
        'feedback_submitted',
        'feedback_resolved',
        'model_usage_lingma_7b',
        'model_usage_lingma_13b',
        'model_usage_lingma_32b',
        'language_python',
        'language_java',
        'language_javascript',
        'language_typescript',
        'language_go',
        'language_rust',
        'language_csharp',
        'language_sql',
        'language_json',
        'language_yaml',
        'language_dockerfile',
        'language_markdown',
        'feature_code_completion_enabled',
        'feature_code_generation_enabled',
        'feature_auto_suggest_enabled',
        'device_os_windows',
        'device_os_macos',
        'device_os_linux',
        'device_ide_intellij',
        'device_ide_vscode',
        'device_ide_pycharm',
        'device_ide_eclipse',
        'device_ide_other',
        'network_latency_0_100ms',
        'network_latency_101_500ms',
        'network_latency_501_1000ms',
        'network_latency_1001_plus',
        'context_window_8k',
        'context_window_16k',
        'context_window_32k',
        'user_role_developer',
        'user_role_manager',
        'user_role_admin',
        'user_role_guest'
    ) NOT NULL COMMENT '统计指标类型，涵盖用户、会话、代码、模型、语言、设备、网络、上下文、角色等维度',
    metric_value BIGINT NOT NULL COMMENT '统计指标的具体数值，如用户数、次数、百分比、平均值等',
    metric_unit VARCHAR(32) NOT NULL COMMENT '指标单位，如 "count"、"ms"、"percent"、"lines"、"tokens"、"users" 等',
    metric_description TEXT NULL COMMENT '指标的详细说明，用于文档与解释',
    calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '该统计记录的计算时间',
    data_source ENUM('realtime', 'daily_batch', 'weekly_batch', 'monthly_batch') NOT NULL DEFAULT 'daily_batch' COMMENT '数据来源类型：realtime（实时）、daily_batch（每日批量）、weekly_batch（每周批量）、monthly_batch（每月批量）',
    is_aggregated BOOLEAN NOT NULL DEFAULT TRUE COMMENT '是否为聚合数据，TRUE表示是汇总值，FALSE表示是原始记录（如用户级）',
    metadata JSON NULL COMMENT '扩展元数据，如统计维度组合、过滤条件、采样率等',
    PRIMARY KEY (stat_id),
    UNIQUE KEY uk_date_metric_org_team_user (date_key, metric_type, organization_id, team_id, user_id),
    INDEX idx_date_key (date_key),
    INDEX idx_organization_id (organization_id),
    INDEX idx_team_id (team_id),
    INDEX idx_user_id (user_id),
    INDEX idx_metric_type (metric_type),
    INDEX idx_calculated_at (calculated_at),
    INDEX idx_data_source (data_source),
    INDEX idx_is_aggregated (is_aggregated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储Lingma系统全平台的多维度使用统计指标，用于运营分析、产品决策、计费结算与性能监控';
```

`lingma_statistics_info` 表是Lingma系统中用于**存储全平台多维度使用统计指标**的核心数据仓库表。该表设计采用“宽表+指标枚举”模式，支持对用户行为、系统性能、模型使用、设备环境等超过60种关键指标进行精细化、可聚合的统计分析，是企业级AI产品运营与决策的“数据中枢”。

`stat_id` 为主键，采用UUID格式。`date_key` 为日期维度，格式为 `YYYY-MM-DD`，是所有统计的基准时间单位，支持按日、周、月进行时间序列分析。

`organization_id`、`team_id`、`user_id` 为可选维度，支持三级聚合：
- `organization_id`：企业级统计，如“腾讯云整体AI使用量”；
- `team_id`：团队级统计，如“前端组每日代码生成次数”；
- `user_id`：个体用户统计，如“张三本周使用AI补全120次”。

`metric_type` 字段为枚举类型，定义了60+种统计指标，覆盖五大维度：

### 1. 用户活跃度
- `total_users`：系统总注册用户数
- `active_users_daily`：日活跃用户（DAU），定义为当日至少触发一次AI交互的用户
- `active_users_weekly`：周活跃用户（WAU）
- `active_users_monthly`：月活跃用户（MAU）

### 2. 会话与交互
- `total_chats`：总对话会话数
- `active_chats_daily`：当日活跃会话数（有消息交互）
- `total_coding_tasks`：总代码生成任务数
- `total_completions`：总代码补全请求数

### 3. 资源消耗与性能
- `total_tokens_consumed`：系统总消耗token数，用于计费与成本核算
- `total_code_lines_generated`：AI生成的总代码行数
- `avg_generation_time_ms`：代码生成平均耗时（毫秒）
- `avg_completion_time_ms`：代码补全平均耗时（毫秒）

### 4. 用户接受度与质量
- `code_acceptance_rate`：代码生成接受率 = 接受次数 / 总生成次数
- `completion_acceptance_rate`：代码补全接受率
- `avg_code_quality_score`：生成代码平均质量评分（0.0~1.0）
- `syntax_error_rate`：生成代码语法错误率 = 出现语法错误的次数 / 总生成次数
- `lint_warning_rate`：代码规范警告率
- `duplicate_code_rate`：重复代码检测率

### 5. 模型与语言使用
- `model_usage_lingma_7b`、`model_usage_lingma_13b`、`model_usage_lingma_32b`：各模型使用次数
- `language_python`、`language_java`、`language_javascript` 等：各编程语言使用频次

### 6. 设备与环境
- `device_os_windows`、`device_os_macos`、`device_os_linux`：操作系统分布
- `device_ide_intellij`、`device_ide_vscode`、`device_ide_pycharm` 等：IDE使用分布
- `network_latency_0_100ms`、`network_latency_101_500ms` 等：网络延迟分段统计

### 7. 功能使用
- `feature_code_completion_enabled`：启用补全功能的用户数
- `feature_code_generation_enabled`：启用生成功能的用户数
- `feature_auto_suggest_enabled`：启用自动建议的用户数

### 8. 上下文窗口
- `context_window_8k`、`context_window_16k`、`context_window_32k`：用户设置的上下文窗口大小分布

### 9. 用户角色
- `user_role_developer`、`user_role_manager`、`user_role_admin`、`user_role_guest`：各角色用户数

`metric_value` 为数值字段，单位由 `metric_unit` 指定，如：
- `count`：次数（如 `total_chats`）
- `ms`：毫秒（如 `avg_generation_time_ms`）
- `percent`：百分比（如 `code_acceptance_rate`）
- `lines`：代码行数
- `tokens`：token数
- `users`：用户数

`metric_description` 字段提供指标的详细说明，例如：
> “code_acceptance_rate：用户接受AI生成代码的比例，计算方式为：接受次数 / 总生成次数。该指标反映AI生成结果的实用性与准确性。”

`calculated_at` 记录统计计算时间，`data_source` 标识数据来源：
- `realtime`：实时计算，如在线用户数
- `daily_batch`：每日凌晨批量计算，如日活跃用户
- `weekly_batch`：每周一计算周数据
- `monthly_batch`：每月1日计算月数据

`is_aggregated` 标识是否为聚合数据。若为 `TRUE`，表示该记录是汇总值（如“某团队日均生成次数”）；若为 `FALSE`，表示是原始记录（如“用户A在2025-11-10生成了3次代码”），可用于明细分析。

`metadata` 字段存储扩展信息，如：
```json
{
  "filter": "project_id='proj-abc123'",
  "sample_rate": 1.0,
  "aggregation_level": "team",
  "time_range": "2025-11-01 to 2025-11-30"
}
```

唯一索引 `uk_date_metric_org_team_user` 确保同一日期、同一指标、同一组织/团队/用户组合仅存在一条记录，避免重复计算。

索引设计覆盖了所有查询维度，特别是 `date_key`、`metric_type`、`organization_id`、`team_id`、`user_id`、`calculated_at`、`data_source`、`is_aggregated`。复合索引如 `(date_key, metric_type, organization_id)` 可用于快速查询“某企业近30天的总token消耗趋势”。

该表是Lingma系统运营分析的“数据金矿”。通过该表，企业可：
- 分析AI工具的ROI：计算每1000 token的生成价值；
- 识别高价值用户：找出使用频率最高、接受率最高的开发者；
- 优化模型部署：根据语言使用率决定是否优先优化Go语言支持；
- 监控性能瓶颈：若 `avg_completion_time_ms` 在下午3点飙升，需排查服务器负载；
- 制定定价策略：基于token消耗分布设计阶梯计费模型；
- 预测增长趋势：通过DAU/MAU比率判断用户粘性。

该表的结构设计遵循数据仓库星型模型原则，支持OLAP分析，可直接对接BI工具（如Tableau、Power BI）生成可视化仪表盘，是Lingma从“功能产品”迈向“数据驱动型AI平台”的关键基础设施。