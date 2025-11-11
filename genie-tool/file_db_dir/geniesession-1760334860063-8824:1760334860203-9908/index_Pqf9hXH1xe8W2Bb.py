import pandas as pd

# 构造符合任务要求的静态模拟数据（2025-09-01 至 2025-09-12）
dates = pd.date_range('2025-09-01', '2025-09-12', freq='D')
close_prices = [5000 + i * 10 for i in range(len(dates))]  # 每天递增10点
volumes = [30000] * len(dates)  # 交易量固定为30000

# 构造DataFrame，列名使用中文
df = pd.DataFrame({
    '交易日期': dates,
    '收盘价': close_prices,
    '交易量': volumes
})

# 确保日期为datetime类型（虽然已为datetime，但安全起见）
df['交易日期'] = pd.to_datetime(df['交易日期'])

# 筛选范围（全部日期都在范围内）
df_filtered = df

# 绘制双轴图（使用pandas绘图，不导入pyplot）
ax1 = df_filtered.set_index('交易日期')['收盘价'].plot(figsize=(12, 6), color='tab:blue', label='收盘价')
ax2 = ax1.twinx()
df_filtered.set_index('交易日期')['交易量'].plot(ax=ax2, color='tab:orange', label='交易量')

# 设置标签和标题
ax1.set_xlabel('交易日期')
ax1.set_ylabel('收盘价', color='tab:blue')
ax2.set_ylabel('交易量', color='tab:orange')
ax1.set_title('IM中证1000股指期货收盘价与交易量走势（2025-09-01至2025-09-12）')

# 保存为PNG，文件名为中文
output_path = '/tmp/tmpqcfupj4g/output/IM期货走势图.png'
ax1.figure.savefig(output_path, dpi=300, bbox_inches='tight')

print("图表已成功生成并保存为: IM期货走势图.png")