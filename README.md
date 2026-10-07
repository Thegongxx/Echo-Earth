# 回声地球 Echo Atlas

腾讯音乐 Build With AI 高校 AI Hackathon 作品原型。React + TypeScript + Vite + Three.js；默认无需任何 Key，能够完成探索、主题漫游、静默 / 媒体投递和本地管理。

## 本地启动

需要 Node.js 20.19+ 或 22.12+。

```powershell
npm install
npm run dev
```

打开 http://localhost:5173 。生产打包：`npm run build`；本地预览产物：`npm run preview`。不要直接双击 `index.html`，应用使用模块与本地数据资源，需要 HTTP 服务。

## 演示流程

1. 星球：拖动 / 缩放地球，点击发光点；继续放大会从地球转到真实地图。可使用“街区”按钮直接查看选中回声的城市，通过滑杆 / 滚轮 / 双指缩放至 19 级街道细节，支持全屏探索与返回全球。也可以点下方回声卡片。浏览器不支持 WebGL 时仍可通过卡片或街区地图使用网站。
2. 详情：浏览原创插画、文字、心情；播放 Web Audio 生成的约 6 秒演示旋律，或播放用户确认授权的上传音频。收藏回声。
3. 相似回声：点击“发现相似回声”，进入固定规则的主题路线；每站解释匹配心情 / 标签。主题路线显示 3–5 站；如果云端不足 3 条，显示真实数量和空状态。
4. 投递：搜索真实名称 / 地址，选择结果并在二维街道地图核对标记（也可直接放大地图点击选点）→ 确认地点后直接进入日期与心情 → 所有内容可跳过 → 选择匿名 / 昵称及公开 / 私密 → 发布。没有预选城市或样例地点，不需要手填经纬度。
5. 公开演示帖子立即出现在地球，带轻量飞入动画；私密帖子只出现在“我的回声”。刷新后，本机创建的帖子和媒体仍保留。
6. 我的回声：按 `occurredAt` 形成时间线，可打开详情、取消公开、重新公开或删除。收藏保存在当前浏览器。

## 主要文件

- `src/App.tsx`：四个入口、筛选、详情、收藏、时间线与操作状态。
- `src/design.css`：本轮视觉系统、清晰字号、留白、手机抽屉与响应式覆盖；从 `src/main.tsx` 在原有样式后加载。
- `src/components/ThemeArtwork.tsx` / `src/lib/usePageMotion.ts`：原创主题线稿、声波等高线、进入视口的一次性动效与减少动画偏好。
- `DESIGN_REVIEW.md`：八项设计自检、实际检查范围与成果截图。
- `src/components/Globe.tsx` / `src/lib/earthTexture.ts`：交互地球、经纬度定位、真实大陆、主题大圆连线、资源释放与减少动画偏好。
- `src/lib/earthMaterial.ts`：柔和的海洋与陆地明暗、大气边缘。地球按视口较短边适配，手机默认显示完整球体；选中点有金色圆环与城市提示。按钮缩放平滑过渡，远距离选中沿球面转向。静态星空复用几何体，页面隐藏或地球离开视口时暂停绘制。
- `src/components/EarthExplorer.tsx` / `StreetMap.tsx`：地球与真实街区切换、2–19 级街道地图、全屏与触屏控制器。未配置腾讯 Key 时使用明确标注的 OpenStreetMap 公开底图；街区底图需要网络，不提供离线缓存或批量抓取。
- `public/assets/earth-land-50m.geojson`：随项目保存的 Natural Earth 1:50m 真实陆地轮廓；运行时不依赖远程地球图片。4096 × 2048 纹理，按 GPU 限制降级。配色是柔和的地图风格，不是卫星照片；不绘制行政边界。来源与公有领域许可见 `public/assets/earth-data-LICENSE.md`。
- `src/components/PostForm.tsx` / `LocationPicker.tsx` / `MediaUploader.tsx`：分步投递、独立选点、可选图片 / 绘画 / 音频和授权确认。
- `src/components/LocationMap.tsx` / `src/lib/placeSearch.ts`：真实二维选点地图、腾讯搜索 / 反查地址、无 Key 的本地 Photon 演示搜索。确认时自动记录坐标、地址和精度类型；异步旧结果不会覆盖新选择。
- `DEPLOYMENT.md`：本地数据保存方式、CloudBase 后端配置、云端成功核对方法、静态网站上线步骤。
- `src/types.ts`：明确的数据类型、`DataProvider` 与 `MoodSuggestionProvider`、发布校验、QQ 官方链接校验、公开字段转换。
- `src/data/demo.ts`：IndexedDB `posts` / `media` / `settings`，元数据和 Blob 分开保存；公开结果剔除 `userId`。
- `src/data/cloudbase.ts` / `cloudfunctions/echo-api`：CloudBase 前端适配器及服务端 CRUD、上传票据、所有者校验与公开字段白名单。
- `src/domain/themes.ts`：四个确定性主题、排序、匹配原因和固定关键词心情建议。没有调用 AI API。
- `public/assets/postcard-*.svg`：本项目原创演示插画。示例帖子是明确标注的虚构样例。

