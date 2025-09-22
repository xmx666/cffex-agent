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

# 检查是否在容器内
check_container() {
    if [ ! -f /.dockerenv ]; then
        print_error "此脚本需要在Docker容器内运行"
        print_info "请使用: docker exec -it genie-complete bash"
        exit 1
    fi
    print_success "检测到Docker容器环境"
}

# 编译Java代码
compile_java() {
    print_info "开始编译Java代码..."
    
    cd /app/genie-backend
    
    # 清理之前的构建
    print_info "清理之前的构建..."
    mvn clean
    
    # 编译（跳过测试）
    print_info "编译Java代码（跳过测试）..."
    mvn compile -DskipTests
    
    if [ $? -eq 0 ]; then
        print_success "Java代码编译成功！"
    else
        print_error "Java代码编译失败！"
        exit 1
    fi
}

# 打包Java应用
package_java() {
    local skip_tests=${1:-true}
    
    print_info "开始打包Java应用..."
    
    cd /app/genie-backend
    
    # 清理之前的构建
    print_info "清理之前的构建..."
    mvn clean
    
    if [ "$skip_tests" = "true" ]; then
        print_info "打包Java应用（跳过测试）..."
        mvn package -DskipTests
    else
        print_info "打包Java应用（包含测试）..."
        mvn package
    fi
    
    if [ $? -eq 0 ]; then
        print_success "Java应用打包成功！"
        print_info "JAR文件位置: /app/genie-backend/target/"
        ls -la /app/genie-backend/target/*.jar 2>/dev/null || print_warning "未找到JAR文件"
    else
        print_error "Java应用打包失败！"
        exit 1
    fi
}

# 编译前端代码
compile_frontend() {
    print_info "开始编译前端代码..."
    
    cd /app/ui
    
    # 安装依赖
    print_info "安装前端依赖..."
    pnpm install
    
    # 构建生产版本
    print_info "构建前端生产版本..."
    pnpm build
    
    if [ $? -eq 0 ]; then
        print_success "前端代码编译成功！"
        print_info "构建文件位置: /app/ui/dist/"
    else
        print_error "前端代码编译失败！"
        exit 1
    fi
}

# 重启服务
restart_services() {
    print_info "重启服务..."
    
    # 停止当前服务
    print_info "停止当前服务..."
    pkill -f "java.*genie" || true
    pkill -f "python.*genie" || true
    
    # 等待服务停止
    sleep 2
    
    # 启动服务
    print_info "启动服务..."
    cd /app
    nohup ./Genie_start.sh > /app/logs/startup.log 2>&1 &
    
    print_success "服务重启完成！"
    print_info "查看启动日志: tail -f /app/logs/startup.log"
}

# 查看服务状态
check_status() {
    print_info "检查服务状态..."
    
    echo "=== Java进程 ==="
    ps aux | grep "java.*genie" | grep -v grep || echo "未找到Java进程"
    
    echo ""
    echo "=== Python进程 ==="
    ps aux | grep "python.*genie" | grep -v grep || echo "未找到Python进程"
    
    echo ""
    echo "=== 端口占用 ==="
    netstat -tlnp | grep -E ":(3000|8080|1601|8188)" || echo "未找到相关端口"
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [命令]"
    echo ""
    echo "可用命令:"
    echo "  compile        编译Java代码（跳过测试）"
    echo "  package [skip] 打包Java应用 (skip: true/false, 默认: true)"
    echo "  frontend       编译前端代码"
    echo "  restart        重启所有服务"
    echo "  status         查看服务状态"
    echo "  help           显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 compile              # 编译Java代码"
    echo "  $0 package              # 打包Java应用（跳过测试）"
    echo "  $0 package false        # 打包Java应用（包含测试）"
    echo "  $0 frontend             # 编译前端代码"
    echo "  $0 restart              # 重启服务"
    echo "  $0 status               # 查看服务状态"
}

# 主函数
main() {
    check_container
    
    case "${1:-help}" in
        "compile")
            compile_java
            ;;
        "package")
            package_java "$2"
            ;;
        "frontend")
            compile_frontend
            ;;
        "restart")
            restart_services
            ;;
        "status")
            check_status
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@" 