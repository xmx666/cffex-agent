/**
 * Prompt调试组件
 * 显示当前启用的Prompt配置
 */

import React from 'react';
import { Card, Tag, Collapse } from 'antd';
import { usePrompt } from '@/hooks/usePrompt';

const { Panel } = Collapse;

const PromptDebugger: React.FC = () => {
  const { enabledPrompts, systemPrompt } = usePrompt();

  // 安全检查，确保enabledPrompts对象完整
  const safeEnabledPrompts = {
    system: enabledPrompts?.system || [],
    task: enabledPrompts?.task || [],
    summary: enabledPrompts?.summary || [],
    custom: enabledPrompts?.custom || [],
    solutionTemplates: enabledPrompts?.solutionTemplates || []
  };

  return (
    <Card title="当前启用的Prompt追加配置" size="small" className="mb-16">
      <div className="mb-8 p-8 bg-blue-50 rounded">
        <div className="text-[12px] text-gray-500">
          💡 这些Prompt会追加到系统原始Prompt的对应位置，不会替换原有内容
        </div>
      </div>
      <Collapse size="small">
        <Panel header="系统级追加Prompt" key="system">
          <div>
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">{systemPrompt || '无系统级追加Prompt'}</code>
          </div>
        </Panel>

        <Panel header={`任务级追加Prompt (${safeEnabledPrompts.task.length})`} key="task">
          {safeEnabledPrompts.task.length > 0 ? (
            safeEnabledPrompts.task.map((prompt, index) => (
              <div key={prompt.id} className="mb-8">
                <div className="mb-2">
                  <Tag color="blue">{prompt.name}</Tag>
                </div>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">{prompt.content}</code>
              </div>
            ))
          ) : (
            <div className="text-gray-500">无启用的任务级追加Prompt</div>
          )}
        </Panel>

        <Panel header={`总结级追加Prompt (${safeEnabledPrompts.summary.length})`} key="summary">
          {safeEnabledPrompts.summary.length > 0 ? (
            safeEnabledPrompts.summary.map((prompt, index) => (
              <div key={prompt.id} className="mb-8">
                <div className="mb-2">
                  <Tag color="green">{prompt.name}</Tag>
                </div>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">{prompt.content}</code>
              </div>
            ))
          ) : (
            <div className="text-gray-500">无启用的总结级追加Prompt</div>
          )}
        </Panel>

        <Panel header={`用户级追加Prompt (${safeEnabledPrompts.custom.length})`} key="custom">
          {safeEnabledPrompts.custom.length > 0 ? (
            safeEnabledPrompts.custom.map((prompt, index) => (
              <div key={prompt.id} className="mb-8">
                <div className="mb-2">
                  <Tag color="orange">{prompt.name}</Tag>
                </div>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">{prompt.content}</code>
              </div>
            ))
          ) : (
            <div className="text-gray-500">无启用的用户级追加Prompt</div>
          )}
        </Panel>

        <Panel header={`规划级追加模板 (${safeEnabledPrompts.solutionTemplates.length})`} key="planning">
          {safeEnabledPrompts.solutionTemplates.length > 0 ? (
            safeEnabledPrompts.solutionTemplates.map((template, index) => (
              <div key={template.id} className="mb-8">
                <div className="mb-2">
                  <Tag color="purple">{template.name}</Tag>
                </div>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm">{template.template}</code>
              </div>
            ))
          ) : (
            <div className="text-gray-500">无规划级追加模板</div>
          )}
        </Panel>
      </Collapse>
    </Card>
  );
};

export default PromptDebugger;