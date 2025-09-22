package com.jd.genie.agent.tool.common;

import com.jd.genie.agent.agent.AgentContext;
import com.jd.genie.agent.tool.BaseTool;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 计算器工具类
 * 实现BaseTool接口，提供数学计算功能
 */
@Slf4j
@Data
public class CalculatorTool implements BaseTool {
    
    private AgentContext agentContext;

    @Override
    public String getName() {
        return "agent_calculator";
    }

    @Override
    public String getDescription() {
        return "这是一个数学计算智能体，能够执行基本的数学运算，包括加减乘除、幂运算、开方等";
    }

    @Override
    public Map<String, Object> toParams() {
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("type", "object");
        
        Map<String, Object> properties = new HashMap<>();
        
        Map<String, Object> expressionParam = new HashMap<>();
        expressionParam.put("type", "string");
        expressionParam.put("description", "数学表达式，例如：2+3*4、sqrt(16)、2^3等");
        properties.put("expression", expressionParam);
        
        Map<String, Object> precisionParam = new HashMap<>();
        precisionParam.put("type", "integer");
        precisionParam.put("description", "计算结果精度，默认保留4位小数");
        precisionParam.put("default", 4);
        properties.put("precision", precisionParam);
        
        parameters.put("properties", properties);
        parameters.put("required", new String[]{"expression"});
        
        return parameters;
    }

    @Override
    public Object execute(Object input) {
        try {
            if (input instanceof Map) {
                Map<String, Object> inputMap = (Map<String, Object>) input;
                String expression = (String) inputMap.get("expression");
                Integer precision = (Integer) inputMap.getOrDefault("precision", 4);
                
                if (expression == null || expression.trim().isEmpty()) {
                    return "错误：请提供需要计算的数学表达式";
                }
                
                log.info("{} 执行计算任务，表达式: {}, 精度: {}", 
                    agentContext != null ? agentContext.getRequestId() : "unknown", 
                    expression, precision);
                
                // 执行计算
                return performCalculation(expression, precision);
            } else {
                return "错误：输入参数格式不正确，需要提供包含expression字段的JSON对象";
            }
        } catch (Exception e) {
            log.error("{} 计算任务失败", 
                agentContext != null ? agentContext.getRequestId() : "unknown", e);
            return "计算失败：" + e.getMessage();
        }
    }
    
    /**
     * 执行数学计算
     */
    private String performCalculation(String expression, int precision) {
        try {
            // 清理表达式
            String cleanExpression = expression.replaceAll("\\s+", "");
            
            // 处理特殊函数
            if (cleanExpression.startsWith("sqrt(")) {
                return handleSquareRoot(cleanExpression, precision);
            } else if (cleanExpression.contains("^")) {
                return handlePower(cleanExpression, precision);
            } else if (cleanExpression.contains("log(")) {
                return handleLogarithm(cleanExpression, precision);
            } else {
                // 基本四则运算
                return handleBasicArithmetic(cleanExpression, precision);
            }
        } catch (Exception e) {
            return "计算错误：" + e.getMessage();
        }
    }
    
    /**
     * 处理开方运算
     */
    private String handleSquareRoot(String expression, int precision) {
        Pattern pattern = Pattern.compile("sqrt\\((\\d+(?:\\.\\d+)?)\\)");
        Matcher matcher = pattern.matcher(expression);
        
        if (matcher.find()) {
            double number = Double.parseDouble(matcher.group(1));
            if (number < 0) {
                return "错误：不能对负数开平方根";
            }
            double result = Math.sqrt(number);
            return String.format("√%s = %." + precision + "f", number, result);
        }
        return "错误：开方表达式格式不正确，应为 sqrt(数字)";
    }
    
    /**
     * 处理幂运算
     */
    private String handlePower(String expression, int precision) {
        String[] parts = expression.split("\\^");
        if (parts.length != 2) {
            return "错误：幂运算表达式格式不正确，应为 底数^指数";
        }
        
        try {
            double base = Double.parseDouble(parts[0]);
            double exponent = Double.parseDouble(parts[1]);
            double result = Math.pow(base, exponent);
            return String.format("%s^%s = %." + precision + "f", base, exponent, result);
        } catch (NumberFormatException e) {
            return "错误：幂运算的底数或指数不是有效数字";
        }
    }
    
    /**
     * 处理对数运算
     */
    private String handleLogarithm(String expression, int precision) {
        Pattern pattern = Pattern.compile("log\\((\\d+(?:\\.\\d+)?)\\)");
        Matcher matcher = pattern.matcher(expression);
        
        if (matcher.find()) {
            double number = Double.parseDouble(matcher.group(1));
            if (number <= 0) {
                return "错误：对数的真数必须大于0";
            }
            double result = Math.log10(number);
            return String.format("log(%s) = %." + precision + "f", number, result);
        }
        return "错误：对数表达式格式不正确，应为 log(数字)";
    }
    
    /**
     * 处理基本四则运算
     */
    private String handleBasicArithmetic(String expression, int precision) {
        try {
            // 简单的表达式求值（这里使用简化的实现）
            // 在实际应用中，可以使用更强大的表达式解析库
            double result = evaluateSimpleExpression(expression);
            return String.format("%s = %." + precision + "f", expression, result);
        } catch (Exception e) {
            return "错误：无法解析数学表达式，请检查格式是否正确";
        }
    }
    
    /**
     * 简单的表达式求值（仅支持基本的加减乘除）
     */
    private double evaluateSimpleExpression(String expression) {
        // 移除所有空格
        expression = expression.replaceAll("\\s+", "");
        
        // 处理乘除
        expression = handleMultiplicationAndDivision(expression);
        
        // 处理加减
        return handleAdditionAndSubtraction(expression);
    }
    
    /**
     * 处理乘除运算
     */
    private String handleMultiplicationAndDivision(String expression) {
        Pattern pattern = Pattern.compile("(-?\\d+(?:\\.\\d+)?)([*/])(-?\\d+(?:\\.\\d+)?)");
        Matcher matcher = pattern.matcher(expression);
        
        while (matcher.find()) {
            double left = Double.parseDouble(matcher.group(1));
            String operator = matcher.group(2);
            double right = Double.parseDouble(matcher.group(3));
            
            double result;
            if ("*".equals(operator)) {
                result = left * right;
            } else if ("/".equals(operator)) {
                if (right == 0) {
                    throw new ArithmeticException("除数不能为零");
                }
                result = left / right;
            } else {
                continue;
            }
            
            expression = expression.replace(matcher.group(), String.valueOf(result));
            matcher = pattern.matcher(expression);
        }
        
        return expression;
    }
    
    /**
     * 处理加减运算
     */
    private double handleAdditionAndSubtraction(String expression) {
        String[] terms = expression.split("(?<=[-+])|(?=[-+])");
        double result = 0;
        String currentOperator = "+";
        
        for (String term : terms) {
            if (term.isEmpty()) continue;
            
            if ("+".equals(term) || "-".equals(term)) {
                currentOperator = term;
            } else {
                try {
                    double value = Double.parseDouble(term);
                    if ("+".equals(currentOperator)) {
                        result += value;
                    } else {
                        result -= value;
                    }
                } catch (NumberFormatException e) {
                    // 忽略无法解析的项
                }
            }
        }
        
        return result;
    }
} 