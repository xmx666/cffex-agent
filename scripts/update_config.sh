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

# 配置文件路径
CONFIG_DIR="./config"
ENV_FILE="$CONFIG_DIR/env.template"
APP_CONFIG="$CONFIG_DIR/application.yml"

# 检查配置文件是否存在
check_config_files() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error "环境变量文件不存在: $ENV_FILE"
        exit 1
    fi
    
    if [ ! -f "$APP_CONFIG" ]; then
        print_error "应用配置文件不存在: $APP_CONFIG"
        exit 1
    fi
    
    print_success "配置文件检查完成"
}

# 更新LLM配置
update_llm_config() {
    local base_url=${1:-"https://api.siliconflow.cn/v1"}
    local api_key=${2:-"sk-gnerfexlkohrjggyegfxwxtarftimtfllwoekftfvwcdujvj"}
    local model_name=${3:-"deepseek-ai/DeepSeek-R1"}
    
    print_info "更新LLM配置..."
    print_info "Base URL: $base_url"
    print_info "Model: $model_name"
    
    # 更新环境变量文件
    sed -i "s|CUSTOM_OPENAI_BASE_URL=.*|CUSTOM_OPENAI_BASE_URL=$base_url|g" "$ENV_FILE"
    sed -i "s|CUSTOM_OPENAI_API_KEY=.*|CUSTOM_OPENAI_API_KEY=$api_key|g" "$ENV_FILE"
    sed -i "s|CUSTOM_MODEL_NAME=.*|CUSTOM_MODEL_NAME=$model_name|g" "$ENV_FILE"
    
    # 更新应用配置文件
    sed -i "s|base_url: .*|base_url: $base_url|g" "$APP_CONFIG"
    sed -i "s|model: .*|model: $model_name|g" "$APP_CONFIG"
    
    print_success "LLM配置更新完成"
}

# 更新播客音频配置
update_podcast_config() {
    local base_url=${1:-"https://api.example.com/podcast"}
    local api_key=${2:-"your-podcast-api-key"}
    
    print_info "更新播客音频配置..."
    print_info "Base URL: $base_url"
    
    # 更新环境变量文件
    sed -i "s|PODCAST_AUDIO_BASE_URL=.*|PODCAST_AUDIO_BASE_URL=$base_url|g" "$ENV_FILE"
    sed -i "s|PODCAST_API_KEY=.*|PODCAST_API_KEY=$api_key|g" "$ENV_FILE"
    
    print_success "播客音频配置更新完成"
}

# 更新深度搜索配置
update_search_config() {
    local search_url=${1:-"http://localhost:1601"}
    local page_count=${2:-"5"}
    
    print_info "更新深度搜索配置..."
    print_info "Search URL: $search_url"
    print_info "Page Count: $page_count"
    
    # 更新环境变量文件
    sed -i "s|DEEP_SEARCH_URL=.*|DEEP_SEARCH_URL=$search_url|g" "$ENV_FILE"
    sed -i "s|DEEP_SEARCH_PAGE_COUNT=.*|DEEP_SEARCH_PAGE_COUNT=$page_count|g" "$ENV_FILE"
    
    print_success "深度搜索配置更新完成"
}

# 应用配置到容器
apply_config_to_container() {
    local container_name=${1:-"genie-complete"}
    
    print_info "应用配置到容器: $container_name"
    
    # 检查容器是否运行
    if ! docker ps | grep -q "$container_name"; then
        print_error "容器 $container_name 未运行"
        exit 1
    fi
    
    # 复制配置文件到容器
    print_info "复制配置文件到容器..."
    docker cp "$CONFIG_DIR/application.yml" "$container_name:/app/genie-backend/src/main/resources/"
    docker cp "$CONFIG_DIR/env.template" "$container_name:/app/genie-tool/.env"
    
    # 重启容器内的服务
    print_info "重启容器内服务..."
    docker exec "$container_name" bash -c "cd /app && ./Genie_start.sh > /app/logs/restart.log 2>&1 &"
    
    print_success "配置已应用到容器"
    print_info "查看重启日志: docker exec $container_name tail -f /app/logs/restart.log"
}

