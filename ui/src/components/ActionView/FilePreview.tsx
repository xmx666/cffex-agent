import classNames from "classnames";
import { useEffect, useMemo, useState } from "react";
import ActionPanel, { PanelItemType, useMsgTypes } from "../ActionPanel";
import { useBoolean, useMemoizedFn } from "ahooks";
import { Modal, Slider, Collapse } from "antd";
import ActionViewFrame from "./ActionViewFrame";
import dayjs from "dayjs";
import ReactJsonPretty from "react-json-pretty";

const STEP_CLASS = 'flex items-center justify-center rounded-[4px] size-16 font_family icon-fanhui cursor-pointer hover:bg-gray-300';

const Title: GenieType.FC<{
  taskItem?: PanelItemType;
}> = (props) => {
  const { taskItem } = props;

  const [ overlay, { setFalse: closeOverlay, setTrue: openOverlay } ] = useBoolean(false);

  const title = useMemo(() => {
    if (!taskItem) {
      return '';
    }
    const { messageType, resultMap } = taskItem;
    if (messageType === 'tool_result') {
      return taskItem.toolResult?.toolName;
    }
    if (messageType === 'file' || messageType === 'html') {
      const [fileInfo] = resultMap?.fileInfo || [];
      return fileInfo?.fileName || messageType;
    }
    if (messageType === 'deep_search' && resultMap.messageType === 'report') {
      return resultMap?.query;
    }
    return messageType;
  }, [taskItem]);

  const { useHtml, useExcel } = useMsgTypes(taskItem) || {};

  return <>
    <div
      className={classNames(
        'h-34 w-full border-b-[#e9e9f0] border-b-1 border-solid pl-[16px] pr-[16px] flex items-center justify-center text-[12px] font-semibold',
        (useHtml || useExcel) ? 'hover:text-primary cursor-pointer' : ''
      )}
      onClick={(useHtml || useExcel) ? openOverlay : undefined}
    >
      {title}
    </div>
    <Modal
      destroyOnHidden
      open={overlay}
      onCancel={closeOverlay}
      footer={null} // 如果不需要底部按钮，可以设置为 null
      styles={{
        body: {
          height: '100vh',
          boxSizing: 'border-box'
        },
        content: {
          borderRadius: 0,
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          padding: 0,
        }
      }}
      className="top-0 m-0 h-[100vh] overflow-hidden max-w-[100vw] rounded-none"
      width="100vw" // 使 Modal 宽度为 100%
    >
      <ActionPanel className="flex-1 h-full" taskItem={taskItem} noPadding />;
    </Modal>
  </>;
};

