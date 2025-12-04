/**
 * Prompt相关的Hook
 * 提供Prompt构建和应用的功能
 */

import { useMemo } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { 
  buildPromptConfig, 
  buildSystemPrompt, 
  buildTaskPrompt, 
  buildSummaryPrompt, 
  buildUserPrompt, 
  buildPlanningPrompt,
  getSelectedTemplateContents,
  getEnabledPrompts,
  type PromptConfig
} from '@/utils/promptBuilder';

/**
 * 使用Prompt配置的Hook
 */
export function usePrompt() {
  const { config } = useConfig();

  // 构建完整的Prompt配置
  const promptConfig: PromptConfig = useMemo(() => {
    return buildPromptConfig(config);
  }, [config]);

  // 构建系统Prompt
  const systemPrompt = useMemo(() => {
    return buildSystemPrompt(config);
  }, [config]);

  // 获取启用的Prompt（用于调试）
  const enabledPrompts = useMemo(() => {
    try {
      return getEnabledPrompts(config);
    } catch (error) {
      console.error('获取启用的Prompt失败:', error);
      return {
        system: [],
        task: [],
        summary: [],
        custom: [],
        solutionTemplates: []
      };
    }
  }, [config]);

  // 构建任务Prompt
  const buildTaskPromptWithBase = (baseTaskPrompt?: string) => {
    return buildTaskPrompt(config, baseTaskPrompt);
  };

  // 构建总结Prompt
  const buildSummaryPromptWithBase = (baseSummaryPrompt?: string) => {
    return buildSummaryPrompt(config, baseSummaryPrompt);
  };

  // 构建用户Prompt
  const buildUserPromptWithInput = (userInput: string) => {
    return buildUserPrompt(config, userInput);
  };

  // 获取已选择的模板内容（使用全局模板管理器，不依赖config）
  const selectedTemplateContents = useMemo(() => {
    return getSelectedTemplateContents();
  }, []);

  // 构建规划Prompt
  const buildPlanningPromptWithBase = (basePlanningPrompt?: string) => {
    return buildPlanningPrompt(config, basePlanningPrompt);
  };

  return {
    promptConfig,
    systemPrompt,
    enabledPrompts,
    selectedTemplateContents,
    buildTaskPrompt: buildTaskPromptWithBase,
    buildSummaryPrompt: buildSummaryPromptWithBase,
    buildUserPrompt: buildUserPromptWithInput,
    buildPlanningPrompt: buildPlanningPromptWithBase
  };
}
