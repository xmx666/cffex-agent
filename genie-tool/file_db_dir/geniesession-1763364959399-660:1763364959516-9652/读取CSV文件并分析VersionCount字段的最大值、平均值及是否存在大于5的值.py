import pandas as pd

# 读取CSV文件
df = pd.read_csv('/tmp/tmp6vsea3w6/ods_telemetry_cffex_developer_version_analysis.csv')

# 计算最大值、平均值
max_value = df['VersionCount'].max()
mean_value = df['VersionCount'].mean()

# 检查是否存在大于5的值
exists_greater_than_5 = (df['VersionCount'] > 5).any()

# 打印分析结果
print(f"VersionCount的最大值: {max_value}")
print(f"VersionCount的平均值: {mean_value}")
print(f"是否存在大于5的值: {exists_greater_than_5}")

# 保存分析结果到Excel文件，文件名为中文
result_df = pd.DataFrame({
    '指标': ['最大值', '平均值', '是否存在大于5的值'],
    '值': [max_value, mean_value, exists_greater_than_5]
})
result_df.to_excel('/tmp/tmp6vsea3w6/output/版本计数分析结果.xlsx', index=False, engine='openpyxl')