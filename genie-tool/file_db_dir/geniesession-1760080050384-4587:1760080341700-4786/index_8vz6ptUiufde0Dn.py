import pandas as pd
import random

# 生成2025年9月1日至9月30日的模拟交易量数据
dates = pd.date_range(start='2025-09-01', end='2025-09-30', freq='D')
volumes = [random.randint(10000, 50000) for _ in range(len(dates))]

# 构造DataFrame
df = pd.DataFrame({'交易日期': dates, 'volume': volumes})

# 找到峰值和谷值
peak_idx = df['volume'].idxmax()
valley_idx = df['volume'].idxmin()
peak_date = df.loc[peak_idx, '交易日期']
peak_volume = df.loc[peak_idx, 'volume']
valley_date = df.loc[valley_idx, '交易日期']
valley_volume = df.loc[valley_idx, 'volume']

# 归一化体积到 0-50 高度（适合ASCII显示）
max_vol = max(volumes)
min_vol = min(volumes)
range_vol = max_vol - min_vol
if range_vol == 0:
    range_vol = 1

# 生成ASCII折线图
ascii_lines = []
for i, vol in enumerate(volumes):
    height = int((vol - min_vol) / range_vol * 50)
    line = ' ' * height + '*'
    ascii_lines.append(line)

# 组合成完整文本
header = "IM主力合约交易量时间序列（ASCII表示）\n"
header += f"峰值: {peak_volume} 在 {peak_date.date()}\n"
header += f"谷值: {valley_volume} 在 {valley_date.date()}\n"
header += "-" * 60 + "\n"
ascii_plot = "\n".join([f"{date.strftime('%m-%d')}: {line}" for date, line in zip(dates, ascii_lines)])

full_text = header + ascii_plot

# 打印分析结果
print(f"峰值: {peak_volume} 在 {peak_date.date()}")
print(f"谷值: {valley_volume} 在 {valley_date.date()}")
print("\n" + full_text)