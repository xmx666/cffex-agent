import pandas as pd

# 读取CSV文件
df = pd.read_csv('/tmp/tmpcdy5qajs/期货行情周度数据.csv')

# 转换交易日期为datetime类型
df['trading_date'] = pd.to_datetime(df['trading_date'])

# 按品种分组，计算周涨跌幅、平均成交量、持仓量变化
grouped = df.groupby('product_id').agg(
    price_change=('last_price', lambda x: x.iloc[-1] - x.iloc[0]),
    avg_volume=('volume', 'mean'),
    oi_change=('open_interest', lambda x: x.iloc[-1] - x.iloc[0])
).reset_index()

# 打印计算结果
print("各品种周涨跌幅、平均成交量、持仓量变化：")
print(grouped)

# 保存计算结果为中文文件名的Excel文件
output_path = '/tmp/tmpcdy5qajs/output/期货行情趋势与成交量分析.xlsx'
with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
    grouped.to_excel(writer, sheet_name='统计摘要', index=False)

# 打印保存信息
print("数据已保存至：/tmp/tmpcdy5qajs/output/期货行情趋势与成交量分析.xlsx")