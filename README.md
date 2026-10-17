# 雨落花庭 · 书阁

自己的小说阅读站，沿用雨落花庭的深蓝灰夜色。站外让 AI 写作，Git 提交小说，GitHub Actions 自动构建并发布到 GitHub Pages。

- 网站：<https://zoe843.github.io/rainbloom-novels/>
- 仓库：<https://github.com/zoe843/rainbloom-novels>
- 个人网站：<https://rainbloom.xin/>

## 现有功能

书架搜索、小说简介与目录、章节阅读、阅读进度恢复、书签、两种底色、字号/行距/正文宽度/字体设置、阅读记录导入导出。手机适配，支持键盘左右方向键换章、Escape 关闭对话框。深链地址刷新仍能打开对应章节。

阅读状态仅保存在当前浏览器，不自动跨设备同步。前往“阅读记录”导出 JSON，到另一台设备导入即可。清除浏览器数据前请先导出。

书架现在包含《雨停之前》（三章）与《末班月台》（两章），都是为演示阅读体验写的 **AI 示例短篇**。没有预设用户已提供正式作品。可替换、删除或继续增加小说。

## 以后怎么加小说

一书一文件夹，一章一 Markdown。没有在线后台，也没有公开上传入口。

```text
content/
  rain-before-dawn/
    book.json
    01.md
    02.md
    03.md
  your-book/
    book.json
    01.md
assets/
  rain.svg
  platform.svg
```

### 1. 新建小说资料

复制一本已有小说的文件夹，在 `content/your-book/book.json` 修改：

```json
{
  "id": "your-book",
  "title": "你的小说名",
  "author": "作者名",
  "subtitle": "一句话介绍",
  "description": "小说简介",
  "tags": ["奇幻", "冒险"],
  "status": "连载中",
  "updated": "2026-10-17",
  "cover": "rain.svg",
  "sample": false,
  "chapters": [
    { "id": "chapter-one", "file": "01.md" }
  ]
}
```

- `id` 与文件夹名一致，只用小写英文字母、数字与中划线。
- `chapters` 数组的顺序就是章节顺序。`file` 是同文件夹的 Markdown 文件。
- `status` 为 `连载中` 或 `已完结`。`updated` 是实际更新日期。
- `cover` 指向 `assets/` 下的 SVG 书封。可先复用示例，再换成自己的 SVG。
- 正式小说把 `sample` 改为 `false`；页面就不会显示“示例短篇”。
- **已经发布的书籍和章节 ID 尽量不改**，阅读进度和书签用它们定位。章节标题可以改。

### 2. 写章节正文

`content/your-book/01.md`：

```markdown
# 第一章 章节标题

第一段正文。段落之间留一空行，网页会自动首行缩进。

第二段正文。

> 可以这样放一段信件或引用。

## 章内小标题

后续正文。

---

分隔线之后的正文。
```

第一行必须是一级标题；正文支持段落、二级标题、引用和分隔线。空章、缺文件、重复章节 ID、非法路径会让构建失败，避免错误内容上线。暂不支持复杂 Markdown、正文插图和富文本；HTML 按普通文字显示，不执行。

### 3. 更新与发布

```powershell
npm run build
git add content assets
git commit -m "更新小说章节"
git push origin main
```

GitHub 仓库的 **Actions → Publish the bookshelf** 显示绿色后，新版就会发布。网页有缓存时可刷新一次。

续章只需要新增一个 `.md` 文件、在对应 `book.json` 的 `chapters` 加一项并更新日期，然后提交。正文错别字直接改原文件即可。

### 可以直接交给 AI 的要求

> 请为我的 rainbloom-novels 仓库更新小说。只维护 content 下相应小说的 book.json 和 Markdown 章节；保持已发布的书籍与章节 ID 不变；新增章节必须加入 chapters 并更新 updated。正文首行用 # 章节名，段落间空一行。完成后运行 npm run build，检查通过再 Git 提交并 push main。不要修改页面样式或加入在线生成入口。

## 本地预览

需要 Node.js 22 或更新版本，无第三方运行依赖。

```powershell
npm run build
npm run preview
```

浏览器打开 <http://127.0.0.1:8947/rainbloom-novels/>。`dist/` 为构建产物，不需要提交；GitHub Actions 会自动生成。

## 接入个人网站

本次没有修改个人网站。以后在导航加入“书阁”，链接到这个站即可。若要使用 `novels.rainbloom.xin`，再配置 GitHub Pages 自定义域名与 DNS。若要搬进主站路径，需要同时迁移资源和阅读数据；不同域名的浏览器存储不会自动共用。

## 文件职责

- `assets/app.js`：路由、书架、详情、阅读与控件。
- `assets/storage.js`：本地进度、书签、设置与记录合并。
- `assets/style.css`：花庭视觉、响应式排版与阅读主题。
- `scripts/build.mjs`：验证小说资料并生成目录和逐章 JSON。
- `scripts/serve.mjs`：仅本地预览，模拟 GitHub Pages 子路径。
- `.github/workflows/pages.yml`：自动发布。

页面与书封为本项目制作；背景图复用用户现有雨落花庭个人网站资源。未添加外部分析、模型接口或第三方字体请求。
