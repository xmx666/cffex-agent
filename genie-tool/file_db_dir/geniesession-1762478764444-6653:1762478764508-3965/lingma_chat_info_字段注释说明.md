# lingma_chat_info 表字段注释说明

- `uuid`: 唯一聊天会话标识符，用于追踪独立对话实例
- `user_id`: 用户系统唯一标识，关联用户身份信息
- `display_name`: 用户在界面中显示的名称，非唯一
- `chat_type`: 聊天类型，如：咨询、反馈、技术支持等
- `chat_turns`: 单次会话的对话轮数，反映交互深度
- `ide`: 使用的集成开发环境，如VSCode、PyCharm等
- `update_time`: 记录最后更新时间，用于数据时效性管理
