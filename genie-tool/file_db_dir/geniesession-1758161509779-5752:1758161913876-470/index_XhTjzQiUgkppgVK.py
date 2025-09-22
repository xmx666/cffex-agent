import pandas as pd
from datetime import datetime, timedelta

# 模拟生成符合要求的示例数据
data = {
    'date': ['2024-06-01', '2024-06-01', '2024-06-02', '2024-06-02', '2024-06-02'],
    'service_name': ['ServiceA', 'ServiceB', 'ServiceA', 'ServiceB', 'ServiceC'],
    'health_rate': [0.96, 0.94, 0.97, 0.93, 0.98],
    'failure_count': [2, 5, 1, 6, 0]
}
df = pd.DataFrame(data)

# 转换日期列
df['date'] = pd.to_datetime(df['date'])

# 获取最近两天的数据
two_days_ago = datetime.now() - timedelta(days=2)
recent_df = df[df['date'] >= two_days_ago]

# 按服务分组，计算平均健康率和总失败次数
summary = recent_df.groupby('service_name').agg(
    avg_health_rate=('health_rate', 'mean'),
    total_failures=('failure_count', 'sum')
).reset_index()

# 打印分析结果
print(summary[['service_name', 'avg_health_rate', 'total_failures']])

# 保存为中文文件名的CSV文件
output_path = '/tmp/tmp4_90orlw/output/服务健康分析报告.csv'
summary[['service_name', 'avg_health_rate', 'total_failures']].to_csv(output_path, index=False, encoding='utf-8-sig')