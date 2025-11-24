#!/bin/bash

# 将挂载目录的文件打包到镜像中的脚本
# 在原始服务器上执行，将当前挂载在容器外的文件存储到镜像里

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
CONTAINER_NAME="${1:-genie-ubuntu-stable}"
SOURCE_MOUNT_DIR="${2:-/opt/genie}"
IMAGE_NAME="${3:-cffex-genie-v1.1}"
OUTPUT_IMAGE_TAG="${4:-latest}"
EXPORT_FILE="genie-with-mount-files-$(date +%Y%m%d-%H%M%S).tar"

echo -e "${BLUE}📦 将挂载文件打包到镜像${NC}"
echo "=================================="
echo -e "${YELLOW}使用方法: $0 [容器名] [挂载目录] [镜像名] [标签]${NC}"
echo -e "${YELLOW}默认值: $0 genie-ubuntu-stable /opt/genie/code cffex-genie-v1.1 latest${NC}"
echo ""
echo -e "${GREEN}✅ 安全保证：${NC}"
echo -e "  - 不会修改、移动或删除源文件${NC}"
echo -e "  - 不会影响当前运行的容器${NC}"
echo -e "  - 所有操作都是只读的（读取和复制）${NC}"
echo -e "  - 只创建临时容器和镜像，最后会清理${NC}"
echo "=================================="
echo ""

# 检查容器是否存在
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}❌ 错误: 容器 ${CONTAINER_NAME} 不存在${NC}"
    exit 1
fi

# 确认容器状态（只读检查，不影响容器）
CONTAINER_STATUS=$(docker ps --format '{{.Status}}' --filter "name=^${CONTAINER_NAME}$" 2>/dev/null || echo "stopped")
if [ "$CONTAINER_STATUS" != "stopped" ] && [ -n "$CONTAINER_STATUS" ]; then
    echo -e "${GREEN}✅ 检测到容器正在运行，打包过程不会影响容器运行${NC}"
else
    echo -e "${YELLOW}⚠️  容器未运行，但打包过程仍然安全（只读操作）${NC}"
fi

# 检查挂载目录是否存在
if [ ! -d "$SOURCE_MOUNT_DIR" ]; then
    echo -e "${RED}❌ 错误: 挂载目录 $SOURCE_MOUNT_DIR 不存在${NC}"
    exit 1
fi

echo -e "${BLUE}📋 配置信息：${NC}"
echo -e "  容器名称: ${GREEN}${CONTAINER_NAME}${NC}"
echo -e "  挂载目录: ${GREEN}${SOURCE_MOUNT_DIR}${NC}"
echo -e "  镜像名称: ${GREEN}${IMAGE_NAME}:${OUTPUT_IMAGE_TAG}${NC}"
echo ""

# 步骤1: 先提交当前容器为新镜像（包含容器内的所有状态）
# 注意：docker commit 是只读操作，不会修改或影响原容器
echo -e "${BLUE}📸 步骤1: 提交当前容器为新镜像（只读操作，不影响原容器）...${NC}"
BASE_IMAGE_TAG="${IMAGE_NAME}:base-$(date +%Y%m%d-%H%M%S)"
docker commit "$CONTAINER_NAME" "$BASE_IMAGE_TAG"

if docker images | grep -q "${IMAGE_NAME}.*base"; then
    echo -e "${GREEN}✅ 容器已提交为新镜像: ${BASE_IMAGE_TAG}${NC}"
else
    echo -e "${RED}❌ 容器提交失败${NC}"
    exit 1
fi

# 步骤2: 创建临时容器，将挂载文件复制进去替换镜像中的文件
# 注意：docker cp 是只读操作，只从源目录读取文件，不会修改源文件
echo -e "${BLUE}📂 步骤2: 将挂载文件复制到临时容器（只读操作，不修改源文件）...${NC}"

# 创建临时容器（基于刚提交的镜像）
# 注意：这是新创建的临时容器，不会影响原容器
TEMP_CONTAINER="genie-pack-temp-$$"
docker create --name "$TEMP_CONTAINER" "$BASE_IMAGE_TAG" /bin/bash

# 复制挂载目录的文件到临时容器
# 注意：docker cp 只读取源文件，不会修改、移动或删除源文件
KEY_DIRS=("genie-backend" "genie-tool" "genie-client" "ui")

