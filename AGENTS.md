# 书阁维护约定

- 用户偏好：AI 在站外写小说，经 Git 提交自动发布；不需要在线生成、用户账户或访客上传入口。
- 默认内容维护仅修改 `content/` 对应小说；需要换书封时改 `assets/` 的对应 SVG。不要为新增章节修改页面代码。
- `content/<book-id>/book.json` 的 `id` 必须与目录一致；已发布的书籍与章节 ID 保持稳定。
- 章节第一行是 `# 章节名`；段落间空行，支持 `##` 小标题、`>` 引用、`---` 分隔。不使用内嵌 HTML。
- 新增章节后同步维护 `chapters` 顺序和 `updated`。正式小说 `sample: false`，示例小说 `sample: true`。
- 提交前运行 `npm run build`。`dist/` 不提交，GitHub Actions 从 `main` 自动发布。
- 完整操作见 README；Git 推送完成不等于已上线，应检查对应 Actions 的部署结果。
- 不把凭据、阅读记录备份、临时测试文件或本机配置加入仓库。
