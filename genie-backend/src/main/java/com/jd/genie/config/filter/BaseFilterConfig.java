package com.jd.genie.config.filter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.Filter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CharacterEncodingFilter;
import org.springframework.web.filter.CorsFilter;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;


/**
 * @author bjwangjuntao
 * CORS配置类 - 处理跨域请求
 * 注意：当allowCredentials=true时，不能使用通配符"*"，必须指定具体的来源
 */
@Slf4j
@Configuration
public class BaseFilterConfig {
	public BaseFilterConfig() {
	}

	@Bean
	public FilterRegistrationBean<CorsFilter> corsFilter() {
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowCredentials(true);
		
		// 注意：当allowCredentials=true时，不能使用通配符"*"，必须指定具体的来源
		// 请根据实际部署环境修改以下地址
		List<String> allowedOrigins = Arrays.asList(
			"http://172.29.217.100:3000",  // 生产环境前端地址 - 请修改为实际IP
			"http://localhost:3000",        // 本地开发环境
			"http://127.0.0.1:3000"         // 本地开发环境（备用）
		);
		config.setAllowedOrigins(allowedOrigins);
		config.addAllowedHeader("*");
		config.addAllowedMethod("*");
		config.setMaxAge(3600L); // 预检请求缓存时间（秒）
		
		source.registerCorsConfiguration("/**", config);
		CorsFilter corsFilter = new CorsFilter(source);
		
		// 打印当前允许的来源，用于调试
		log.info("========== CORS配置已加载 ==========");
		log.info("允许的来源: {}", config.getAllowedOrigins());
		log.info("允许的方法: {}", config.getAllowedMethods());
		log.info("允许的头部: {}", config.getAllowedHeaders());
		log.info("允许凭证: {}", config.getAllowCredentials());
		log.info("====================================");
		
		FilterRegistrationBean<CorsFilter> bean = this.creatAllFilter(corsFilter, Ordered.HIGHEST_PRECEDENCE);
		// 确保CORS过滤器优先级最高，在其他过滤器之前执行
		bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
		return bean;
	}


	<T extends Filter> FilterRegistrationBean<T> creatAllFilter(T filter, int order) {
		return this.createFilter(filter, order, "/*");
	}

	<T extends Filter> FilterRegistrationBean<T> createFilter(T filter, int order, String... urlPatterns) {
		FilterRegistrationBean<T> bean = new FilterRegistrationBean<>();
		bean.setFilter(filter);
		bean.setOrder(order);
		bean.addUrlPatterns(urlPatterns);
		bean.setDispatcherTypes(DispatcherType.REQUEST, new DispatcherType[0]);
		return bean;
	}
}
