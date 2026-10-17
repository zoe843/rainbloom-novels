# 书阁 Implementation Plan

**Goal:** 发布可实际阅读和由 Git 维护内容的 GitHub Pages 小说站。

**Architecture:** 无依赖 HTML/CSS/ES module；Node 构建内容为逐章 JSON，GitHub Actions 部署 dist。所有本地状态包在 storage.js，路由和界面在 app.js。

**Tech Stack:** Node 22+、原生浏览器 API、GitHub Pages。

**Spec:** [design.md](design.md)

## Global Constraints

- 公开静态站，无在线 AI 与访客写入；个人网站本次不改动。
- 书籍和章节使用稳定 ID，hash 路由兼容项目子路径。
- 进度仅当前浏览器保存，正文安全显示，不注入 HTML。

## Review Focus

- GitHub 项目路径和深链刷新：所有资源使用相对地址。
- 更换章节或快速跳转：异步加载过期结果不得覆盖当前路由。
- 字体与窗口变化：已读段落位置保持，不记录设置调整产生的错误位置。
- localStorage 禁用或 JSON 损坏：阅读不中断，提示保存失败或回到默认值。
- 窄屏、键盘和对话框：无溢出，关闭恢复焦点，目录和设置能用键盘操作。

## Task 1: 内容构建

- [x] 创建 package.json、scripts/build.mjs；content 下两篇示例短篇和说明。
- [x] 逐章输出结构 {id,title,blocks,wordCount}，catalog 不含全文。
- [x] node scripts/build.mjs 验证正常内容；隔离临时副本验证重复 ID、缺文件、路径越界拒绝。

## Task 2: 界面与阅读

- [x] index.html、assets/style.css、assets/app.js、assets/storage.js 与书封 SVG。
- [x] 实现书架、详情、阅读、记录、关于与未知路径。
- [x] 进度用章节 ID 和段落锚点；设置、书签持久化；导出/导入阅读数据用于换设备。
- [x] Playwright 验证所有主流程、存储异常、两主题、四宽度与控制台。
- [x] 截图检查书架和正文，可读性优先。

## Task 3: 发布与维护

- [x] README 说明新增/更新小说和 Git 流程，CI 使用官方 Pages Actions。
- [x] 本地检查通过后创建 zoe843/rainbloom-novels 公开仓库，push main，启用 Pages。
- [x] 等待 Actions 完成，核验正式站书架、章节、资源与深链刷新。
- [x] 更新共享记忆，交付网址、仓库与维护文档。