const FilePreview: GenieType.FC<{
  /**
   * 文件信息
   */
  taskItem?: CHAT.Task;
  taskList?: PanelItemType[]
}> = (props) => {
  const { taskItem: defaultTaskItem, className, taskList: taskListProp } = props;

  const taskList = useMemo(() => {
    return taskListProp?.filter((item) => ![ 'task_summary', 'result' ].includes(item.messageType));
  }, [taskListProp]);

  const [curActiveTaskIndex, setCurActiveTaskIndex] = useState<number>();

  // 优先选择：手动选择的 > defaultTaskItem > taskList中最新的HTML/PPT任务 > taskList最后一个
  // 使用useMemo确保taskItem是响应式的，当taskList更新时自动更新
  const taskItem = useMemo(() => {
    let item: PanelItemType | undefined;
    
    if (typeof curActiveTaskIndex === 'number') {
      item = taskList?.[curActiveTaskIndex] || defaultTaskItem;
    } else {
      item = defaultTaskItem;
    }
    
    if (!item) {
      // 如果没有defaultTaskItem，优先查找最新的HTML或PPT任务
      const htmlOrPptTask = taskList?.slice().reverse().find(item => 
        item.messageType === 'html' || item.messageType === 'ppt'
      );
      item = htmlOrPptTask || taskList?.[taskList.length - 1];
    }
    
    return item;
  }, [curActiveTaskIndex, taskList, defaultTaskItem]);

  useEffect(() => {
    // 变化之后重新归为，选择的状态
    if (defaultTaskItem) {
      setCurActiveTaskIndex(undefined);
    }
  }, [defaultTaskItem]);

  // 在流式输出过程中，如果没有手动选择任务且没有defaultTaskItem，自动选择最新的HTML/PPT任务
  // 当taskList更新时，如果没有手动选择，总是选择最新的HTML/PPT任务（确保能看到最新的流式输出）
  useEffect(() => {
    if (!defaultTaskItem && taskList && taskList.length > 0) {
      // 如果没有手动选择（curActiveTaskIndex为undefined），自动选择最新的HTML/PPT任务
      if (typeof curActiveTaskIndex !== 'number') {
        const htmlOrPptTask = taskList.slice().reverse().find(item => 
          item.messageType === 'html' || item.messageType === 'ppt'
        );
        if (htmlOrPptTask) {
          const index = taskList.findIndex(item => item.id === htmlOrPptTask.id);
          if (index >= 0) {
            setCurActiveTaskIndex(index);
          }
        } else if (taskList.length > 0) {
          // 如果没有HTML/PPT任务，选择最后一个
          setCurActiveTaskIndex(taskList.length - 1);
        }
      }
      // 如果已经手动选择了任务，taskItem会通过useMemo自动更新（因为依赖了taskList）
    }
  }, [taskList, defaultTaskItem, curActiveTaskIndex]);

  const realActiveTaskIndex = useMemo(() => {
    const index = taskList?.findIndex((item) => item.id === taskItem?.id);
    return index || 0;
  }, [taskItem?.id, taskList]);

  const taskLength = taskList?.length || 0;

  const next = useMemoizedFn(() => {
    setCurActiveTaskIndex(Math.min(taskLength - 1, realActiveTaskIndex + 1));
  });

  const pre = useMemoizedFn(() => {
    setCurActiveTaskIndex(Math.max(0, realActiveTaskIndex - 1));
  });

  const slideMaxVal = taskLength - 1;

  // 获取当前任务的工具参数
  const toolParam = useMemo(() => {
    if (taskItem?.messageType === 'tool_result' && taskItem?.toolResult?.toolParam) {
      return taskItem.toolResult.toolParam;
    }
    return null;
  }, [taskItem]);

  const hasToolParam = toolParam && Object.keys(toolParam).length > 0;

  return (
    <ActionViewFrame
      className={classNames('h-full', className)}
    >
      <Title taskItem={taskItem} />
      {/* 工具输入参数显示区域 */}
      {hasToolParam && (
        <div className="border-b-[#e9e9f0] border-b-1 border-solid">
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: 'tool-input',
                label: <span className="text-[12px] text-gray-600">工具输入参数</span>,
                children: (
                  <div className="bg-white p-12 rounded border border-gray-100">
                    <style>{`
                      .tool-input-json .react-json-pretty {
                        background-color: #fff !important;
                        color: #1e293b !important;
                        font-size: 12px;
                        line-height: 1.5;
                        word-break: break-word;
                        white-space: pre-wrap;
                        overflow-wrap: break-word;
                      }
                      .tool-input-json .react-json-pretty .react-json-pretty-key {
                        color: #2563eb !important;
                      }
                      .tool-input-json .react-json-pretty .react-json-pretty-string {
                        color: #059669 !important;
                      }
                      .tool-input-json .react-json-pretty .react-json-pretty-boolean {
                        color: #dc2626 !important;
                      }
                      .tool-input-json .react-json-pretty .react-json-pretty-number {
                        color: #7c3aed !important;
                      }
                    `}</style>
                    <div className="tool-input-json">
                      <ReactJsonPretty
                        data={toolParam}
                        theme={{
                          main: '#fff',
                          error: '#ef4444',
                          key: '#2563eb',
                          string: '#059669',
                          value: '#1e293b',
                          boolean: '#dc2626',
                          number: '#7c3aed',
                        }}
                      />
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
      <ActionPanel className="flex-1 h-0 my-8 overflow-y-auto" taskItem={taskItem} allowShowToolBar />
      {!!taskLength && <div className="w-full border-t-[#e9e9f0] border-t-1 border-solid flex items-center h-[38px] px-16">
        <i className={STEP_CLASS} onClick={pre}></i>
        <i className={classNames(STEP_CLASS, 'rotate-180')} onClick={next}></i>
        <Slider
          className="flex-1 text-primary"
          styles={{ track: { background: '#4040FFB2' } }}
          step={1}
          onChange={setCurActiveTaskIndex}
          // slider 的value和max都为0的时候会显示在最左边，所以这里给个默认值1
          value={slideMaxVal ? realActiveTaskIndex : 1}
          min={0}
          max={slideMaxVal || 1}
          tooltip={{
            formatter: () => {
              const { messageTime } = taskList?.[realActiveTaskIndex] || {};
              return dayjs((+messageTime!)).format('YYYY-MM-DD HH:mm');
            },
          }}
        />
      </div>}
    </ActionViewFrame>
  );
};

export default FilePreview;