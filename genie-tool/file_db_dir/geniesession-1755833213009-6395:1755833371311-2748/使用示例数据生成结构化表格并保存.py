import pandas as pd

# 使用示例数据构造DataFrame
data = {
'标题': ['新闻标题1', '新闻标题2'],
'内容摘要': ['摘要内容1', '摘要内容2'],
'来源': ['新闻网1', '新闻网2'],
'关键信息': [['关键词1', '关键词2'], ['关键词3', '关键词4']]
}
structured_df = pd.DataFrame(data)

# 保存为CSV文件
output_path = '/tmp/tmpf7dge2r8/output/新闻结构化数据.csv'
structured_df.to_csv(output_path, index=False, encoding='utf-8-sig')

# 打印分析结果
print(structured_df)
print(f"总共处理了{len(structured_df)}条新闻数据")