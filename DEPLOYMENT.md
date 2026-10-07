# Echo Atlas：保存数据与发布网站

## 1. 现在的数据存在哪里？

当前没有云环境配置，页面右上角显示“本地演示模式”。

```text
点击投递
  → 校验地点、心情、日期与音频授权
  → DemoProvider.createPost
  → 当前浏览器 IndexedDB：echo-atlas-v1
      posts：文字、地点坐标、日期、心情、内部 userId、媒体引用
      media：图片 / 绘画 / 授权音频 Blob
      settings：收藏
  → 重新读取帖子，更新本机页面点位
```

记忆日期 `occurredAt` 由用户选择，发布时间 `createdAt` 在发布时生成。地点搜索服务返回坐标，地图点选直接读取点击坐标；确认时和地点名称、城市、地址、精度类型、坐标系一起保存。用户不用知道经纬度。

刷新同一网址、同一浏览器会保留内容。其他浏览器、设备、端口或域名不会共享这些数据；清理站点数据会删除它们。把前端上传到公网后，`demo` 模式依然只在每位访客自己的浏览器保存。已有本地帖子不会自动迁移到云数据库。

## 2. 正式后端是什么？

本项目已有 CloudBase 适配代码，尚未连接真实环境。后端由云函数、文档数据库、云存储和身份认证组成，不需要另开一个长期运行的 Node 服务。

```text
网页（React，dist 静态文件）
  → CloudBase Web 登录，取得内部 uid
  → SDK callFunction 调用 echo-api（index.main）
      → 校验字段、检查 uid 与帖子归属
      → echoPosts：帖子元数据
      → echoUploadTickets：临时上传票据
      → 云存储：图片 / 绘画 / 获授权音频
  ← 回传帖子、允许访问的媒体临时链接
```

匿名展示仍有内部 uid。当前匿名登录不能让用户在新设备自动找回“我的回声”；正式账号与跨设备收藏需要后续实现。数据库禁止前端直接读写，公开列表隐藏内部 `userId`。

## 3. 先配置真实地点搜索

1. 在腾讯位置服务控制台创建适合 Web JavaScript API GL 的浏览器 Key，启用所需地点服务，配置本地及正式域名白名单。
2. 复制 `.env.example` 为 `.env.local`，填写 `VITE_TMAP_KEY`，重启 `npm run dev`。
3. 在投递页填写城市、具体名称，点击搜索，选中结果并核对街道标记，点击“确认地点，继续”。没有任何预选地点。

腾讯搜索保存 GCJ02，公开地图使用 WGS84；显示层转换坐标，数据库保留原坐标系。地图点击 / 定位后的附近地址不能保证是精确 POI，应由用户核对。

**无 Key 的本地开发**使用 OpenStreetMap 真实街道底图和 Photon 公共演示搜索。搜索只在点击按钮或回车时请求，限制频率并缓存本次会话结果，不做自动联想。地址查询发送给对应地图服务，定位只在点击授权后调用浏览器 API。公开搜索不保证可用性，也可能缺少国内地点；失败时可放大地图点选，填写城市和名称，坐标仍自动记录。

**生产构建不自动调用 Photon 公共演示搜索**。上线配置腾讯 Key，或将 `VITE_PHOTON_URL` 指向你负责运营的 Photon 兼容 HTTPS 服务（根地址，需允许网站来源 CORS）。OSM 底图保留署名，只请求当前视图瓦片；正式运营需要适合实际流量的地图服务。

