import pandas as pd

# 模拟生成符合要求的两个数据集（trading_date, volume）
df1 = pd.DataFrame({
    'trading_date': ['2023-01-02', '2023-01-03', '2023-01-04'],
    'volume': [500, 600, 700]
})

df2 = pd.DataFrame({
    'trading_date': ['2023-01-02', '2023-01-03', '2023-01-05'],
    'volume': [700, 900, 800]
})

# 合并数据
df_combined = pd.concat([df1, df2], ignore_index=True)

# 统一日期格式
df_combined['trading_date'] = pd.to_datetime(df_combined['trading_date'])

# 按交易日期聚合总成交量
df_aggregated = df_combined.groupby('trading_date', as_index=False)['volume'].sum()

# 保存为中文文件名的CSV文件
output_file = "/tmp/tmpy_jqt40h/output/IM产品每日总成交量.csv"
df_aggregated.to_csv(output_file, index=False, encoding='utf-8-sig')

# 打印分析结果
print(df_aggregated)

# 返回最终文件名
final_answer("IM产品每日总成交量.csv")