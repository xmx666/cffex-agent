# Slogn 组件使用说明

## 概述
Slogn 组件现在支持两种显示模式：
1. **图片模式**：显示静态图片
2. **动画模式**：显示 Lottie 动画（原始功能）

## 配置方式

### 切换到图片模式
在 `ui/src/components/Slogn/index.tsx` 文件中：

```typescript
// 设置为 true 使用图片，false 使用动画
const USE_IMAGE_MODE = true;
```

### 切换到动画模式（回溯）
```typescript
// 设置为 true 使用图片，false 使用动画
const USE_IMAGE_MODE = false;
```

## 图片配置

### 图片路径
当前图片路径配置：
```typescript
const GENIE_IMAGE_PATH = '/src/components/Slogn/genie.png';
```

### 添加您的图片
1. 将您的图片文件命名为 `genie.png`
2. 将图片放置在 `ui/src/components/Slogn/` 目录下
3. 确保图片尺寸适合显示（建议 200x68 像素或相同比例）

### 图片要求
- **格式**：PNG、JPG、SVG 等常见格式
- **尺寸**：建议 200x68 像素（与动画尺寸一致）
- **文件大小**：建议小于 100KB 以确保加载速度

## 错误处理

如果图片加载失败，组件会：
1. 在控制台输出警告信息
2. 显示破损图片图标
3. 不会影响页面其他功能

## 回溯机制

如果需要恢复到原始动画模式：
1. 将 `USE_IMAGE_MODE` 设置为 `false`
2. 保存文件
3. 刷新页面即可看到原始动画效果

## 文件结构
```
ui/src/components/Slogn/
├── index.tsx          # 主组件文件
├── animation.ts       # 原始动画数据（保留用于回溯）
├── genie.png         # 您的图片文件（需要添加）
└── README.md         # 本说明文档
```

## 注意事项
- 修改配置后需要刷新页面才能看到效果
- 图片路径使用绝对路径，确保在构建后能正确访问
- 建议在开发环境中先测试图片显示效果
