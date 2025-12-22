import Lottie from 'react-lottie';
import { animationData } from './animation';

// 配置：设置为 true 使用图片，false 使用动画
const USE_IMAGE_MODE = true;

// 本地图片路径 - 请将您的图片放在此路径
const GENIE_IMAGE_PATH = '/src/components/Slogn/genie.png';

const Slogn: GenieType.FC = () => {
  // 如果使用图片模式
  if (USE_IMAGE_MODE) {
    return (
      <div className='mb-54'>
        <img 
          src={GENIE_IMAGE_PATH} 
          alt="Genie" 
          height={68}
          width={200}
          className="genie-image"
          onError={() => {
            console.warn('图片加载失败，请检查图片路径:', GENIE_IMAGE_PATH);
            // 可以在这里添加错误处理逻辑
          }}
        />
      </div>
    );
  }

  // 原始动画模式（回溯机制）
  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
      className: 'lottie'
    },
  };
  
  return (
    <div className='mb-54'>
      <Lottie options={defaultOptions}
        height={68}
        width={200}
      />
    </div>
  );
};

export default Slogn;
