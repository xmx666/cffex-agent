# Lingma 数据表字段注释摘要

## 表名：lingma_chat_info
| 字段名 | 类型 | 注释 |
|--------|------|------|
| uuid | varchar(255) | 聊天会话唯一标识 |
| user_id | varchar(255) | 用户唯一标识 |
| display_name | varchar(255) | 用户显示名称 |
| chat_type | varchar(255) | 聊天类型（对话/问答等） |
| chat_turns | int | 对话轮次总数 |
| ide | varchar(255) | 使用的IDE工具 |
| update_time | datetime | 数据更新时间 |

## 表名：lingma_coding_info
| 字段名 | 类型 | 注释 |
|--------|------|------|
| uuid | varchar(255) | 编码行为唯一标识 |
| user_id | varchar(255) | 用户唯一标识 |
| display_name | varchar(255) | 用户显示名称 |
| language | varchar(255) | 编程语言 |
| lines_accepted | int | 接受的代码行数 |
| lines_changed | int | 修改的代码行数 |
| ai_lines_rate | decimal(10,4) | AI生成代码占比 |
| update_time | datetime | 数据更新时间 |

## 表名：lingma_completion_info
| 字段名 | 类型 | 注释 |
|--------|------|------|
| uuid | varchar(255) | 代码补全行为唯一标识 |
| user_id | varchar(255) | 用户唯一标识 |
| display_name | varchar(255) | 用户显示名称 |
| language | varchar(255) | 编程语言 |
| ide | varchar(255) | 使用的IDE工具 |
| count_accepted | int | 接受的补全次数 |
| count_suggested | int | 建议的补全次数 |
| lines_accepted | int | 接受的代码行数 |
| lines_suggested | int | 建议的代码行数 |
| ai_accept_rate_count | decimal(10,4) | 基于次数的AI接受率 |
| ai_accept_rate_lines | decimal(10,4) | 基于行数的AI接受率 |
| update_time | datetime | 数据更新时间 |

## 表名：lingma_developer_members
| 字段名 | 类型 | 注释 |
|--------|------|------|
| user_id | varchar(255) | 用户唯一标识 |
| user_name | varchar(255) | 用户登录名 |
| display_name | varchar(255) | 用户显示名称 |
| gmt_create | datetime | 用户创建时间 |
| member_id | varchar(255) | 成员ID |
| status | char(1) | 用户状态（1-启用，0-禁用） |

## 表名：lingma_feedbacks_info
| 字段名 | 类型 | 注释 |
|--------|------|------|
| id | int | 反馈记录ID |
| userId | varchar(255) | 用户ID |
| organizationId | varchar(255) | 组织ID |
| requestId | varchar(255) | 请求ID |
| sessionId | varchar(255) | 会话ID |
| gmtCreate | datetime | 反馈创建时间 |
| gmtModified | datetime | 反馈修改时间 |
| adviceText | text | 用户建议文本 |
| chatTask | text | 聊天任务描述 |
| checkBoxItems | text | 勾选项列表 |
| context | text | 上下文信息 |
| deleted | tinyint | 是否删除（1-已删除，0-未删除） |

## 表名：lingma_statistics_info
| 字段名 | 类型 | 注释 |
|--------|------|------|
| uuid | varchar(255) | 用户统计唯一标识 |
| user_id | varchar(255) | 用户唯一标识 |
| display_name | varchar(255) | 用户显示名称 |
| statusActive | varchar(255) | 整体活跃状态 |
| statusActiveChat | varchar(255) | 聊天活跃状态 |
| statusActiveCompletion | varchar(255) | 补全活跃状态 |
| statusActiveLastedTime | datetime | 最后活跃时间 |
| totalChatTurns | int | 总对话轮次 |
| totalLinesChanged | int | 总修改代码行数 |
| totalLinesAccepted | int | 总接受代码行数 |
| update_time | datetime | 数据更新时间 |