export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1);
    const cookies = request.headers.get("Cookie") || "";
    const isAuthorized = cookies.includes("authorized=true");

    // 1. 验证接口
    if (url.pathname === "/verify" && request.method === "POST") {
      const { code } = await request.json();
      if (code === env.AUTH_CODE) {
        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": "authorized=true; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax"
          }
        });
      }
      return new Response(JSON.stringify({ error: "Invalid Code" }), { status: 401 });
    }

    // 2. 下载逻辑
    if (path.includes("/download")) {
      const mainId = path.split("/")[0];
      const index = new URLSearchParams(url.search).get("index") || 0;
      const dataStr = await env.CLIPBOARD_KV.get(mainId);
      if (!dataStr) return new Response("链接已过期", { status: 404 });
      
      const data = JSON.parse(dataStr);
      const fileInfo = data.filesMeta[index];
      const fileData = await env.CLIPBOARD_KV.get(fileInfo.key, { type: "arrayBuffer" });
      
      return new Response(fileData, {
        headers: {
          "Content-Type": fileInfo.type || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileInfo.name)}"`
        }
      });
    }

    // 3. 查看分享内容
    if (path && path !== "verify") {
      const dataStr = await env.CLIPBOARD_KV.get(path);
      if (!dataStr) return new Response("内容不存在", { status: 404 });
      return new Response(renderFullHTML(JSON.parse(dataStr), path, true, true), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    // 4. 首页逻辑
    if (!isAuthorized) {
      return new Response(renderFullHTML({}, "", false, false), {
        headers: { "Content-Type": "text/html;charset=UTF-8" }
      });
    }

    if (request.method === "POST") {
      try {
        const formData = await request.formData();
        const files = formData.getAll("files");
        const text = formData.get("text") || "";
        const ttl = parseInt(formData.get("ttl") || "86400"); // 接收过期时间
        const id = Math.random().toString(36).substring(2, 8);
        let filesMeta = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file && file.size > 0) {
            const fileKey = `${id}_file_${i}`;
            await env.CLIPBOARD_KV.put(fileKey, await file.arrayBuffer(), { expirationTtl: ttl });
            filesMeta.push({ name: file.name, type: file.type, size: (file.size / 1024 / 1024).toFixed(2) + " MB", key: fileKey });
          }
        }
        await env.CLIPBOARD_KV.put(id, JSON.stringify({ text, filesMeta }), { expirationTtl: ttl });
        return new Response(JSON.stringify({ id }), { headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    return new Response(renderFullHTML({}, "", false, true), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

function renderFullHTML(data, id, isPreview, isAuthorized) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CloudClip | 极简分发</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f8fafc; --card: #ffffff; --text: #1e293b; --primary: #2563eb;
            --border: #e2e8f0; --secondary: #64748b; --danger: #ef4444;
            --font: 'Inter', system-ui, sans-serif;
        }
        [data-theme='dark'] {
            --bg: #0f172a; --card: #1e293b; --text: #f1f5f9; --primary: #3b82f6;
            --border: #334155; --secondary: #94a3b8;
        }
        body { 
            background: var(--bg); color: var(--text); font-family: var(--font);
            margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
            transition: background 0.3s;
        }
        .container { 
            width: 90%; max-width: 480px; padding: 30px; background: var(--card); 
            border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid var(--border);
        }
        .top-bar { position: absolute; top: 20px; right: 20px; display: flex; gap: 15px; }
        .icon-btn { cursor: pointer; font-size: 20px; opacity: 0.7; transition: 0.2s; user-select: none; }
        
        .overlay {
            position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8);
            display: ${!isAuthorized && !isPreview ? 'flex' : 'none'};
            align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(8px);
        }
        .auth-card { background: var(--card); padding: 30px; border-radius: 20px; width: 300px; text-align: center; }
        
        input, textarea, select { 
            width: 100%; padding: 12px; margin: 10px 0; border: 1px solid var(--border);
            border-radius: 12px; background: var(--bg); color: var(--text); box-sizing: border-box;
            font-family: var(--font); font-size: 14px; outline: none;
        }
        select { cursor: pointer; appearance: none; background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-size: 16px; }

        .btn { 
            width: 100%; background: var(--primary); color: white; border: none; padding: 14px; 
            border-radius: 12px; font-weight: 700; cursor: pointer; margin-top: 10px;
            font-family: var(--font); transition: 0.2s;
        }
        .btn:active { transform: scale(0.98); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .upload-area {
            border: 2px dashed var(--border); padding: 30px; border-radius: 16px;
            text-align: center; cursor: pointer; margin: 15px 0; transition: 0.2s;
        }
        .upload-area:hover { border-color: var(--primary); background: rgba(37, 99, 235, 0.05); }

        .file-item {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px; background: var(--bg); border-radius: 10px; margin-bottom: 8px; font-size: 13px;
        }
        
        #result { 
            margin-top: 20px; padding: 16px; border-radius: 12px; 
            background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2);
            display: none; cursor: pointer;
        }
        
        .preview-text { 
            background: var(--bg); padding: 18px; border-radius: 14px; border-left: 4px solid var(--primary);
            white-space: pre-wrap; margin-bottom: 20px; font-size: 14px;
        }
        label { font-size: 12px; color: var(--secondary); font-weight: 600; margin-left: 4px; }
    </style>
</head>
<body data-theme="light">
    <div class="top-bar">
        <div class="icon-btn" onclick="toggleLang()" id="langBtn">🇺🇸</div>
        <div class="icon-btn" onclick="toggleTheme()" id="themeBtn">🌙</div>
    </div>

    <div class="overlay" id="authOverlay">
        <div class="auth-card">
            <h3 data-i18n="auth_title">🔒 安全验证</h3>
            <input type="password" id="authCode" data-i18n-placeholder="auth_placeholder" placeholder="请输入安全码">
            <button class="btn" onclick="verify()" data-i18n="auth_btn">确认</button>
        </div>
    </div>

    <div class="container">
        ${isPreview ? `
            <h2 data-i18n="share_title">📦 分享内容</h2>
            ${data.text ? `<div class="preview-text">${data.text}</div>` : ''}
            <div id="fileList">
                ${data.filesMeta.map((f, i) => `
                    <div class="file-item">
                        <span style="font-weight:600;">${f.name} <small style="color:var(--secondary); font-weight:400;">(${f.size})</small></span>
                        <a href="/${id}/download?index=${i}" class="btn" style="width:auto; margin:0; padding:6px 14px; font-size:12px; text-decoration:none;">下载</a>
                    </div>
                `).join('')}
            </div>
            <div style="text-align:center; margin-top:25px;">
                <a href="/" style="color:var(--primary); text-decoration:none; font-size:14px; font-weight:600;" data-i18n="back_home">← 我也要发送</a>
            </div>
        ` : `
            <h2 data-i18n="app_title">🚀 CloudClip 跨端传输</h2>
            <textarea id="textInput" data-i18n-placeholder="text_placeholder" placeholder="输入文字内容..."></textarea>
            
            <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                <div style="font-size: 32px; margin-bottom:8px;">📁</div>
                <div style="font-weight:700;" data-i18n="upload_hint">选择或拖拽文件</div>
                <input type="file" id="fileInput" hidden multiple onchange="showFiles()">
            </div>
            <div id="fileListView"></div>

            <label data-i18n="ttl_label">文件有效期</label>
            <select id="ttlSelect">
                <option value="86400" data-i18n="opt_1d">1 天 (24 小时)</option>
                <option value="604800" data-i18n="opt_7d">7 天 (一周)</option>
            </select>

            <button class="btn" id="uploadBtn" onclick="upload()" data-i18n="upload_btn">上传并获取链接</button>
            <div id="result" onclick="copyLink()"></div>
        `}
    </div>

    <script>
        const i18n = {
            zh: {
                auth_title: "🔒 安全验证",
                auth_placeholder: "输入访问安全码",
                auth_btn: "确认",
                app_title: "🚀 CloudClip 云剪贴板",
                text_placeholder: "输入文字内容... (可选)",
                upload_hint: "选择或拖拽文件 (单文件 25MB 内)",
                upload_btn: "上传并获取链接",
                share_title: "📦 分享内容",
                back_home: "← 我也要发送文件",
                uploading: "正在上传...",
                success: "✨ 点击链接复制",
                copied: "✅ 已复制到剪贴板",
                ttl_label: "文件有效期",
                opt_1d: "1 天 (24 小时)",
                opt_7d: "7 天 (一周)",
                err_code: "安全码错误",
                err_fail: "上传失败"
            },
            en: {
                auth_title: "🔒 Security Check",
                auth_placeholder: "Enter Access Code",
                auth_btn: "Confirm",
                app_title: "🚀 CloudClip",
                text_placeholder: "Type something... (Optional)",
                upload_hint: "Click or Drag Files (Max 25MB each)",
                upload_btn: "Upload & Get Link",
                share_title: "📦 Shared Content",
                back_home: "← Create My Own",
                uploading: "Uploading...",
                success: "✨ Click to Copy Link",
                copied: "✅ Copied to Clipboard",
                ttl_label: "Expiration",
                opt_1d: "1 Day (24 Hours)",
                opt_7d: "7 Days (1 Week)",
                err_code: "Invalid Security Code",
                err_fail: "Upload Failed"
            }
        };

        let currentLang = localStorage.getItem('lang') || 'zh';
        let lastLink = "";

        function updateUI() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                el.innerText = i18n[currentLang][el.getAttribute('data-i18n')];
            });
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                el.placeholder = i18n[currentLang][el.getAttribute('data-i18n-placeholder')];
            });
            document.getElementById('langBtn').innerText = currentLang === 'zh' ? '🇺🇸' : '🇨🇳';
        }

        function toggleLang() {
            currentLang = currentLang === 'zh' ? 'en' : 'zh';
            localStorage.setItem('lang', currentLang);
            updateUI();
        }

        function toggleTheme() {
            const body = document.body;
            const isDark = body.getAttribute('data-theme') === 'dark';
            const next = isDark ? 'light' : 'dark';
            body.setAttribute('data-theme', next);
            document.getElementById('themeBtn').innerText = isDark ? '🌙' : '☀️';
            localStorage.setItem('theme', next);
        }

        async function verify() {
            const code = document.getElementById('authCode').value;
            const res = await fetch('/verify', { method: 'POST', body: JSON.stringify({ code }) });
            if (res.ok) location.reload();
            else alert(i18n[currentLang].err_code);
        }

        function showFiles() {
            const files = document.getElementById('fileInput').files;
            const view = document.getElementById('fileListView');
            view.innerHTML = Array.from(files).map(f => \`
                <div class="file-item"><span style="font-weight:600;">\${f.name}</span><small>\${(f.size/1024/1024).toFixed(2)}MB</small></div>
            \`).join('');
        }

        async function upload() {
            const btn = document.getElementById('uploadBtn');
            const files = document.getElementById('fileInput').files;
            const text = document.getElementById('textInput').value;
            const ttl = document.getElementById('ttlSelect').value;
            if (files.length === 0 && !text) return;

            btn.disabled = true;
            btn.innerText = i18n[currentLang].uploading;

            const fd = new FormData();
            Array.from(files).forEach(f => fd.append('files', f));
            fd.append('text', text);
            fd.append('ttl', ttl);

            try {
                const res = await fetch('/', { method: 'POST', body: fd });
                const data = await res.json();
                lastLink = window.location.origin + '/' + data.id;
                
                const resDiv = document.getElementById('result');
                resDiv.style.display = 'block';
                resDiv.innerHTML = \`<div style="font-weight:700; font-size:14px; color:#166534;">\${i18n[currentLang].success}</div>
                                    <div style="font-size:12px; color:#166534; opacity:0.8; word-break:break-all; margin-top:4px;">\${lastLink}</div>\`;
                btn.innerText = i18n[currentLang].upload_btn;
                btn.disabled = false;
            } catch (e) {
                alert(i18n[currentLang].err_fail);
                btn.disabled = false;
            }
        }

        function copyLink() {
            if (!lastLink) return;
            navigator.clipboard.writeText(lastLink).then(() => {
                const resDiv = document.getElementById('result');
                const originalContent = resDiv.innerHTML;
                resDiv.innerHTML = \`<div style="font-weight:700; font-size:14px; color:#166534;">\${i18n[currentLang].copied}</div>\`;
                setTimeout(() => { resDiv.innerHTML = originalContent; }, 2000);
            });
        }

        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
        document.getElementById('themeBtn').innerText = savedTheme === 'dark' ? '☀️' : '🌙';
        updateUI();
    </script>
</body>
</html>`;
}
