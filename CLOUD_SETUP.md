# 微信云开发配置

1. 在云开发控制台创建 `users`、`vacations`、`goals`、`tasks`、`task_records` 五个集合。
2. 将五个集合的权限设为“仅创建者可读写”。`users` 也可设为仅云函数读写。
3. 在开发者工具中右键 `cloudfunctions/login` 与 `cloudfunctions/batchData`，选择“上传并部署：云端安装依赖”。
4. 若项目没有默认云环境，将云开发环境 ID 填入 `config/cloud.js` 的 `envId`。
5. 推荐索引：
   - 所有业务集合：`_openid`（升序）+ `updatedAt`（降序）
   - `tasks`：`_openid`（升序）+ `date`（升序）
   - `task_records`：`_openid`（升序）+ `taskId`（升序）+ `occurrenceDate`（升序）

集合必须先创建，否则首次同步会自动退回本地缓存并显示“离线模式”。