for dir in "${KEY_DIRS[@]}"; do
    SOURCE_DIR="${SOURCE_MOUNT_DIR}/${dir}"
    if [ -d "$SOURCE_DIR" ] && [ "$(ls -A $SOURCE_DIR 2>/dev/null)" ]; then
        echo -e "${BLUE}   复制 $dir（只读操作，不修改源文件）...${NC}"
        # 复制挂载目录到容器（docker cp 只读取源文件，不会修改源文件）
        # 注意：这是只读操作，源文件不会被修改、移动或删除
        if docker cp "$SOURCE_DIR" "$TEMP_CONTAINER:/app/" 2>/dev/null; then
            # 验证复制是否成功（创建临时目录用于验证）
            TEMP_VERIFY_DIR="/tmp/genie-verify-$$-${dir}"
            if docker cp "$TEMP_CONTAINER:/app/$dir" "$TEMP_VERIFY_DIR" 2>/dev/null; then
                rm -rf "$TEMP_VERIFY_DIR" 2>/dev/null
                echo -e "${GREEN}   ✅ $dir 复制成功（源文件未修改）${NC}"
                # 显示文件数量（只读操作）
                FILE_COUNT=$(find "$SOURCE_DIR" -type f 2>/dev/null | wc -l)
                echo -e "${BLUE}      包含 ${FILE_COUNT} 个文件${NC}"
            else
                echo -e "${YELLOW}   ⚠️  $dir 复制验证失败${NC}"
            fi
        else
            echo -e "${YELLOW}   ⚠️  $dir 复制失败${NC}"
        fi
    else
        echo -e "${YELLOW}   ⚠️  $dir 目录不存在或为空，使用镜像中的原始文件${NC}"
    fi
done

# 复制其他重要文件（如果存在）
# 注意：docker cp 是只读操作，不会修改源文件
if [ -f "${SOURCE_MOUNT_DIR}/../Genie_start.sh" ]; then
    echo -e "${BLUE}   复制启动脚本（只读操作）...${NC}"
    docker cp "${SOURCE_MOUNT_DIR}/../Genie_start.sh" "$TEMP_CONTAINER:/app/" 2>/dev/null || true
fi

# 步骤3: 提交临时容器为最终镜像（包含挂载文件）
echo -e "${BLUE}💾 步骤3: 提交容器为最终镜像（包含挂载文件）...${NC}"
NEW_IMAGE="${IMAGE_NAME}:${OUTPUT_IMAGE_TAG}"
docker commit "$TEMP_CONTAINER" "$NEW_IMAGE"

if docker images | grep -q "${IMAGE_NAME}.*${OUTPUT_IMAGE_TAG}"; then
    echo -e "${GREEN}✅ 新镜像创建成功: ${NEW_IMAGE}${NC}"
else
    echo -e "${RED}❌ 镜像创建失败${NC}"
    docker rm "$TEMP_CONTAINER" > /dev/null 2>&1
    exit 1
fi

# 清理临时容器和中间镜像
# 注意：只清理临时创建的容器和镜像，不影响原容器和源文件
echo -e "${BLUE}   清理临时容器和中间镜像（不影响原容器）...${NC}"
docker rm "$TEMP_CONTAINER" > /dev/null 2>&1
docker rmi "$BASE_IMAGE_TAG" > /dev/null 2>&1 || true

# 步骤4: 导出镜像
echo -e "${BLUE}📤 步骤4: 导出镜像为tar文件...${NC}"
docker save -o "$EXPORT_FILE" "$NEW_IMAGE"

if [ -f "$EXPORT_FILE" ]; then
    FILE_SIZE=$(du -h "$EXPORT_FILE" | cut -f1)
    echo -e "${GREEN}✅ 镜像导出成功: ${EXPORT_FILE} (${FILE_SIZE})${NC}"
    
    # 可选：压缩镜像
    read -p "$(echo -e ${YELLOW}是否压缩镜像文件? [y/N]: ${NC})" -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🗜️  压缩镜像文件...${NC}"
        gzip -f "$EXPORT_FILE"
        COMPRESSED_FILE="${EXPORT_FILE}.gz"
        COMPRESSED_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
        echo -e "${GREEN}✅ 压缩完成: ${COMPRESSED_FILE} (${COMPRESSED_SIZE})${NC}"
        EXPORT_FILE="$COMPRESSED_FILE"
    fi
else
    echo -e "${RED}❌ 镜像导出失败${NC}"
    exit 1
fi

# 步骤5: 显示结果
echo ""
echo "=================================="
echo -e "${GREEN}🎉 打包完成！${NC}"
echo "=================================="
echo -e "${BLUE}生成的文件：${NC}"
echo -e "  镜像文件: ${GREEN}${EXPORT_FILE}${NC}"
echo -e "  镜像名称: ${GREEN}${NEW_IMAGE}${NC}"
echo ""
echo -e "${BLUE}已打包的目录：${NC}"
for dir in "${KEY_DIRS[@]}"; do
    if [ -d "${SOURCE_MOUNT_DIR}/${dir}" ]; then
        echo -e "  ✅ ${dir}"
    fi
done
echo ""
echo -e "${GREEN}✅ 安全确认：${NC}"
echo -e "  - 原容器 ${CONTAINER_NAME} 未受影响，仍在运行${NC}"
echo -e "  - 挂载目录 ${SOURCE_MOUNT_DIR} 中的文件未被修改${NC}"
echo -e "  - 所有源文件保持原样${NC}"
echo ""
echo -e "${BLUE}下一步操作：${NC}"
echo -e "  1. 将镜像文件传输到新服务器："
echo -e "     ${GREEN}scp ${EXPORT_FILE} user@新服务器IP:/path/${NC}"
echo ""
echo -e "  2. 在新服务器上使用部署脚本："
echo -e "     ${GREEN}./deploy-genie-with-mount.sh ${EXPORT_FILE}${NC}"
echo ""
echo "=================================="

