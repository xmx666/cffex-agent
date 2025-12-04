/**
 * Prompt构建工具
 * 根据配置构建不同级别的Prompt
 */

import { AppConfig } from './configManager';
import { globalTemplateManager } from './templateManager';

export interface PromptConfig {
  systemPrompt: string;
  taskPrompts: string[];
  summaryPrompts: string[];
  userPrompts: string[];
  solutionTemplates: string[];
}

/**
 * 从配置中构建Prompt配置
 */
export function buildPromptConfig(config: AppConfig): PromptConfig {
  const { prompts } = config;

  // 安全检查，确保prompts对象存在
  if (!prompts) {
    return {
      systemPrompt: '',
      taskPrompts: [],
      summaryPrompts: [],
      userPrompts: [],
      solutionTemplates: []
    };
  }

  // 安全检查，确保数组存在
  const customPrompts = prompts.customPrompts || [];
  const solutionTemplates = prompts.solutionTemplates || [];

  // 系统级Prompt：系统提示词 + 系统级自定义Prompt
  const systemPrompts = [
    prompts.systemPrompt || '',
    ...customPrompts
      .filter(p => p.category === 'system' && p.enabled)
      .map(p => p.content)
  ].filter(Boolean);

  // 任务级Prompt：任务级自定义Prompt
  const taskPrompts = customPrompts
    .filter(p => p.category === 'task' && p.enabled)
    .map(p => p.content);

  // 总结级Prompt：总结级自定义Prompt
  const summaryPrompts = customPrompts
    .filter(p => p.category === 'summary' && p.enabled)
    .map(p => p.content);

  // 用户级Prompt：用户级自定义Prompt
  const userPrompts = customPrompts
    .filter(p => p.category === 'custom' && p.enabled)
    .map(p => p.content);

  // 解决思路模板
  const solutionTemplatesArray = solutionTemplates
    .map(t => t.template)
    .filter(Boolean);

  return {
    systemPrompt: systemPrompts.join('\n\n'),
    taskPrompts,
    summaryPrompts,
    userPrompts,
    solutionTemplates: solutionTemplatesArray
  };
}

/**
 * 构建完整的系统Prompt追加内容
 * 注意：这里返回系统级Prompt追加内容，包含systemPrompt字段和系统级自定义Prompt
 * 原始系统Prompt由后端处理，这里只提供追加内容
 */
export function buildSystemPrompt(config: AppConfig): string {
  const { prompts } = config;

  // 安全检查
  if (!prompts) {
    return '';
  }

  // 收集所有系统级Prompt追加内容：
  // 1. prompts.systemPrompt（系统级Prompt输入框的内容）
  // 2. 系统级自定义Prompt（category为'system'的customPrompts）
  const systemPrompts: string[] = [];

  // 添加系统级Prompt输入框的内容
  if (prompts.systemPrompt && prompts.systemPrompt.trim()) {
    systemPrompts.push(prompts.systemPrompt.trim());
  }

  // 添加系统级自定义Prompt
  const customPrompts = prompts.customPrompts || [];
  const systemCustomPrompts = customPrompts
    .filter(p => p.category === 'system' && p.enabled)
    .map(p => p.content);

  systemPrompts.push(...systemCustomPrompts);

  // 过滤空内容并合并
  return systemPrompts.filter(Boolean).join('\n\n');
}

/**
 * 构建任务执行前的Prompt
 * 只返回任务级自定义Prompt，让后端追加到原始任务Prompt
 */
export function buildTaskPrompt(config: AppConfig, baseTaskPrompt?: string): string {
  const { prompts } = config;

  // 安全检查
  if (!prompts || !prompts.customPrompts) {
    return '';
  }

  // 只返回任务级自定义Prompt
  const taskPrompts = prompts.customPrompts
    .filter(p => p.category === 'task' && p.enabled)
    .map(p => p.content);

  return taskPrompts.join('\n\n');
}

/**
 * 构建结果总结时的Prompt
 * 只返回总结级自定义Prompt，让后端追加到原始总结Prompt
 */