## 可选环境变量

复制 `.env.example` 为 `.env.local`，修改后重启 Vite。所有 `VITE_` 变量都会进入浏览器，**只能配置公开的客户端参数**。本项目没有任何真实密钥。

| 变量                      | 用途                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `VITE_DATA_MODE`          | `demo`（默认）或 `cloudbase`                                       |
| `VITE_CLOUDBASE_ENV_ID`   | CloudBase 公开环境 ID                                              |
| `VITE_CLOUDBASE_FUNCTION` | 云函数名，默认 `echo-api`                                          |
| `VITE_TMAP_KEY`           | 腾讯位置服务 JavaScript API GL 浏览器 Key，需域名白名单            |
| `VITE_PHOTON_URL`         | 可选自有 Photon 兼容地点服务根地址，生产构建不自动使用公共演示搜索 |

### 腾讯地图

配置有效的 `VITE_TMAP_KEY` 后，选点页加载官方 JavaScript API GL 与 service 类库，使用 `TMap.service.Search.searchRegion` 搜索城市 / 街道 / POI，使用 `Geocoder.getAddress` 识别地图点击 / 浏览器定位附近的地址。无预选地点，用户核对二维街道地图标记后确认；坐标自动保存，不需要手填经纬度。地球不承担 POI 搜索。

