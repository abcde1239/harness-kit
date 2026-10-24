# 按需公开检查

仅在用户明确要求公开准备、检查或导出时使用。始终明确当前配置的 public 范围；不能为让检查通过把整个仓库设为 public。

统一调用 `bun <skill>/scripts/harness.mjs <command> --root <project> --json`：

- `export --destination artifacts/public-snapshot --manifest-out .harness/publication.json`：写入全新目录，不复制 .git/私有历史，不推送。已有目标目录时使用另一个用户可理解的新目录，不能删除旧结果腾位置。
- `publication-check --manifest .harness/publication.json`：实际文件集合、输出及来源 SHA-256、已知内部复制件、链接等检查。输出变化后重新检查。
- `review-template --out .harness/review.json`：产生与 refs/策略绑定的证据模板。reviewer/reference、remoteRefs 和平台各项必须由真实审阅支撑，不能为通过门禁编造证据。
- `audit-history --evidence .harness/review.json`：所有本地 refs 可达历史，包括已删 memory、侧分支/标签。浅克隆、缺对象、LFS/submodule 等未覆盖资源阻断。

私有转公开并不等于 HEAD 文件检查。远端 refs 完整性及 Issues/PR/Wiki/Release/Actions 等目前依赖显式人工审阅声明；工具不自动认证托管平台状态。精确相同 blob 的重命名可检测，任意内容改写不能保证自动追踪。

构建清单：version 1、target、artifactRoot、entries。每项 path、sha256、sources（每个 source 的 path/sha256）；转换产物还需 review.reviewer/reference。来源未明、未列出的实际文件或归档无法深度审计时拒绝公开，不添加虚构来源。

检查后仍不得自行切换可见性、上传、强推、清理历史。报告审计覆盖范围和未覆盖项，保留用户原有权限边界。
