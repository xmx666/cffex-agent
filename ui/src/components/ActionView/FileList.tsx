import { copyText, downloadFile, formatTimestamp, showMessage } from "@/utils";
import { keyBy } from "lodash";
import React, { useMemo, useState } from "react";
import ActionViewFrame from "./ActionViewFrame";
import classNames from "classnames";
import { FileRenderer, HTMLRenderer, PanelItemType, TableRenderer } from "../ActionPanel";
import { Empty, Tooltip } from "antd";
import { useBoolean, useMemoizedFn } from "ahooks";
import LoadingSpinner from "../LoadingSpinner";

type FileItem = {
  name: string;
  messageTime?: string;
  type: string;
  task: PanelItemType;
  url: string;
};

const messageTypeEnum = ['file', 'code', 'html', 'markdown', 'result'];

const FileList: GenieType.FC<{
  taskList?: PanelItemType[];
  activeFile?: CHAT.TFile;
  clearActiveFile?: () => void;
}> = (props) => {
  const { taskList, clearActiveFile, activeFile } = props;

  const [ activeItem, setActiveItem ] = useState<string | undefined>();
  const [ copying, { setFalse: stopCopying, setTrue: startCopying } ] = useBoolean(false);

  const clearActive = useMemoizedFn(() => {
    clearActiveFile?.();
    setActiveItem(undefined);
  });

  const {list: fileList, map: fileMap } = useMemo(() => {
    let map: Record<string, FileItem> = {};
    const list = (taskList || []).reduce<FileItem[]>((pre, task) => {
      const { resultMap } = task;
      if (messageTypeEnum.includes(task.messageType)) {
        const fileInfo: FileItem[] = (resultMap?.fileInfo ?? resultMap.fileList ?? []).map((item) => {
          const extension = item.fileName?.split('.')?.pop();
          return {
            ...item,
            name: item.fileName!,
            url: item.domainUrl!,
            task,
            messageTime: formatTimestamp(task.messageTime),
            type: extension!
          };
        });
        pre.push(...fileInfo.filter((item) => !map[item.name]));

        map = keyBy(pre, 'fileName');
      }
      return pre;
    }, []);
    return {
      list,
      map
    };
  }, [taskList]);
  // 当前选中的文件
  const fileItem = activeFile || (activeItem ? fileMap[activeItem] : undefined);
  const generateQuery = (name?: string, noHover?: boolean, click?: () => void) => {
    return <div className="flex-1 flex items-center w-0 h-full">
      <span
        className={classNames("cursor-pointer text-ellipsis whitespace-nowrap overflow-hidden", {'hover:font-medium': !noHover})}
        onClick={click || (() => setActiveItem(name))}
      >
        {name}
      </span>
    </div>;
  };

  let content: React.ReactNode = fileList.map((item) => (
    <div key={item.name} className="flex items-center pb-[16px]">
      <i className="font_family icon-rizhi mr-6"></i>
      {generateQuery(item.name)}
      <div className="text-[12px] text-[#8d8da5]">
        { item.messageTime}
      </div>
    </div>
  ));

  if (!fileList?.length) {
    content = <Empty />;
  }

  if (fileItem) {
    switch (fileItem.type) {
      case 'ppt':
      case 'html':
        // 确保URL存在才渲染
        if (fileItem.url) {
          content = <HTMLRenderer htmlUrl={fileItem.url} className="h-full" />;
        } else {
          content = <Empty description="文件URL不存在" className="mt-32" />;
        }
        break;
      case 'csv':
      case 'xlsx':
        content = <TableRenderer fileUrl={fileItem.url} fileName={fileItem.name} />;
        break;
      default:
        content = <FileRenderer fileUrl={fileItem.url} fileName={fileItem.name} />;
        break;
    }
  }

  const copy = useMemoizedFn(async () => {
    if (!fileItem?.url) {
      return;
    }
    startCopying();
    const response = await fetch(fileItem.url);
    if (!response.ok) {
      stopCopying();
      throw new Error('Network response was not ok');
    }
    let data = await response.text();

    // 如果是HTML文件，将相对路径转换为绝对路径，确保复制出来的HTML也能正常显示
    if (fileItem.type === 'html' || fileItem.type === 'ppt') {
      try {
        // 从fileItem.url中提取服务器的基础URL（protocol + host）
        const urlObj = new URL(fileItem.url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        
        // 将HTML中的相对路径（以/开头的路径）转换为绝对路径
        // 匹配 href="、src="、url( 等属性中的相对路径
        data = data.replace(
          /(href|src|url)\s*=\s*["'](\/[^"']+)["']/gi,
          (match, attr, path) => {
            // 如果路径已经是绝对路径（http://或https://开头），则不处理
            if (path.startsWith('http://') || path.startsWith('https://')) {
              return match;
            }
            // 将相对路径转换为绝对路径
            return `${attr}="${baseUrl}${path}"`;
          }
        );
        
        // 处理CSS中的url()相对路径
        data = data.replace(
          /url\s*\(\s*["']?(\/[^"')]+)["']?\s*\)/gi,
          (match, path) => {
            // 如果路径已经是绝对路径，则不处理
            if (path.startsWith('http://') || path.startsWith('https://')) {
              return match;
            }
            // 将相对路径转换为绝对路径
            return `url("${baseUrl}${path}")`;
          }
        );
      } catch (error) {
        console.warn('转换HTML路径时出错:', error);
        // 如果转换失败，使用原始数据
      }
    }

    copyText(data);
    stopCopying();
    showMessage()?.success('复制成功');
  });

  return <ActionViewFrame
    className="p-16 overflow-y-auto"
    titleNode={fileItem && <>
      {generateQuery(fileItem?.name, true, clearActive)}
      <div className="flex items-center">
        <Tooltip title="下载">
          <i
            className="font_family rounded-[4px] size-20 flex items-center justify-center icon-xiazai mr-6 cursor-pointer hover:bg-gray-200"
            onClick={() => downloadFile(fileItem?.url.replace('preview', 'download'), fileItem.name)}
          ></i>
        </Tooltip>
        {/* excel文件不支持复制 */}
        {!['xlsx', 'xls'].includes(fileItem.type) && <Tooltip title="复制" placement="top">
          {copying ? <LoadingSpinner /> : <i className="font_family rounded-[4px] size-20 flex items-center justify-center icon-fuzhi cursor-pointer hover:bg-gray-200" onClick={copy}></i>}
        </Tooltip>}
      </div>
    </>}
    onClickTitle={() => setActiveItem(undefined)}
  >
    {content}
  </ActionViewFrame>;
};

export default FileList;

