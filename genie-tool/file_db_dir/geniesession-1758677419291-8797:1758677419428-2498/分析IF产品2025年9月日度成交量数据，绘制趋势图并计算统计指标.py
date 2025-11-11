import pandas as pd

# 读取CSV文件
df = pd.read_csv('/tmp/tmpzpf__o9c/IF_202509_volume_trend.csv')

# 计算统计指标
mean_volume = df['volume'].mean()
max_volume = df['volume'].max()

# 计算变化趋势（使用最后一天减第一天）
trend = df['volume'].iloc[-1] - df['volume'].iloc[0]
trend_description = "上升" if trend > 0 else "下降" if trend < 0 else "平稳"

# 将统计结果与原始数据合并成一个DataFrame用于保存
summary = pd.DataFrame({
    '指标': ['平均成交量', '最大成交量', '变化趋势'],
    '值': [f"{mean_volume:.2f}", max_volume, trend_description]
})

# 创建包含原始数据和统计摘要的Excel文件
output_path = '/tmp/tmpzpf__o9c/output/IF产品2025年9月成交量趋势.xlsx'
with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='日度成交量数据', index=False)
    summary.to_excel(writer, sheet_name='统计摘要', index=False)

# 打印分析结果
print(f"平均成交量: {mean_volume:.2f}")
print(f"最大成交量: {max_volume}")
print(f"变化趋势: {trend_description}（从{df['volume'].iloc[0]}到{df['volume'].iloc[-1]}）")