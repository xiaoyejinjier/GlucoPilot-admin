# 接口契约来源

权威仓库：https://github.com/xiaoyejinjier/GlucoPilot-backend
权威文件：docs/API-CONTRACT.md
调用方发布前应在验收记录中登记对应后端提交 SHA 和镜像标签。
用户端 /api/v1/**，管理端 /admin/v1/**；响应 { code, message, data, requestId }，成功码 0。

2026-10-20 V28：文章详情增加videos:[{mediaId}]，GET /admin/v1/community/articles/{id}/videos/{mediaId}要求content:news:list且验证文章关联，成功为no-store鉴权video/mp4二进制，失败仍ApiResponse。Blob仅供当前账号/文章临时播放，管理员核验视频后终审，AI初审不覆盖媒体。完整契约见“回复、投稿媒体与用户主页”。

2026-10-20后续：GET /admin/v1/exports支持status/keyword/pageNum/pageSize，POST /exports/{id}/generate真实生成/重试，GET /exports/{id}/file返回鉴权XLSX二进制，均需export:task:manage，无Mock回退；完成文件为固定数据快照，失败仍ApiResponse。user:manage的GET /users及新增GET /users/{id}返回实际phone并保留phoneMasked，未绑定为空，健康档案/公开资料脱敏不变。V27迁移、日期上限及记录范围见权威契约。

2026-10-20：文章详情增加images:[{mediaId}]；GET /admin/v1/community/articles/{id}/images/{mediaId}需content:news:list，成功返回image/*二进制且no-store，错误仍ApiResponse。Blob仅供当前文章预览，不能读取未关联图片；管理员一并终审配图，现有AI初审仅检查文字。V26已在核对的本机开发库备份迁移。

2026-10-20布局补充：文章筛选语义不变，默认全部状态/来源，增加重置。评论回复契约见后端“评论回复与显示”，V25已在核对后的本机开发库应用并保留旧评论；不新增管理端私信或用户隐私读取范围。

2026-10-20后续：C端投稿/分类/举报及自定义标签接口、AI初审队列已实现，14篇六类科普已入本机开发库等待审核；不再是仅UI占位。管理端举报为独立菜单，轮播图管理入口移除。初审通过只进入管理员终审，版本及权限约束不变；真实AI调用和终审公开尚待重启后验收。

2026-10-20补充：文章管理默认查询所有官方资讯与社区投稿，GET /admin/v1/community/articles支持status/source/keyword/pageNum/pageSize，source为OFFICIAL或COMMUNITY，发布人来自author公开昵称与社区号。列表、详情、审核和举报管理端控制器已实现并通过权限及数据库测试；需要重启本次后端以注册新路由。用户投稿接口、AI任务及示例文章导入仍是后续阶段，不能以管理端接口完成代替全链路验收。

2026-10-20：社区文章审核与举报管理UI按权威契约“社区投稿、分类与审核”实现。GET /admin/v1/community/articles、/articles/{id}、/reports读取队列/详情；POST /articles/{id}/review、/retry-ai、/reports/{id}/resolve提交版本化审核或举报处理。当前为UI优先阶段，后端接口尚待完成启用，预览演示内容不写数据库。

2026-10-20：食品DTO新增只读reviewImage，待审核列表及编辑预览优先用户实拍。通过GET /admin/v1/foods/{id}/review-image携带运营Bearer读取图片二进制，缺失时回落原配图；reviewImage与Blob临时地址不得写入食品公开image字段。依赖后端V23来源照片关联迁移，详见权威契约“管理端食物图片”。
