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
        return (
          <HTMLRenderer
            htmlUrl={htmlUrl}
            className="h-full"
            downloadUrl={downloadHtmlUrl}
            outputCode={codeOutput}
            showToolBar={allowShowToolBar && resultMap?.isFinal}
          />
        );
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
              }
              .json-viewer-container .react-json-pretty .react-json-pretty-boolean {
                color: #dc2626 !important;
              }
              .json-viewer-container .react-json-pretty .react-json-pretty-number {
                color: #7c3aed !important;
              }
            `}</style>
            <ReactJsonPretty
              data={JSON.parse(toolResult?.toolResult || '{}')}
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
