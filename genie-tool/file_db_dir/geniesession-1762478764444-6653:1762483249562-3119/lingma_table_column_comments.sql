-- 为lingma_chat_info表添加列注释
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN uuid COMMENT '聊天会话唯一标识';
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN user_id COMMENT '用户唯一标识';
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN display_name COMMENT '用户显示名称';
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN chat_type COMMENT '聊天类型，如对话、问答等';
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN chat_turns COMMENT '对话轮次总数';
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN ide COMMENT '使用的IDE工具';
ALTER TABLE ods_telemetry.lingma_chat_info MODIFY COLUMN update_time COMMENT '数据更新时间';

-- 为lingma_coding_info表添加列注释
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN uuid COMMENT '编码行为唯一标识';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN user_id COMMENT '用户唯一标识';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN display_name COMMENT '用户显示名称';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN language COMMENT '编程语言';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN lines_accepted COMMENT '接受的代码行数';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN lines_changed COMMENT '修改的代码行数';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN ai_lines_rate COMMENT 'AI生成代码占比';
ALTER TABLE ods_telemetry.lingma_coding_info MODIFY COLUMN update_time COMMENT '数据更新时间';

-- 为lingma_completion_info表添加列注释
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN uuid COMMENT '代码补全行为唯一标识';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN user_id COMMENT '用户唯一标识';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN display_name COMMENT '用户显示名称';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN language COMMENT '编程语言';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN ide COMMENT '使用的IDE工具';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN count_accepted COMMENT '接受的补全次数';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN count_suggested COMMENT '建议的补全次数';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN lines_accepted COMMENT '接受的代码行数';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN lines_suggested COMMENT '建议的代码行数';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN ai_accept_rate_count COMMENT '基于次数的AI接受率';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN ai_accept_rate_lines COMMENT '基于行数的AI接受率';
ALTER TABLE ods_telemetry.lingma_completion_info MODIFY COLUMN update_time COMMENT '数据更新时间';

-- 为lingma_developer_members表添加列注释
ALTER TABLE ods_telemetry.lingma_developer_members MODIFY COLUMN user_id COMMENT '用户唯一标识';
ALTER TABLE ods_telemetry.lingma_developer_members MODIFY COLUMN user_name COMMENT '用户登录名';
ALTER TABLE ods_telemetry.lingma_developer_members MODIFY COLUMN display_name COMMENT '用户显示名称';
ALTER TABLE ods_telemetry.lingma_developer_members MODIFY COLUMN gmt_create COMMENT '用户创建时间';
ALTER TABLE ods_telemetry.lingma_developer_members MODIFY COLUMN member_id COMMENT '成员ID';
ALTER TABLE ods_telemetry.lingma_developer_members MODIFY COLUMN status COMMENT '用户状态，1-启用，0-禁用';

-- 为lingma_feedbacks_info表添加列注释
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN id COMMENT '反馈记录ID';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN userId COMMENT '用户ID';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN organizationId COMMENT '组织ID';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN requestId COMMENT '请求ID';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN sessionId COMMENT '会话ID';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN gmtCreate COMMENT '反馈创建时间';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN gmtModified COMMENT '反馈修改时间';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN adviceText COMMENT '用户建议文本';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN chatTask COMMENT '聊天任务描述';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN checkBoxItems COMMENT '勾选项列表';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN context COMMENT '上下文信息';
ALTER TABLE ods_telemetry.lingma_feedbacks_info MODIFY COLUMN deleted COMMENT '是否删除，1-已删除，0-未删除';

-- 为lingma_statistics_info表添加列注释
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN uuid COMMENT '用户统计唯一标识';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN user_id COMMENT '用户唯一标识';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN display_name COMMENT '用户显示名称';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN statusActive COMMENT '整体活跃状态';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN statusActiveChat COMMENT '聊天活跃状态';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN statusActiveCompletion COMMENT '补全活跃状态';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN statusActiveLastedTime COMMENT '最后活跃时间';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN totalChatTurns COMMENT '总对话轮次';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN totalLinesChanged COMMENT '总修改代码行数';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN totalLinesAccepted COMMENT '总接受代码行数';
ALTER TABLE ods_telemetry.lingma_statistics_info MODIFY COLUMN update_time COMMENT '数据更新时间';