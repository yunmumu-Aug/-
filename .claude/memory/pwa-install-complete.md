---
name: pwa-install-complete
description: PWA 安装功能已实现并验证通过
metadata:
  type: reference
---

时光轴项目的 PWA 完善已完成，包括：
- Service Worker（自包含，无外部 CDN 依赖，纯原生 Cache + Fetch API）
- 多尺寸 PNG 图标（192/512 + maskable）
- manifest.json 配置完整（scope、start_url、theme_color）
- InstallPrompt 组件（设置页面，Android 安装按钮 + iOS Safari 指引）
- 构建流水线：图标生成 → Next.js 构建 → SW 注入

**关键点：**
- 项目部署在 GitHub Pages 的子路径 `/-` 下，所有 PWA 路径需加 `/-` 前缀
- 线上验证通过，手机 Chrome 可正常安装
- 自包含 SW 不依赖 Google CDN，国内可正常注册
