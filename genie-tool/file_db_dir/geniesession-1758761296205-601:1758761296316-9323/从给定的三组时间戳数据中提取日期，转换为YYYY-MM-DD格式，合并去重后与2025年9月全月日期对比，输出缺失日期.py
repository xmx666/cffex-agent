import pandas as pd

# 给定的时间戳数据（毫秒级）
timestamps = [
    1758540025000,  # 第一组
    1758243069000, 1758029708000, 1758007295000, 1757718031880, 1757680763000, 1757641600000,  # 第二组
    1758540025000, 1758517606000  # 第三组
]

# 转换为日期（YYYY-MM-DD）
dates = pd.to_datetime(timestamps, unit='ms').strftime('%Y-%m-%d').unique()

# 生成2025年9月1日至30日的完整日期列表
full_month = pd.date_range('2025-09-01', '2025-09-30', freq='D').strftime('%Y-%m-%d')

# 找出缺失的日期
missing_dates = [d for d in full_month if d not in dates]

# 输出结果
print("有数据的日期:", list(dates))
print("缺失的日期:", missing_dates)

# 保存为Excel文件，文件名为中文
output_path = "/tmp/tmpsniened2/output/缺失日期分析结果.xlsx"
result_df = pd.DataFrame({
    "有数据的日期": list(dates),
    "缺失的日期": [None] * len(dates)  # 保持结构一致，缺失日期单独一列
})
result_df["缺失的日期"] = pd.Series(missing_dates).reindex(result_df.index).values
result_df.to_excel(output_path, engine='openpyxl', index=False)