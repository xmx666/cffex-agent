#!/bin/bash

echo "🚀 启动后端服务..."

# 检查Java和Maven
#if ! /usr/lib/jvm/java-17-openjdk-amd64/bin/java -version &> /dev/null; then
#    echo "Java未安装"
#    exit 1
#fi

#if ! command -v mvn &> /dev/null; then
#    echo "❌ Maven未安装"
#    exit 1
#fi

# 编译项目
echo "🔨 编译Java项目..."
mvn clean compile -DskipTests

# 启动Spring Boot应用
echo "🔧 启动Spring Boot应用..."
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Dserver.port=8080"