export function buildSummaryPrompt(config: AppConfig, baseSummaryPrompt?: string): string {
  const { prompts } = config;

  // 安全检查
  if (!prompts || !prompts.customPrompts) {
    return '';
  }

  // 只返回总结级自定义Prompt
  const summaryPrompts = prompts.customPrompts
    .filter(p => p.category === 'summary' && p.enabled)
    .map(p => p.content);

  return summaryPrompts.join('\n\n');
}

// 缓存模板配置，避免频繁请求
let cachedTemplateConfig: { config: any; timestamp: number } | null = null;
const CACHE_DURATION = 5000; // 缓存5秒

/**
 * 获取已选择的模板内容（用户级别）
 * 模板内容应该直接拼接到用户输入中，作为用户输入的一部分
 * 使用用户级别的模板选择
 */
export async function getSelectedTemplateContentsAsync(): Promise<string> {
  try {
    return await globalTemplateManager.getUserSelectedTemplateContents();
  } catch (error) {
    console.error('获取模板内容失败:', error);
    return '';
  }
}

/**
 * 同步版本（使用缓存）
 */
export function getSelectedTemplateContents(config?: AppConfig): string {
  // 如果缓存有效，直接返回
  if (cachedTemplateConfig && Date.now() - cachedTemplateConfig.timestamp < CACHE_DURATION) {
    const templateConfig = cachedTemplateConfig.config;
    if (templateConfig.selectedTemplateIds && templateConfig.templateList) {
      const selectedTemplates = templateConfig.selectedTemplateIds
        .map((id: string) => templateConfig.templateList.find((t: any) => t.id === id))
        .filter((t: any) => t && t.enabled) as Array<{ content: string }>;

      const templateContents = selectedTemplates.map(t => t.content);
      return templateContents.join('\n\n');
    }
  }

  // 异步更新缓存（不阻塞）
  globalTemplateManager.getTemplateConfig().then(config => {
    cachedTemplateConfig = { config, timestamp: Date.now() };
  }).catch(error => {
    console.error('更新模板配置缓存失败:', error);
  });

  return '';
}

/**
 * 构建用户输入前的Prompt
 * 只返回用户级自定义Prompt，不包含模板内容（模板内容应该直接拼接到用户输入中）
 */
export function buildUserPrompt(config: AppConfig, userInput: string): string {
  const { prompts } = config;

  // 只返回用户级自定义Prompt，不包含模板内容
  if (!prompts || !prompts.customPrompts) {
    return '';
  }

  const customUserPrompts = prompts.customPrompts
    .filter(p => p.category === 'custom' && p.enabled)
    .map(p => p.content);

  return customUserPrompts.join('\n\n');
}

/**
 * 构建任务规划时的Prompt
 * 只返回解决思路模板，让后端追加到原始规划Prompt
 */
export function buildPlanningPrompt(config: AppConfig, basePlanningPrompt?: string): string {
  const { prompts } = config;

  // 安全检查
  if (!prompts || !prompts.solutionTemplates) {
    return '';
  }

  // 只返回解决思路模板
  const solutionTemplates = prompts.solutionTemplates
    .map(t => t.template)
    .filter(Boolean);

  return solutionTemplates.join('\n\n');
}

/**
 * 获取所有启用的自定义Prompt（用于调试）
 */
export function getEnabledPrompts(config: AppConfig) {
  const { prompts } = config;

  // 安全检查
  if (!prompts) {
    return {
      system: [],
      task: [],
      summary: [],
      custom: [],
      solutionTemplates: []
    };
  }

  const customPrompts = prompts.customPrompts || [];
  const solutionTemplates = prompts.solutionTemplates || [];

  return {
    system: customPrompts.filter(p => p.category === 'system' && p.enabled),
    task: customPrompts.filter(p => p.category === 'task' && p.enabled),
    summary: customPrompts.filter(p => p.category === 'summary' && p.enabled),
    custom: customPrompts.filter(p => p.category === 'custom' && p.enabled),
    solutionTemplates: solutionTemplates
  };
}
