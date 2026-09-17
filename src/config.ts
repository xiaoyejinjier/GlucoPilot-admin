/**
 * Admin 联调配置。开发态走 Vite 代理，勿写死跨域端口。
 */
export const adminConfig = {
  /** 为空则用相对路径，由 vite proxy 转发到后端 */
  baseUrl: '',
  /** true=全部 Mock；false=登录/资讯/Banner/营养库走真实接口 */
  useMock: false
}
