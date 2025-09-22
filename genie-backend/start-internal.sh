#!/bin/bash

# 内网环境启动脚本
# 使用方法: ./start-internal.sh

echo "=========================================="
echo "启动JoyAgent-JDGenie内网环境"
echo "=========================================="

# 设置内网环境变量
export SPRING_PROFILES_ACTIVE=internal
export JAVA_OPTS="-Xmx4g -Xms2g -Dfile.encoding=UTF-8"

# 检查Java环境
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java环境，请先安装JDK 8+"
    exit 1
fi

# 检查Maven环境
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误: 未找到Maven环境，请先安装Maven"
    exit 1
fi

# 检查内网服务连通性
echo "🔍 检查内网服务连通性..."

# 检查内网LLM服务
INTERNAL_LLM_URL="http://internal-llm-service:8080/health"
if curl -s --connect-timeout 5 "$INTERNAL_LLM_URL" > /dev/null; then
    echo "✅ 内网LLM服务连接正常"
else
    echo "⚠️  警告: 内网LLM服务连接失败，请检查服务状态"
fi

# 检查内网TTS服务
INTERNAL_TTS_URL="http://aihub.cffex.com.cn/gateway/health"
if curl -s --connect-timeout 5 "$INTERNAL_TTS_URL" > /dev/null; then
    echo "✅ 内网TTS服务连接正常"
else
    echo "⚠️  警告: 内网TTS服务连接失败，请检查服务状态"
fi

# 检查内网数据库 - 项目不使用数据库，此检查可选
# INTERNAL_DB_HOST="internal-db"
# INTERNAL_DB_PORT="3306"
# if nc -z "$INTERNAL_DB_HOST" "$INTERNAL_DB_PORT" 2>/dev/null; then
#     echo "✅ 内网数据库连接正常"
# else
#     echo "⚠️  警告: 内网数据库连接失败，请检查服务状态"
# fi
echo "ℹ️  项目不使用数据库，跳过数据库连接检查"

# 创建必要目录
echo "📁 创建必要目录..."
mkdir -p logs
mkdir -p workspace/audio
mkdir -p workspace/reports
mkdir -p workspace/files

# 设置目录权限
chmod 755 workspace
chmod 755 workspace/audio
chmod 755 workspace/reports
chmod 755 workspace/files

# 编译项目
echo "🔨 编译项目..."
if mvn clean compile -q; then
    echo "✅ 项目编译成功"
else
    echo "❌ 项目编译失败"
    exit 1
fi

# 启动应用
echo "🚀 启动内网环境应用..."
echo "使用配置文件: application-internal.yml"
echo "使用环境变量: SPRING_PROFILES_ACTIVE=internal"
echo "Java内存配置: $JAVA_OPTS"
echo "=========================================="

# 启动Spring Boot应用
nohup mvn spring-boot:run -Dspring-boot.run.profiles=internal > logs/genie-internal.log 2>&1 &

# 获取进程ID
PID=$!
echo "应用已启动，进程ID: $PID"
echo "日志文件: logs/genie-internal.log"
echo "=========================================="

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 10

# 检查应用状态
if curl -s http://localhost:8080/actuator/health > /dev/null; then
    echo "✅ 应用启动成功！"
    echo "访问地址: http://localhost:8080"
    echo "健康检查: http://localhost:8080/actuator/health"
else
    echo "❌ 应用启动失败，请检查日志文件"
    echo "日志文件: logs/genie-internal.log"
    exit 1
fi

echo "=========================================="
echo "内网环境启动完成！"
echo "==========================================" 