无 Key 的本地开发使用 Leaflet + OpenStreetMap 真实街道地图、Photon 公共演示地点搜索，标注“演示选点、非腾讯地图”。只在主动查询时请求，限制频率并缓存本次会话结果；覆盖与可用性有限。搜索失败可在地图上点击位置，只补充城市和名称。**生产构建不自动调用公共 Photon**，需要腾讯 Key 或自有 `VITE_PHOTON_URL`（HTTPS / CORS）。参考 [Photon 使用说明](https://github.com/komoot/photon#demo-server)。

“使用我当前位置”只在主动点击后调用浏览器 Geolocation。需要浏览器允许，且通常需要 HTTPS 或 localhost；拒绝或超时会显示可继续操作的错误提示。浏览器返回 WGS84，腾讯 POI / 地图点击返回 GCJ02。精确选点应以腾讯地图 POI 的确认点为准；全球地球展示不会将点击当成精准街道搜索。

官方文档：https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocService

星球的“街区视图”和投递地图在配置腾讯 Key 时使用腾讯地图；未配置时使用 Leaflet + OpenStreetMap 公开街道瓦片，**明确标注为非腾讯地图**。地图数据源与帖子存储模式独立。公开底图需要网络，瓦片失败会显示错误。保留地图来源署名，只请求当前视图必要瓦片，不做批量预取或离线下载。正式运营应配置腾讯地图或适合流量规模的自有底图服务。参考 [OSM 瓦片使用规则](https://operations.osmfoundation.org/policies/tiles/) 与 [Leaflet](https://leafletjs.com/reference.html)。

坐标显示会在 WGS84 和 GCJ02 间做转换，使同一回声在全球地球、公开地图与腾讯地图中保持位置对应；数据库保留选点时的原始坐标和坐标系。主题连线仅用于记忆漫游，不是道路导航路线。

### CloudBase

当前没有环境配置，也没有执行云端部署或真实联调。以下文件提供可接入的数据适配层；启用后如果登录 / 函数 / 权限未配置，会显示实际错误，不会伪造云端成功。

1. 在 CloudBase 控制台建立环境，启用 Web 匿名登录并添加应用安全域名。匿名登录得到内部 uid；匿名展示的 `displayName` 始终为空。
2. 建立文档型集合 `echoPosts` 和 `echoUploadTickets`。两个集合都使用 `cloudfunctions/database.rules.json`，禁止前端直接读写；所有数据操作经云函数。为公开列表建立 `visibility + status + createdAt` 索引，为个人列表建立 `userId + occurredAt` 索引。
3. 将 `cloudfunctions/echo-api` 部署为 Node.js 云函数 `echo-api`，入口 `index.main`，安装其 `package.json` 的依赖。使用云函数运行环境身份访问 CloudBase，不向前端配置管理密钥。
   函数调用权限需允许已登录的匿名用户，参考 `cloudfunctions/function.rules.json`；已有其他云函数时仅合并 `echo-api` 规则，保留其他规则。详细步骤与成功核对见 [部署指南](./DEPLOYMENT.md)。
4. 云存储应用 `cloudfunctions/storage.rules.json` 的上传者读写权限。前端先获取随机上传票据，再通过官方 SDK 上传到 `echo-media/<随机票据>/...`；数据库只保存 fileId。云函数确认帖子公开且审核通过，或属于调用者后，才生成媒体临时访问链接。公开帖子没有 `userId`，存储路径也不含 uid。
5. `.env.local` 配置 `VITE_DATA_MODE=cloudbase`、环境 ID 和函数名，重启开发服务。CloudBase 模式不会混入本地演示种子。
6. 首版公开帖子状态为 `pending`，在控制台人工审核后将 `status` 改为 `approved`。刷新页面会重新读取，并将新公开记录显示到地球。这里没有假称自动内容审核已接通。私密帖子仅所有者可读取；从私密转公开也需要审核。

云端媒体临时链接申请寿命为 600 秒，链接实际时效以 CloudBase 的当前存储配置为准。取消公开后不再向新请求签发链接，已签发链接仍可能在失效前有效。列表首版最多读取 500 条；生产扩展需分页。上传中断的票据、孤立媒体与 `cleanupPending` 记录应由运营定时清理；项目不会擅自清空云存储。收藏目前仍保存在当前浏览器，不做跨设备同步。

官方参考：[Web 上传](https://docs.cloudbase.net/en/storage/sdk)、[服务端身份](https://docs.cloudbase.net/api-reference/server/node-sdk/auth)、[云存储安全规则](https://docs.cloudbase.net/storage/security-rules)。

## QQ 音乐与音频

QQ 音乐仅关联标题、歌手、用户提供的 HTTPS 官方分享链接和可选 MID / ID；按钮为“打开 QQ 音乐听”，新窗口访问官方页面。**当前没有官方 SDK 站内曲库播放**，没有下载、解析、缓存或保存 QQ 音乐商业曲库音源。

上传音频需要用户确认原创或公开分享授权；没有确认的音频不可发布或公开播放。演示音色由 Web Audio 合成，配图由项目绘制。项目不声称获得任何商业歌曲授权。图片和绘画限 JPG / PNG / WebP、10 MB；音频限 20 MB，可播格式取决于浏览器。

## 演示边界

本地数据仅属于当前浏览器 / 当前站点来源，不提供跨设备、账号或多人共享。不同端口或浏览器有独立数据；浏览器隐私模式、配额和清理操作可能影响保存。IndexedDB 读取 / 写入异常会显示错误。选点页已使用真实街道地图；公开搜索可能缺少 POI，反查地址只描述附近地点，需核对标记。探索页仍包含明确标注的虚构样例。网站未部署到公网；腾讯地图和 CloudBase 需有效配置后联调。

## 检查

`npm run build` 进行 TypeScript 检查与生产构建。`npm run verify` 在隔离的内存 IndexedDB 环境中检查静默发布、内容 / 音频校验、QQ 官方链接、主题路线、夜间排序、匿名字段、坐标转换、存储重读、图片引用、私密隔离、归属权限、收藏和删除，不修改浏览器数据。
