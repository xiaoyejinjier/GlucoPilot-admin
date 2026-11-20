/**
 * Admin 联调配置。开发态走 Vite 代理，勿写死跨域端口。
 */
export const adminConfig = {
  /** 为空则用相对路径，由 vite proxy 转发到后端 */
  baseUrl: '',
  /** true=演示数据；false=已接入模块（含数据看板）使用真实接口 */
  useMock: false
}
