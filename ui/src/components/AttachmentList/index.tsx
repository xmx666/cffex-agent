import { iconType } from "@/utils/constants";
import docxIcon from "@/assets/icon/docx.png";
import { Tooltip } from "antd";

type Props = {
  files: CHAT.TFile[];
  preview?: boolean;
  remove?: (index: number) => void;
  review?: (file: CHAT.TFile) => void;
};

/**
 * 检查是否为音频文件
 * @param fileName 文件名
 * @returns 是否为音频文件
 */
const isAudioFile = (fileName: string): boolean => {
  const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'];
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension ? audioExtensions.includes(extension) : false;
};

const GeneralInput: GenieType.FC<Props> = (props) => {
  const { files, preview, remove, review } = props;

  const formatSize = (size: number) => {
    const units = ["B", "KB", "MB", "GB"];
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size?.toFixed(2)} ${units[unitIndex]}`;
  };

  const combinIcon = (f: CHAT.TFile) => {
    const imgType = ["jpg", "png", "jpeg"];
    if (imgType.includes(f.type)) {
      return f.url;
    } else {
      return iconType[f.type] || docxIcon;
    }
  };

  const removeFile = (index: number) => {
    remove?.(index);
  };

  const reviewFile = (f: CHAT.TFile) => {
    // 如果是音频文件，不进行预览，只显示信息
    if (isAudioFile(f.name)) {
      return;
    }
    review?.(f);
  };

  const renderFile = (f: CHAT.TFile, index: number) => {
    const isAudio = isAudioFile(f.name);

    return (
      <div
        key={index}
        className={`group w-200 h-56 rounded-xl border border-[#E9E9F0] p-[8px] box-border flex items-center relative ${preview && !isAudio ? "cursor-pointer" : "cursor-default"}`}
        onClick={() => reviewFile(f)}
      >
        <img src={combinIcon(f)} alt={f.name} className="w-32 h-32 shrink" />
        <div className="flex-1 ml-[4px] overflow-hidden">
          <Tooltip title={f.name}>
            <div className="w-full overflow-hidden whitespace-nowrap text-ellipsis text-[14px] text-[#27272A] leading-[20px]">
              {f.name}
            </div>
          </Tooltip>
          <div className="w-full text-[12px] text-[#9E9FA3] leading-[18px]">
            {formatSize(f.size)}
          </div>
          {isAudio && (
            <div className="w-full text-[10px] text-[#FF6B6B] leading-[14px] mt-1">
              🎵 音频文件，不支持预览
            </div>
          )}
        </div>
        {!preview ? (
          <i
            className="font_family icon-jia-1 absolute top-[10px] right-[8px] cursor-pointer hidden group-hover:block"
            onClick={() => removeFile(index)}
          ></i>
        ) : null}
      </div>
    );
  };

  return (
    <div className="w-full flex gap-8 flex-wrap">
      {files.map((f, index) => renderFile(f, index))}
    </div>
  );
};

export default GeneralInput;
