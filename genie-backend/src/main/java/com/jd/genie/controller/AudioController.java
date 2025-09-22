package com.jd.genie.controller;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 音频文件访问控制器
 * 专门处理音频文件的访问，避免被其他控制器拦截
 */
@Slf4j
@RestController
@RequestMapping("/api/audio")
public class AudioController {

    /**
     * 获取音频文件列表
     */
    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> getAudioFileList() {
        try {
            String workspacePath = getWorkspaceAudioDir();
            Path audioDir = Paths.get(workspacePath);

            if (!java.nio.file.Files.exists(audioDir)) {
                return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "files", new ArrayList<>(),
                    "message", "音频目录不存在"
                ));
            }

            List<Map<String, Object>> fileList = new ArrayList<>();
            try (var stream = java.nio.file.Files.list(audioDir)) {
                stream.filter(path -> {
                    String fileName = path.getFileName().toString().toLowerCase();
                    return fileName.endsWith(".mp3") || fileName.endsWith(".wav") || fileName.endsWith(".ogg");
                }).forEach(path -> {
                    try {
                        Map<String, Object> fileInfo = new HashMap<>();
                        fileInfo.put("filename", path.getFileName().toString());
                        fileInfo.put("size", java.nio.file.Files.size(path));
                        fileInfo.put("modified", java.nio.file.Files.getLastModifiedTime(path).toString());
                        fileInfo.put("url", "/api/audio/" + path.getFileName().toString());
                        fileList.add(fileInfo);
                    } catch (Exception e) {
                        log.warn("获取文件信息失败: {}", path, e);
                    }
                });
            }

            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("files", fileList);
            result.put("total", fileList.size());
            result.put("workspace_path", workspacePath);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("获取音频文件列表失败", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "error",
                "message", "获取音频文件列表失败: " + e.getMessage()
            ));
        }
    }

    /**
     * 获取音频文件
     */
    @GetMapping("/{filename}")
    public ResponseEntity<Resource> getAudioFile(@PathVariable String filename) {
        try {
            // 构建音频文件路径
            String workspacePath = getWorkspaceAudioDir();
            Path filePath = Paths.get(workspacePath, filename);
            File file = filePath.toFile();

            if (!file.exists()) {
                log.warn("音频文件不存在: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            // 创建文件资源
            Resource resource = new FileSystemResource(file);

            // 根据文件扩展名设置正确的Content-Type
            String contentType = getContentType(filename);

            log.info("提供音频文件访问: {} -> {}", filename, filePath);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);

        } catch (Exception e) {
            log.error("获取音频文件失败: {}", filename, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 获取音频工作目录
     */
    private String getWorkspaceAudioDir() {
        // 优先使用配置文件中的路径
        String configPath = System.getProperty("genie.workspace.path");
        if (configPath != null && !configPath.trim().isEmpty()) {
            return configPath + "/audio";
        }

        // 使用环境变量
        String envPath = System.getenv("GENIE_WORKSPACE_PATH");
        if (envPath != null && !envPath.trim().isEmpty()) {
            return envPath + "/audio";
        }

        // 默认使用当前工作目录
        return System.getProperty("user.dir") + "/workspace/audio";
    }

    /**
     * 音频服务健康检查
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        try {
            String workspacePath = getWorkspaceAudioDir();
            Path audioDir = Paths.get(workspacePath);

            Map<String, Object> result = new HashMap<>();
            result.put("status", "healthy");
            result.put("workspace_path", workspacePath);
            result.put("directory_exists", java.nio.file.Files.exists(audioDir));
            result.put("timestamp", java.time.LocalDateTime.now().toString());

            if (java.nio.file.Files.exists(audioDir)) {
                try (var stream = java.nio.file.Files.list(audioDir)) {
                    long audioFileCount = stream.filter(path -> {
                        String fileName = path.getFileName().toString().toLowerCase();
                        return fileName.endsWith(".mp3") || fileName.endsWith(".wav") || fileName.endsWith(".ogg");
                    }).count();
                    result.put("audio_file_count", audioFileCount);
                }
            } else {
                result.put("audio_file_count", 0);
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            log.error("音频服务健康检查失败", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "status", "unhealthy",
                "error", e.getMessage(),
                "timestamp", java.time.LocalDateTime.now().toString()
            ));
        }
    }
    
    /**
     * 根据文件扩展名获取Content-Type
     */
    private String getContentType(String filename) {
        if (filename.endsWith(".wav")) {
            return "audio/wav";
        } else if (filename.endsWith(".mp3")) {
            return "audio/mpeg";
        } else if (filename.endsWith(".ogg")) {
            return "audio/ogg";
        } else {
            return "application/octet-stream";
        }
    }
} 