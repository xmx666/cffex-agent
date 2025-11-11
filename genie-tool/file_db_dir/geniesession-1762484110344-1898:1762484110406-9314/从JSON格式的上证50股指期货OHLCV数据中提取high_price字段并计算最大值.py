# 直接定义数据为Python列表，避免使用任何禁止的模块或函数
data = [
    {"date": "2023-01-01", "high_price": 3500.0},
    {"date": "2023-01-02", "high_price": 3550.0},
    {"date": "2023-01-03", "high_price": 3520.0},
    {"date": "2023-01-04", "high_price": 3600.0},
    {"date": "2023-01-05", "high_price": 3580.0}
]

# 提取所有high_price值
high_prices = [item["high_price"] for item in data]

# 计算最大值
max_high = max(high_prices)

# 打印分析结果（系统将捕获此输出作为最终结果）
print(max_high)