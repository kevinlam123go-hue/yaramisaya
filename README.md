# 亚拉弥赛亚（yaramisaya）

此仓库包含《亚拉弥赛亚》在线版：前端 (public/index.html) 与一个简易 Node.js 后端 (server.js)。

要点：
- 前端可作为离线单机游戏运行（localStorage），也可连接本仓库提供的后端，实现多人在线存档与 PVP。
- 后端使用 JSON 文件（data/players.json）作为存储；部署时请确保服务器有写入权限。

部署（Render 快速指南）
1. 登录 https://render.com 并连接你的 GitHub 账号（授权访问该仓库）。
2. 在 Render 控制台创建一个新的 Web Service：选择 "Connect a repo" -> 选择 kevinlam123go-hue/yaramisaya。
3. 构建命令：留空；启动命令： `npm start`。
4. Render 会自动部署并分配一个公网 URL，打开即可游玩。

本地启动
1. 安装依赖：
   npm install
2. 启动：
   npm start
3. 打开浏览器访问：http://localhost:3000

API 简要说明
- GET /api/players  列出所有玩家
- GET /api/player/:name  获取玩家数据
- POST /api/player  创建或更新玩家（body 为玩家对象）
- POST /api/pvp/rob  发起打劫（body: {attacker, target}）

WebSocket
- 后端自动开启 socket.io，前端会尝试连接 socket.io 并监听 pvp 事件以接收实时战报。

安全与生产注意
- 当前实现为简易示范，使用 JSON 文件持久化，适合小规模测试。生产环境建议使用数据库（例如 PostgreSQL）并增加认证与访问控制。

