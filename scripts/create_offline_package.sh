#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 获取当前时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
PACKAGE_NAME="genie-offline-complete-${TIMESTAMP}"

# 创建离线包
create_offline_package() {
    print_info "开始创建离线包: $PACKAGE_NAME"
    
    # 创建包目录
    mkdir -p "$PACKAGE_NAME"
    cd "$PACKAGE_NAME"
    
    # 创建子目录
    mkdir -p {docker,scripts,config,docs}
    
    print_info "复制Docker相关文件..."
    cd docker
    cp ../../Dockerfile.complete .
    cp ../../docker-compose.complete.yml .
    cp ../../docker-compose.prod.yml .
    cd ..
    
    print_info "复制脚本文件..."
    cd scripts
    cp ../../scripts/*.sh .
    chmod +x *.sh
    cd ..
    
    print_info "复制配置文件..."
    cd config
    cp ../../config/* .
    cd ..
    
    print_info "复制项目源码..."
    cp -r ../../genie-backend .
    cp -r ../../genie-tool .
    cp -r ../../genie-client .
    cp -r ../../ui .
    cp ../../Genie_start.sh .
    cp ../../check_dep_port.sh .
    chmod +x *.sh
    
    print_info "创建部署说明文档..."
    create_deployment_docs
    
    print_info "创建快速启动脚本..."
    create_quick_start_script
    
    print_info "创建README文档..."
    create_readme
    
    cd ..
    
    print_success "离线包创建完成: $PACKAGE_NAME"
    print_info "包大小: $(du -sh "$PACKAGE_NAME" | cut -f1)"
}

# 创建部署说明文档
create_deployment_docs() {
    cat > DEPLOYMENT.md << 'EOF'
# Genie 离线部署指南

## 🚀 快速开始

### 1. 环境要求
- Linux 系统 (推荐 Ubuntu 20.04+)
- Docker 20.10+
- Docker Compose 2.0+
- 至少 8GB 内存
- 至少 20GB 磁盘空间

### 2. 导入镜像
```bash
# 如果有镜像文件，先导入
docker load -i genie-complete-offline.tar
```

### 3. 启动服务

#### 开发环境（支持源码修改）
```bash
# 启动开发环境
docker-compose -f docker/docker-compose.complete.yml up -d

# 进入容器
docker exec -it genie-complete bash

# 在容器内编译代码
./scripts/quick_compile.sh compile
./scripts/quick_compile.sh package
```

#### 生产环境（只修改配置）
```bash
# 启动生产环境
docker-compose -f docker/docker-compose.prod.yml up -d

# 修改配置
./scripts/update_config.sh interactive
./scripts/update_config.sh apply genie-prod
```

## ⚙️ 配置修改

### LLM配置
```bash
# 修改API地址和模型
./scripts/update_config.sh llm "https://your-api.com/v1" "your-api-key" "your-model-name"

# 应用配置到容器
./scripts/update_config.sh apply genie-complete
```

### 播客音频配置
```bash
# 修改音频生成地址
./scripts/update_config.sh podcast "https://your-podcast-api.com" "your-api-key"

# 应用配置到容器
./scripts/update_config.sh apply genie-complete
```

### 深度搜索配置
```bash
# 修改搜索服务地址
./scripts/update_config.sh search "http://your-search-service:1601" "10"

# 应用配置到容器
./scripts/update_config.sh apply genie-complete
```

## 🔧 开发工作流

### 1. 修改源码
- 开发环境：直接修改挂载的源码文件
- 生产环境：使用 `docker cp` 复制文件到容器

### 2. 编译代码
```bash
# 进入容器
docker exec -it genie-complete bash

# 编译Java代码
./scripts/quick_compile.sh compile

# 打包应用
./scripts/quick_compile.sh package

# 重启服务
./scripts/quick_compile.sh restart
```

### 3. 查看状态
```bash
# 查看服务状态
./scripts/quick_compile.sh status

# 查看日志
docker logs -f genie-complete
```

## 📁 目录结构
```
genie-offline-complete-YYYYMMDD_HHMMSS/
├── docker/                    # Docker相关文件
│   ├── Dockerfile.complete
│   ├── docker-compose.complete.yml
│   └── docker-compose.prod.yml
├── scripts/                   # 管理脚本
│   ├── build_and_run.sh
│   ├── quick_compile.sh
│   └── update_config.sh
├── config/                    # 配置文件
│   ├── application.yml
│   └── env.template
├── genie-backend/            # Java后端源码
├── genie-tool/               # Python工具源码
├── genie-client/             # 客户端源码
├── ui/                       # 前端源码
├── Genie_start.sh            # 启动脚本
├── check_dep_port.sh         # 依赖检查脚本
├── DEPLOYMENT.md             # 部署说明
├── quick_start.sh            # 快速启动脚本
└── README.md                 # 项目说明
```

## 🆘 故障排除

### 常见问题
1. **端口冲突**: 检查3000, 8080, 1601, 8188端口是否被占用
2. **内存不足**: 确保系统有足够内存运行Docker容器
3. **权限问题**: 确保脚本有执行权限 `chmod +x scripts/*.sh`

### 日志查看
```bash
# 查看容器日志
docker logs -f genie-complete

# 查看应用日志
docker exec genie-complete tail -f /app/logs/*.log
```

### 重启服务
```bash
# 重启容器
docker restart genie-complete

# 重启应用服务
docker exec genie-complete ./scripts/quick_compile.sh restart
```

## 📞 技术支持
如有问题，请查看日志文件或联系技术支持团队。
EOF
}

# 创建快速启动脚本
create_quick_start_script() {
    cat > quick_start.sh << 'EOF'
#!/bin/bash

echo "🚀 Genie 快速启动脚本"
echo "========================"

# 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

echo "✅ Docker检查通过"

# 创建必要目录
mkdir -p logs cache temp

# 选择启动模式
echo ""
echo "请选择启动模式:"
echo "1) 开发环境 (支持源码修改)"
echo "2) 生产环境 (只修改配置)"
echo "3) 查看帮助"
read -p "请输入选择 (1-3): " choice

case $choice in
    1)
        echo "🚀 启动开发环境..."
        docker-compose -f docker/docker-compose.complete.yml up -d
        echo "✅ 开发环境启动完成"
        echo "🌐 访问地址:"
        echo "  - UI: http://localhost:3000"
        echo "  - 后端: http://localhost:8080"
        echo "  - 工具: http://localhost:1601"
        echo ""
        echo "💡 进入容器: docker exec -it genie-complete bash"
        echo "💡 修改配置: ./scripts/update_config.sh interactive"
        ;;
    2)
        echo "🚀 启动生产环境..."
        docker-compose -f docker/docker-compose.prod.yml up -d
        echo "✅ 生产环境启动完成"
        echo "🌐 访问地址:"
        echo "  - UI: http://localhost:3000"
        echo "  - 后端: http://localhost:8080"
        echo "  - 工具: http://localhost:1601"
        echo ""
        echo "💡 修改配置: ./scripts/update_config.sh interactive"
        ;;
    3)
        echo ""
        echo "📖 帮助信息:"
        echo "  - 部署说明: cat DEPLOYMENT.md"
        echo "  - 配置修改: ./scripts/update_config.sh help"
        echo "  - 编译代码: ./scripts/quick_compile.sh help"
        echo "  - 查看日志: docker logs -f genie-complete"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac
EOF

    chmod +x quick_start.sh
}

# 创建README文档
create_readme() {
    cat > README.md << 'EOF'
# Genie 离线部署包

## 📦 包信息
- **包名称**: genie-offline-complete
- **创建时间**: $(date)
- **版本**: 1.0.0
- **架构**: Linux x86_64

## 🎯 功能特性
- ✅ 完整的离线部署环境
- ✅ 支持源码修改和重新编译
- ✅ 灵活的配置管理
- ✅ 开发和生产环境支持
- ✅ 一键启动和配置

## 🚀 快速开始
```bash
# 1. 解压包
tar -xzf genie-offline-complete-*.tar.gz
cd genie-offline-complete-*

# 2. 快速启动
./quick_start.sh

# 3. 修改配置
./scripts/update_config.sh interactive
```

## 📚 详细文档
- [部署指南](DEPLOYMENT.md) - 完整的部署和配置说明
- [脚本帮助](scripts/) - 各种管理脚本的使用方法

## 🔧 主要脚本
- `quick_start.sh` - 快速启动脚本
- `scripts/build_and_run.sh` - 构建和运行管理
- `scripts/quick_compile.sh` - 代码编译和重启
- `scripts/update_config.sh` - 配置更新管理

## 🌐 服务端口
- **3000** - 前端UI
- **8080** - 后端API
- **1601** - 工具服务
- **8188** - 其他服务

## 📞 支持
如有问题，请查看 `DEPLOYMENT.md` 或联系技术支持团队。
EOF
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -n, --name     指定包名称"
    echo ""
    echo "示例:"
    echo "  $0                    # 使用默认名称创建包"
    echo "  $0 -n my-genie-pkg   # 使用指定名称创建包"
}

# 主函数
main() {
    case "${1:-}" in
        "-h"|"--help")
            show_help
            exit 0
            ;;
        "-n"|"--name")
            if [ -n "$2" ]; then
                PACKAGE_NAME="$2"
                shift 2
            else
                print_error "选项 -n/--name 需要参数"
                exit 1
            fi
            ;;
    esac
    
    create_offline_package
}

# 执行主函数
main "$@" 