# 显示当前配置
show_current_config() {
    print_info "当前LLM配置:"
    echo "Base URL: $(grep 'CUSTOM_OPENAI_BASE_URL=' "$ENV_FILE" | cut -d'=' -f2)"
    echo "Model: $(grep 'CUSTOM_MODEL_NAME=' "$ENV_FILE" | cut -d'=' -f2)"
    
    echo ""
    print_info "当前播客配置:"
    echo "Base URL: $(grep 'PODCAST_AUDIO_BASE_URL=' "$ENV_FILE" | cut -d'=' -f2)"
    
    echo ""
    print_info "当前搜索配置:"
    echo "Search URL: $(grep 'DEEP_SEARCH_URL=' "$ENV_FILE" | cut -d'=' -f2)"
    echo "Page Count: $(grep 'DEEP_SEARCH_PAGE_COUNT=' "$ENV_FILE" | cut -d'=' -f2)"
}

# 交互式配置更新
interactive_config() {
    print_info "交互式配置更新..."
    
    echo ""
    read -p "请输入新的LLM Base URL (当前: $(grep 'CUSTOM_OPENAI_BASE_URL=' "$ENV_FILE" | cut -d'=' -f2)): " new_base_url
    if [ -n "$new_base_url" ]; then
        read -p "请输入新的API Key: " new_api_key
        read -p "请输入新的模型名称: " new_model_name
        
        update_llm_config "$new_base_url" "$new_api_key" "$new_model_name"
    fi
    
    echo ""
    read -p "请输入新的播客音频Base URL (当前: $(grep 'PODCAST_AUDIO_BASE_URL=' "$ENV_FILE" | cut -d'=' -f2)): " new_podcast_url
    if [ -n "$new_podcast_url" ]; then
        read -p "请输入新的播客API Key: " new_podcast_key
        
        update_podcast_config "$new_podcast_url" "$new_podcast_key"
    fi
    
    echo ""
    read -p "请输入新的深度搜索URL (当前: $(grep 'DEEP_SEARCH_URL=' "$ENV_FILE" | cut -d'=' -f2)): " new_search_url
    if [ -n "$new_search_url" ]; then
        read -p "请输入新的页面数量: " new_page_count
        
        update_search_config "$new_search_url" "$new_page_count"
    fi
    
    print_success "交互式配置更新完成"
}

# 显示帮助信息
show_help() {
    echo "使用方法: $0 [命令] [参数...]"
    echo ""
    echo "可用命令:"
    echo "  llm <base_url> <api_key> <model>    更新LLM配置"
    echo "  podcast <base_url> <api_key>        更新播客音频配置"
    echo "  search <url> <page_count>           更新深度搜索配置"
    echo "  apply [container_name]               应用配置到容器"
    echo "  show                                 显示当前配置"
    echo "  interactive                          交互式配置更新"
    echo "  help                                 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 llm https://api.example.com/v1 sk-key model-name"
    echo "  $0 podcast https://api.example.com/podcast sk-key"
    echo "  $0 search http://localhost:1601 10"
    echo "  $0 apply genie-complete"
    echo "  $0 interactive"
}

# 主函数
main() {
    check_config_files
    
    case "${1:-help}" in
        "llm")
            if [ $# -lt 4 ]; then
                print_error "LLM配置需要3个参数: base_url api_key model_name"
                exit 1
            fi
            update_llm_config "$2" "$3" "$4"
            ;;
        "podcast")
            if [ $# -lt 3 ]; then
                print_error "播客配置需要2个参数: base_url api_key"
                exit 1
            fi
            update_podcast_config "$2" "$3"
            ;;
        "search")
            if [ $# -lt 3 ]; then
                print_error "搜索配置需要2个参数: url page_count"
                exit 1
            fi
            update_search_config "$2" "$3"
            ;;
        "apply")
            apply_config_to_container "$2"
            ;;
        "show")
            show_current_config
            ;;
        "interactive")
            interactive_config
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@" 