参考：[腾讯地点服务](https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocService)、[Photon 公共演示服务使用范围](https://github.com/komoot/photon#demo-server)、[OSM 底图使用政策](https://operations.osmfoundation.org/policies/tiles/)。

## 4. 配置并部署 CloudBase 后端

在 CloudBase 控制台操作以下步骤。开通资源前确认控制台展示的套餐和费用。

1. 新建 / 选择独立的 CloudBase 环境，记下**环境 ID**。
2. 开启 **Web 匿名登录**，在安全域名中加入本地开发来源和将来的正式网站域名。
3. 使用**文档型数据库**建立 `echoPosts`、`echoUploadTickets` 两个集合，为每个集合应用 `cloudfunctions/database.rules.json`。不能改成所有人读写。
4. 为 `echoPosts` 建立查询索引：公开查询 `visibility + status + createdAt`（时间降序）；个人查询 `userId + occurredAt`（时间降序）。如控制台返回缺索引错误，按对应查询提示建立索引。
5. 新建 **事件型 Node.js 云函数** `echo-api`，上传 `cloudfunctions/echo-api` 中的 `index.js`、`package.json`，设置入口 `index.main`。选择平台支持且能运行 `node:crypto` 的 Node.js 运行时，启用部署时安装依赖。它通过 SDK `callFunction` 调用，不需要额外开放 HTTP 网关。
6. 云函数调用权限参考 `cloudfunctions/function.rules.json`：`echo-api` 使用 `auth != null`，允许已登录的匿名用户调用。**如果当前环境已有其他云函数规则，请合并这一个函数的规则，保留原来的规则。**文件中的默认拒绝模板只用于新建的独立环境。若改了函数名，也要改规则中的名称。
7. 云存储应用 `cloudfunctions/storage.rules.json`。用户获取随机上传票据后通过官方 SDK 上传文件；数据库只存 fileId。读取文件由云函数核对公开状态或归属后签发临时链接。
8. `.env.local` 配置：

```dotenv
VITE_DATA_MODE=cloudbase
VITE_CLOUDBASE_ENV_ID=你的环境ID
VITE_CLOUDBASE_FUNCTION=echo-api
VITE_TMAP_KEY=你的浏览器地图Key
```

这些是进入网页的客户端参数。管理密钥、SecretKey、服务端凭据不得放进任何 `VITE_` 变量。

配置后重启本地开发服务。右上角应显示“CloudBase 模式”。**这个标记只表明选用了云适配层，不能单独证明后端成功**。需要完成下一节的实际数据核对。

参考：[云函数部署](https://docs.cloudbase.net/cli-v1/functions/deploy)、[函数调用权限](https://docs.cloudbase.net/cloud-function/security-rules)。

## 5. 怎样确认后端真的接通？

在你自己的云环境中执行以下核对，项目不会伪造通过结果：

1. 发布一条有可识别文字的回声，在“我的回声”中打开，确认保存成功。
2. 在 CloudBase 控制台的 `echoPosts` 找到同一条记录，核对 `location`、`occurredAt`、`createdAt` 和内部 `userId`。仅看到网页成功提示还不够。
3. 如果带图片，核对云存储存在对应文件，数据库保存的是 `imageFileId`，没有内嵌图片二进制。
4. **公开帖子首次为 `pending`**，不会立刻出现在其他访客的公开列表。在控制台人工审核后，把该记录 `status` 改为 `approved`；重新打开 / 刷新网页读取它。
5. 用另一个浏览器或设备访问同一网站，能看到审核通过的公开帖子，才说明是多人共享云端数据。私密帖子应只在原登录者的“我的回声”出现。
6. 在“我的回声”取消公开后，用另一个浏览器重新读取，确认不再进入公开列表。媒体临时链接申请有效期为 600 秒，已签发链接可能在过期前继续有效。

若失败，检查函数日志与网页错误：未登录 → 匿名登录设置；`PERMISSION_DENIED` → 函数 / 存储规则；找不到函数 → 环境 ID / 函数名；域名校验失败 → 安全域名；公开列表为空但我的回声有记录 → `pending` 待审核。删除后的数据、孤立媒体、票据需要按运营策略清理。

## 6. 发布网页到公网

推荐将前端放到同一 CloudBase 环境的静态网站托管，后端使用上面的云函数与数据库。前端和后端分别部署；腾讯地图配置也独立于数据保存。

### Vercel 网页部署（GitHub 导入）

可以完全通过 GitHub 与 Vercel 网页完成，不需要 Vercel CLI：

1. 在 GitHub 网页创建项目仓库，将本项目源码上传。仓库可以设为私有；不要上传 `.env.local`、任何真实密钥或 `node_modules`。`.gitignore` 已排除本地环境文件与构建产物。
2. 在 Vercel 网页选择 **Add New → Project → Import Git Repository**，连接 GitHub 并只授权这个项目仓库。
3. 导入时检查构建配置：Framework Preset 选择 **Vite**，Build Command 为 `npm run build`，Output Directory 为 `dist`，Install Command 使用默认的 `npm install`。
4. 默认使用 `VITE_DATA_MODE=demo`，无需配置环境变量即可构建。需要启用真实腾讯地图搜索时，在 Vercel 项目 Settings → Environment Variables 添加 `VITE_TMAP_KEY`（浏览器 Key，先在腾讯位置服务控制台配置正式域名白名单），保存后重新部署。
5. 需要启用 CloudBase 时，先完成本指南的后端设置，再添加 `VITE_DATA_MODE=cloudbase`、`VITE_CLOUDBASE_ENV_ID` 与 `VITE_CLOUDBASE_FUNCTION`，并把正式域名加入 CloudBase 安全域名。**仅部署静态网站不会创建 CloudBase 后端。**
6. Vercel 显示部署完成后，打开其分配的 HTTPS 域名验证页面。默认演示模式下，每位访客的数据只保存在自己浏览器的 IndexedDB；公开网站不会让不同访客共享帖子。若尚未配置 `VITE_TMAP_KEY`，部署后的选点使用演示模式，不能据此宣称腾讯地图已接通。

QQ 音乐仍是用户提供官方分享链接后的外链打开；Vercel 部署不会增加站内曲库播放或授予音频版权。

1. 在控制台启用静态网站托管，等待资源就绪。
2. 正式域名加入 CloudBase 安全域名及腾讯地图白名单。
3. 在项目根目录运行：

```powershell
npm run build
```

4. 将生成的 **`dist` 目录中的内容**上传到静态托管站点根目录，根目录应该直接包含 `index.html` 与 `assets`。不要上传 `node_modules`、`.env.local` 或整个源码目录。
5. 使用托管提供的 HTTPS 地址打开网站。绑定自己的域名时，按控制台要求配置 DNS、证书及备案等域名条件。
6. 再按上一节在正式地址完成数据核对。修改 `VITE_` 配置后需要重新打包和上传，仅改服务器环境变量不会改变已构建的网页。

也可使用官方 CLI，在确认目标是这个项目的独立网站后执行：

```powershell
npm install -g @cloudbase/cli
tcb login
tcb hosting deploy ./dist -e 你的环境ID
```

这个命令会更新目标托管站点同名文件。云函数仍须单独部署；不要把网站上传成功理解为数据库与权限已配置。

参考：[静态网站托管部署](https://docs.cloudbase.net/cli-v1/hosting)。

## 7. 当前仍需上线前完成的事情

- 当前未执行云部署或真实环境联调，以上是实际代码对应的配置路径。
- 正式账号、跨设备“我的回声”、云端收藏、分页、反滥用、内容审核与孤立文件清理仍需完善；首版用匿名登录、最多 500 条读取和人工审核。
- QQ 音乐保留官方分享链接外链播放；网站没有 QQ 曲库站内播放，也没有获取任何商业歌曲授权。上传音频必须确认原创或授权。
