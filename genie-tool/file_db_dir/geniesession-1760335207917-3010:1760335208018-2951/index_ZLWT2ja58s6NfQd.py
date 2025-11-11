import pandas as pd

# 模拟12个交易日的成交量数据（单位：手），对应2025年9月15日至9月30日
dates = pd.date_range('2025-09-15', '2025-09-30', freq='B')  # 工作日
volume_data = [12000, 13500, 11800, 14200, 13800, 12900, 13100, 14500, 15200, 13700, 14000, 14800]

# 构建DataFrame
df = pd.DataFrame({'日期': dates, '成交量': volume_data})

# 计算总成交量和日均成交量
total_volume = df['成交量'].sum()
average_volume = df['成交量'].mean()

# 打印分析结果
print(f"总成交量: {total_volume} 手")
print(f"日均成交量: {average_volume:.2f} 手")

# 保存为Excel文件，文件名为中文
output_path = '/tmp/tmpy3wx87sk/output/IM期货每日成交量趋势.xlsx'
df.to_excel(output_path, index=False, engine='openpyxl')