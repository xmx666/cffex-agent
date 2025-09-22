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

# 检查Docker是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker未运行，请先启动Docker"
        exit 1
    fi
    print_success "Docker运行正常"
}

# 创建必要的目录
create_directories() {
    print_info "创建必要的目录..."
    mkdir -p config logs cache temp
    print_success "目录创建完成"
}

# 构建镜像
build_image() {
    print_info "开始构建Docker镜像..."
    print_warning "预计构建时间：20-40分钟（取决于系统性能）"
    
    docker build -f Dockerfile.complete -t genie-complete:latest .
    
    if [ $? -eq 0 ]; then
        print_success "镜像构建成功！"
    else
        print_error "镜像构建失败！"
        exit 1
    fi
}

# 启动开发环境
start_dev() {
    print_info "启动开发环境..."
    docker-compose -f docker-compose.complete.yml up -d
    
    if [ $? -eq 0 ]; then
        print_success "开发环境启动成功！"
        print_info "容器名称: genie-complete"
        print_info "端口映射:"
        echo "  - UI: http://localhost:3000"
        echo "  - 后端: http://localhost:8080"
        echo "  - 工具: http://localhost:1601"
        echo "  - 其他: http://localhost:8188"
    else
        print_error "开发环境启动失败！"
        exit 1
    fi
}

# 启动生产环境
start_prod() {
    print_info "启动生产环境..."
    docker-compose -f docker-compose.prod.yml up -d
    
    if [ $? -eq 0 ]; then
        print_success "生产环境启动成功！"
        print_info "容器名称: genie-prod"
        print_info "端口映射:"
        echo "  - UI: http://localhost:3000"
        echo "  - 后端: http://localhost:8080"
        echo "  - 工具: http://localhost:1601"
        echo "  - 其他: http://localhost:8188"
    else
        print_error "生产环境启动失败！"
        exit 1
    fi
}

# 进入容器
enter_container() {
    local container_name=${1:-genie-complete}
    print_info "进入容器: $container_name"
    docker exec -it $container_name bash
}

# 查看日志
view_logs() {
    local container_name=${1:-genie-complete}
    print_info "查看容器日志: $container_name"
    docker logs -f $container_name
}

# 停止服务
stop_services() {
    print_info "停止所有服务..."
    docker-compose -f docker-compose.complete.yml down
    docker-compose -f docker-compose.prod.yml down
    print_success "所有服务已停止"
}

# 清理资源
cleanup() {
    print_info "清理Docker资源..."
    docker system prune -f
    print_success "清理完成"
}

# 导出镜像
export_image() {
    local image_name=${1:-genie-complete:latest}
    local output_file=${2:-genie-complete-offline.tar}
    
    print_info "导出镜像: $image_name -> $output_file"
    docker save -o $output_file $image_name
    
    if [ $? -eq 0 ]; then
        print_success "镜像导出成功: $output_file"
        print_info "文件大小: $(du -h $output_file | cut -f1)"
    else
        print_error "镜像导出失败！"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [命令]"
    echo ""
    echo "可用命令:"
    echo "  build          构建Docker镜像"
    echo "  dev            启动开发环境"
    echo "  prod           启动生产环境"
    echo "  enter [name]   进入容器 (默认: genie-complete)"
    echo "  logs [name]    查看容器日志 (默认: genie-complete)"
    echo "  stop           停止所有服务"
    echo "  cleanup        清理Docker资源"
    echo "  export [name] [file] 导出镜像"
    echo "  help           显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 build                    # 构建镜像"
    echo "  $0 dev                      # 启动开发环境"
    echo "  $0 enter                    # 进入开发容器"
    echo "  $0 export                   # 导出镜像"
    echo "  $0 export genie-complete:latest my-image.tar"
}

# 主函数
main() {
    case "${1:-help}" in
        "build")
            check_docker
            create_directories
            build_image
            ;;
        "dev")
            check_docker
            create_directories
            start_dev
            ;;
        "prod")
            check_docker
            create_directories
            start_prod
            ;;
        "enter")
            enter_container "$2"
            ;;
        "logs")
            view_logs "$2"
            ;;
        "stop")
            stop_services
            ;;
        "cleanup")
            cleanup
            ;;
        "export")
            export_image "$2" "$3"
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@" 