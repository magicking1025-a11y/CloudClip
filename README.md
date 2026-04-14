# CloudClip

一个极简的、基于 Cloudflare Workers + KV 的跨端文件与文字传输工具。

### 功能特点
- 🚀 支持多文件上传（单文件需在 25MB 以内）
- 🔒 首页安全码验证，分享链接直接访问
- 🌓 支持深色模式与中英双语
- 📋 上传后点击链接自动复制

### 如何部署
1. 在 Cloudflare Workers 创建一个新服务。
2. 将 `index.js` 的代码粘贴到编辑器中。
3. 在设置中绑定一个名为 `CLIPBOARD_KV` 的 KV 命名空间。
4. 添加环境变量 `AUTH_CODE` 作为你的访问密码。

# CloudClip

A minimalist cross-device file and text transfer tool based on Cloudflare Workers + KV.

### Features
- 🚀 Supports multiple file uploads (single file must be within 25MB)
- 🔒 Homepage security code verification, share links can be accessed directly
- 🌓 Supports dark mode and bilingual (Chinese and English)
- 📋 Automatically copies the link when clicking after upload

### How to Deploy
1. Create a new service in Cloudflare Workers.
2. Paste the code from `index.js` into the editor.
3. Bind a KV namespace named `CLIPBOARD_KV` in the settings.
4. Add an environment variable `AUTH_CODE` as your access password.
