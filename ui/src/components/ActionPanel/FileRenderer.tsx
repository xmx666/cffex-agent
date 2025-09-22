import React, { useMemo } from "react";
import { useRequest } from "ahooks";
import { Alert, Button } from "antd";
import MarkdownRenderer from "./MarkdownRenderer";
import Loading from "./Loading";
import { DownloadOutlined } from "@ant-design/icons";

const LOADING_CLASS = 'mr-32';
const ERROR_CLASS = 'm-24';

interface FileRendererProps {
  /** 文件路径 */
  fileUrl: string;
  /** 文件名 */
  fileName?: string;
}

/**
 * 获取文件扩展名
 * @param fileName 文件名
 * @returns 小写的文件扩展名
 */
const getFileExtension = (fileName?: string): string | undefined => {
  return fileName?.split('.').pop()?.toLowerCase();
};

/**
 * 检查是否为音频文件
 * @param ext 文件扩展名
 * @returns 是否为音频文件
 */
const isAudioFile = (ext: string | undefined): boolean => {
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
  return ext ? audioExtensions.includes(ext) : false;
};

/**
 * 格式化文件内容
 * @param ext 文件扩展名
 * @param data 文件内容
 * @returns 格式化后的文件内容
 */
const formatFileContent = (ext: string | undefined, data: string | undefined): string => {
  if (ext === 'md' || ext === 'txt') {
    return data || '';
  }
  return `\`\`\`${ext}\n${data || ''}\n\`\`\``;
};

/**
 * 下载文件
 * @param url 文件URL
 * @param fileName 文件名
 */
const downloadFile = (url: string, fileName?: string) => {
  const link = document.createElement('a');
  link.href = url.replace('preview', 'download');
  link.download = fileName || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const FileRenderer: GenieType.FC<FileRendererProps> = React.memo((props) => {
  const { fileUrl, fileName, className } = props;

  const ext = useMemo(() => getFileExtension(fileName), [fileName]);
  const isAudio = useMemo(() => isAudioFile(ext), [ext]);

  // 如果是音频文件，直接显示下载界面，不加载文件内容
  if (isAudio) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-lg font-medium text-gray-700 mb-4">
          🎵 音频文件
        </div>
        <div className="text-sm text-gray-500 mb-6">
          {fileName}
        </div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => downloadFile(fileUrl, fileName)}
          size="large"
        >
          下载音频文件
        </Button>
        <div className="text-xs text-gray-400 mt-3">
          音频文件不支持在线预览，请下载后播放
        </div>
      </div>
    );
  }

  const { data, loading, error } = useRequest(async () => {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.text();
  }, { refreshDeps: [fileUrl] });

  const markStr = useMemo(() => formatFileContent(ext, data), [ext, data]);

  if (loading) {
    return <Loading className={LOADING_CLASS} />;
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="加载失败"
        description={error.message}
        showIcon
        className={ERROR_CLASS}
      />
    );
  }

  return <MarkdownRenderer markDownContent={markStr} className={className} />;
});

FileRenderer.displayName = 'FileRenderer';

export default FileRenderer;
