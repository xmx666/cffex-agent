import React, { useMemo, useRef } from "react";
import classNames from "classnames";
import { useMsgTypes } from "./useMsgTypes";
import HTMLRenderer from "./HTMLRenderer";
import useContent from "./useContent";
import MarkdownRenderer from "./MarkdownRenderer";
import TableRenderer from "./TableRenderer";
import FileRenderer from "./FileRenderer";
import ReactJsonPretty from "react-json-pretty";
import SearchListRenderer from "./SearchListRenderer";
import { PanelItemType } from "./type";
import { PanelProvider } from ".";
import { useMemoizedFn } from "ahooks";
import { Empty } from "antd";

interface ActionPanelProps {
  taskItem?: PanelItemType;
  allowShowToolBar?: boolean;
  className?: string;
  noPadding?: boolean;
}

const ActionPanel: GenieType.FC<ActionPanelProps> = React.memo((props) => {
  const { taskItem, className, allowShowToolBar } = props;

  const msgTypes = useMsgTypes(taskItem);
  const { markDownContent } = useContent(taskItem);

  const { resultMap, toolResult } = taskItem || {};
  const [ fileInfo ] = resultMap?.fileInfo || [];
  const htmlUrl = fileInfo?.domainUrl;
  const downloadHtmlUrl = fileInfo?.ossUrl;

  const { codeOutput } = resultMap || {};

  const panelNode = useMemo(() => {
    const renderContent = () => {
      if (!taskItem) return null;
      const { useHtml, useCode, useFile, isHtml, useExcel, useJSON, searchList, usePpt } = msgTypes || {};

      if (searchList?.length) {
        return <SearchListRenderer list={searchList} />;
      }

      if (useHtml || usePpt) {
        // 如果有htmlUrl，说明文件已生成，直接渲染（无论是从FileList/BrowserList单击，还是流式输出完成）
        if (htmlUrl) {
          return (
            <HTMLRenderer
              htmlUrl={htmlUrl}
              className="h-full"
              downloadUrl={downloadHtmlUrl}
              showToolBar={allowShowToolBar && resultMap?.isFinal}
            />
          );
        }
        // 如果没有htmlUrl但有codeOutput，显示文本形式（流式输出中）
        if (codeOutput) {
          // 如果codeOutput是HTML代码但没有markdown代码块标记，直接使用pre标签显示，避免ReactMarkdown移除空格
          const trimmedCode = codeOutput.trim();
          const isHtmlCode = trimmedCode.startsWith('<!DOCTYPE') || trimmedCode.startsWith('<html');
          const hasCodeBlock = trimmedCode.startsWith('```');
          
          if (isHtmlCode && !hasCodeBlock) {
            // 直接显示HTML代码，保持原始格式
            return (
              <pre className="w-full p-4 bg-gray-50 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap break-words">
                {codeOutput}
              </pre>
            );
          }
          // 如果有代码块标记或者是其他格式，使用MarkdownRenderer
          return <MarkdownRenderer markDownContent={codeOutput} />;
        }
        // 如果既没有htmlUrl也没有codeOutput，显示空
        return <Empty description="暂无内容" className="mt-32" />;
      }

      if (useCode && isHtml) {
        return (
          <HTMLRenderer
            htmlUrl={`data:text/html;charset=utf-8,${encodeURIComponent(toolResult?.toolResult || '')}`}
          />
        );
      }

      if (useExcel) {
        return <TableRenderer fileUrl={fileInfo?.domainUrl} fileName={fileInfo?.fileName} />;
      }

      if (useFile) {
        return <FileRenderer fileUrl={fileInfo?.domainUrl} fileName={fileInfo?.fileName} />;
      }

      if (useJSON) {
        // 自定义主题：白底黑字，不同部分使用不同颜色
        const customTheme = {
          main: '#fff',
          error: '#ef4444',
          key: '#2563eb',
          string: '#059669',
          value: '#1e293b',
          boolean: '#dc2626',
          number: '#7c3aed',
        };
        
        // 处理所有工具返回的 JSON 格式，检查是否有嵌套的 JSON 字符串需要解析
        let jsonData: any = {};
        try {
          const rawResult = toolResult?.toolResult || '{}';
          jsonData = JSON.parse(rawResult);
          
          // 递归函数：查找并解析所有可能的 JSON 字符串字段
          const parseNestedJsonStrings = (obj: any): any => {
            if (typeof obj === 'string') {
              // 尝试解析字符串是否为 JSON
              try {
                const parsed = JSON.parse(obj);
                // 如果解析成功且是对象或数组，返回解析后的结果
                if (typeof parsed === 'object' && parsed !== null) {
                  return parseNestedJsonStrings(parsed); // 递归处理解析后的对象
                }
              } catch (e) {
                // 不是 JSON 字符串，返回原字符串
              }
              return obj;
            }
            
            if (Array.isArray(obj)) {
              return obj.map(item => parseNestedJsonStrings(item));
            }
            
            if (typeof obj === 'object' && obj !== null) {
              const result: any = {};
              for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                  result[key] = parseNestedJsonStrings(obj[key]);
                }
              }
              return result;
            }
            
            return obj;
          };
          
          // 处理嵌套的 JSON 字符串
          jsonData = parseNestedJsonStrings(jsonData);
        } catch (e) {
          console.error('Failed to parse tool result as JSON:', e);
          jsonData = {};
        }
        
        return (
          <div className="json-viewer-container bg-white p-16 rounded-lg border border-gray-200 overflow-auto">
            <style>{`
              .json-viewer-container .react-json-pretty {
                background-color: #fff !important;
                color: #1e293b !important;
                font-size: 13px;
                line-height: 1.6;
                word-break: break-word;
                white-space: pre-wrap;
                overflow-wrap: break-word;
              }
              .json-viewer-container .react-json-pretty .react-json-pretty-key {
                color: #2563eb !important;
              }
              .json-viewer-container .react-json-pretty .react-json-pretty-string {
                color: #059669 !important;
                white-space: pre-wrap !important;
                word-break: break-word !important;
              }
              .json-viewer-container .react-json-pretty .react-json-pretty-boolean {
                color: #dc2626 !important;
              }
              .json-viewer-container .react-json-pretty .react-json-pretty-number {
                color: #7c3aed !important;
              }
            `}</style>
          <ReactJsonPretty
              data={jsonData}
              theme={customTheme}
          />
          </div>
        );
      }

      return <MarkdownRenderer markDownContent={markDownContent} />;
    };

    return renderContent();
  }, [
    taskItem,
    msgTypes,
    markDownContent,
    htmlUrl,
    downloadHtmlUrl,
    allowShowToolBar,
    resultMap?.isFinal,
    toolResult?.toolResult,
    fileInfo,
    codeOutput,
  ]);

  const ref = useRef<HTMLDivElement>(null);

  const scrollToBottom = useMemoizedFn(() => {
    setTimeout(() => {
      ref.current?.scrollTo({
        top: ref.current!.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  });

  return <PanelProvider value={{
    wrapRef: ref,
    scrollToBottom,
  }}>
    <div
      className={classNames('w-full px-16', className)}
      ref={ref}
    >
      { panelNode }
    </div>
  </PanelProvider>;
});

ActionPanel.displayName = 'ActionPanel';

export default ActionPanel;
