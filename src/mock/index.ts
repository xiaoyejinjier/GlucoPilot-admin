import type {
  AdminAccount, AppUser, Banner, DashboardStats, ExportTask, Feedback, FoodCategory, FoodItem,
  HealthArchive, MediaFile, News, OperationLog, Role, SysConfig
} from '@/types'

/* ============================================================
   纯前端 Mock 数据层
   - 数据写入 localStorage 持久化（key: kt_admin_db_v1）
   - 所有方法返回 Promise + 少量延迟，模拟真实接口
   - 后续接入真实后端时，仅需替换本文件实现
   ============================================================ */

const DB_KEY = 'kt_admin_db_v1'
const delay = (ms = 160) => new Promise((r) => setTimeout(r, ms))
const d2 = (n: number) => String(n).padStart(2, '0')
const date = (day: number) => `2026-09-${d2(day)}`
const daysAgo = (n: number) => {
  const dt = new Date('2026-09-20T10:00:00')
  dt.setDate(dt.getDate() - n)
  return `${dt.getFullYear()}-${d2(dt.getMonth() + 1)}-${d2(dt.getDate())} ${d2(dt.getHours())}:${d2(dt.getMinutes())}`
}

let seq = 100

interface DBShape {
  accounts: AdminAccount[]
  users: AppUser[]
  news: News[]
  banners: Banner[]
  media: MediaFile[]
  categories: FoodCategory[]
  foods: FoodItem[]
  feedback: Feedback[]
  exports: ExportTask[]
  config: SysConfig
  logs: OperationLog[]
}

const CHANNELS: Array<News['channel']> = ['企业动态', '行业快讯', '设备新知', '控糖科普']

function seed(): DBShape {
  const users: AppUser[] = Array.from({ length: 38 }, (_, i) => {
    const id = i + 1
    const names = ['吴先生', '李阿姨', '陈师傅', '王老师', '张叔', '刘姐', '赵同学', '孙女士', '周大爷', '郑大哥']
    const n = i % names.length
    return {
      id,
      username: `user_${1000 + i}`,
      nickname: i < 10 ? names[n] : `糖友${1000 + i}`,
      avatarText: (names[n] || '友').slice(0, 1),
      phone: `138${d2(i)}${String(1000 + i * 7).slice(0, 6)}`,
      age: 38 + ((i * 7) % 34),
      diabetesType: ['1 型糖尿病', '2 型糖尿病', '妊娠期高血糖', '糖耐量异常'][i % 4],
      status: i % 23 === 0 ? 'disabled' : 'enabled',
      registeredAt: daysAgo((i * 3) % 60),
      lastActiveAt: daysAgo(i % 5),
      recordCount: 2 + ((i * 13) % 200),
      mealCount: 1 + ((i * 9) % 120),
      compliance: 40 + ((i * 17) % 56)
    }
  })

  const news: News[] = [
    {
      id: 1, title: '餐后血糖为什么会飙升？三步稳住波动', summary: '餐后血糖波动常见于精制主食过量与进餐过快。',
      channel: '控糖科普', type: 'article', coverUrl: '/img/news-1.svg', coverText: '科普', content:
        '一、先看主食：把精白米面换成杂粮饭或全麦，同样一碗，升糖更平缓。\n二、再看顺序：先吃菜、再吃肉、最后吃主食，能明显降低餐后峰值。\n三、最后看量：宁可少一点、慢一点，吃完再根据下一餐前的血糖微调。\n\n本文仅供健康管理参考，不构成医疗建议。',
      status: 'published', publishAt: '2026-09-18 09:20', views: 1286, likes: 86, collects: 42, createdAt: '2026-09-16 15:02', updatedAt: '2026-09-18 09:20'
    },
    {
      id: 2, title: '指血与 CGM 怎么配合使用更省心', summary: '指血校准准、CGM 看趋势。',
      channel: '设备新知', type: 'video', coverUrl: '/img/news-2.svg', coverText: '▶', videoUrl: '/video/demo.mp4',
      content: '指血血糖仪负责关键节点校准，CGM 负责观察 24 小时趋势。两者配合，早上空腹校准一次即可安心一整天。',
      status: 'published', publishAt: '2026-09-16 10:30', views: 864, likes: 52, collects: 18, createdAt: '2026-09-14 11:00', updatedAt: '2026-09-16 10:30'
    },
    {
      id: 3, title: '慧科未来发布控糖助手新版本', summary: '九时段记录与拍食物估糖全新体验上线。',
      channel: '企业动态', type: 'article', coverUrl: '/img/news-3.svg', coverText: '动态',
      content: '新版本围绕“记录—分析—建议—追踪”主循环升级：九时段血糖记录支持拍食物估算大概血糖，AI 对话更懂你的档案。',
      status: 'published', publishAt: '2026-09-12 08:00', views: 2410, likes: 168, collects: 90, createdAt: '2026-09-10 09:30', updatedAt: '2026-09-12 08:00'
    },
    {
      id: 4, title: '连续 7 天空腹血糖达标，这些习惯帮了大忙', summary: '一位 2 型糖友的控糖周记。',
      channel: '行业快讯', type: 'article', coverUrl: '/img/news-4.svg', coverText: '快讯',
      content: '固定的起床与用药时间、晚饭后散步 30 分钟、每餐前拍一张餐食照片做估糖对照，是他坚持下来的三个小习惯。',
      status: 'published', publishAt: '2026-09-08 14:00', views: 731, likes: 45, collects: 30, createdAt: '2026-09-07 16:20', updatedAt: '2026-09-08 14:00'
    },
    {
      id: 5, title: '拟上线：低 GI 主食专题栏目', summary: '内容团队正在筹备低 GI 主食测评专题。',
      channel: '企业动态', type: 'article', coverUrl: '/img/news-5.svg', coverText: '预告',
      content: '计划每周更新两款低 GI 主食的吃法与估糖对照，欢迎在意见反馈中告诉我们你想看的内容。',
      status: 'draft', publishAt: '', views: 0, likes: 0, collects: 0, createdAt: '2026-09-19 10:00', updatedAt: '2026-09-19 10:00'
    }
  ]

  const banners: Banner[] = [
    { id: 1, title: '拍食物 · 估血糖', image: '/img/banner-1.svg', linkType: 'article', linkValue: '3', sort: 1, enabled: true, remark: '引导页轮播' },
    { id: 2, title: 'AI 控糖助手 2.0', image: '/img/banner-2.svg', linkType: 'url', linkValue: 'https://example.com/guide', sort: 2, enabled: true, remark: '' },
    { id: 3, title: '控糖科普周报', image: '/img/banner-3.svg', linkType: 'article', linkValue: '1', sort: 3, enabled: true, remark: '' }
  ]

  const categories: FoodCategory[] = [
    { id: 1, name: '主食类', sort: 1 },
    { id: 2, name: '肉蛋类', sort: 2 },
    { id: 3, name: '蔬菜类', sort: 3 },
    { id: 4, name: '水果类', sort: 4 },
    { id: 5, name: '奶类', sort: 5 }
  ]

  const foods: FoodItem[] = [
    { id: 1, name: '米饭', categoryId: 1, categoryName: '主食类', carbs: 25.9, cal: 116, gi: 83, image: '/img/food-rice.svg', description: '熟米饭，约 100g/碗', enabled: true, updatedAt: daysAgo(3) },
    { id: 2, name: '燕麦', categoryId: 1, categoryName: '主食类', carbs: 66.3, cal: 367, gi: 55, image: '/img/food-oat.svg', description: '燕麦片（干重）', enabled: true, updatedAt: daysAgo(3) },
    { id: 3, name: '面条', categoryId: 1, categoryName: '主食类', carbs: 55.0, cal: 284, gi: 81, image: '/img/food-noodle.svg', description: '煮面条（湿重参考）', enabled: true, updatedAt: daysAgo(2) },
    { id: 4, name: '馒头', categoryId: 1, categoryName: '主食类', carbs: 47.0, cal: 221, gi: 88, image: '/img/food-bun.svg', description: '白面馒头', enabled: true, updatedAt: daysAgo(2) },
    { id: 5, name: '鸡胸肉', categoryId: 2, categoryName: '肉蛋类', carbs: 0, cal: 133, gi: null, image: '/img/food-chicken.svg', description: '熟鸡胸肉', enabled: true, updatedAt: daysAgo(6) },
    { id: 6, name: '鸡蛋', categoryId: 2, categoryName: '肉蛋类', carbs: 1.1, cal: 144, gi: null, image: '/img/food-egg.svg', description: '一个约 50g', enabled: true, updatedAt: daysAgo(6) },
    { id: 7, name: '西兰花', categoryId: 3, categoryName: '蔬菜类', carbs: 4.3, cal: 34, gi: 15, image: '/img/food-broccoli.svg', description: '清炒或白灼', enabled: true, updatedAt: daysAgo(4) },
    { id: 8, name: '苹果', categoryId: 4, categoryName: '水果类', carbs: 13.7, cal: 52, gi: 36, image: '/img/food-apple.svg', description: '中等大小 200g', enabled: true, updatedAt: daysAgo(1) },
    { id: 9, name: '香蕉', categoryId: 4, categoryName: '水果类', carbs: 22.8, cal: 89, gi: 52, image: '/img/food-banana.svg', description: '中等大小 120g', enabled: true, updatedAt: daysAgo(1) },
    { id: 10, name: '牛奶', categoryId: 5, categoryName: '奶类', carbs: 4.8, cal: 54, gi: 27, image: '/img/food-milk.svg', description: '纯牛奶 100ml', enabled: true, updatedAt: daysAgo(5) }
  ]

  const feedback: Feedback[] = [
    { id: 1, userId: 3, userName: '陈师傅', type: '产品建议', content: '希望拍照估糖能区分“饭量大小”，我吃半碗和一碗估算应该不一样。', contact: '', status: 'received', reply: '', createdAt: '2026-09-19 09:12', processedAt: '' },
    { id: 2, userId: 6, userName: '刘姐', type: 'Bug问题', content: '九节点页面早餐后的图标点击没有反应，麻烦看下。', contact: '13800000006', status: 'processing', reply: '已复现，正在修复该节点跳转问题。', createdAt: '2026-09-18 20:03', processedAt: '2026-09-19 10:00' },
    { id: 3, userId: 12, userName: '糖友1011', type: '功能诉求', content: '希望增加更丰富的控糖科普内容。', contact: '', status: 'done', reply: '已收录需求，感谢建议！', createdAt: '2026-09-15 11:40', processedAt: '2026-09-16 09:30' },
    { id: 4, userId: 8, userName: '孙女士', type: '其他', content: '导出数据的 Excel 里日期列格式有点乱。', contact: '13800000008', status: 'received', reply: '', createdAt: '2026-09-20 08:22', processedAt: '' }
  ]

  const exports: ExportTask[] = [
    { id: 1, userId: 3, userName: '陈师傅', rangeType: '7', startDate: '2026-09-13', endDate: '2026-09-19', status: 'done', fileUrl: '/download/export-1.xlsx', createdAt: '2026-09-19 20:01' },
    { id: 2, userId: 8, userName: '孙女士', rangeType: 'custom', startDate: '2026-08-01', endDate: '2026-08-31', status: 'pending', fileUrl: '', createdAt: '2026-09-20 09:15' }
  ]

  const media: MediaFile[] = [
    { id: 1, name: 'news-1.jpg', bizType: 'news', url: '/img/news-1.svg', size: 182340, mime: 'image/jpeg', uploader: 'editor01', createdAt: daysAgo(3) },
    { id: 2, name: 'banner-1.png', bizType: 'banner', url: '/img/banner-1.svg', size: 402112, mime: 'image/png', uploader: 'editor01', createdAt: daysAgo(2) },
    { id: 3, name: 'meal-20260919.jpg', bizType: 'meal_photo', url: '/img/meal-demo.svg', size: 654321, mime: 'image/jpeg', uploader: 'editor02', createdAt: daysAgo(1) }
  ]

  const logs: OperationLog[] = [
    { id: 1, operator: 'admin', role: 'admin', module: '登录', action: '登录后台', detail: '账号 admin 登录成功', ip: '127.0.0.1', createdAt: daysAgo(0) },
    { id: 2, operator: 'editor01', role: 'editor', module: '资讯', action: '发布文章', detail: '《餐后血糖为什么会飙升》已发布', ip: '127.0.0.1', createdAt: daysAgo(2) },
    { id: 3, operator: 'admin', role: 'admin', module: '用户', action: '禁用用户', detail: '禁用用户 #23', ip: '127.0.0.1', createdAt: daysAgo(4) }
  ]

  return {
    accounts: [
      { id: 1, username: 'admin', password: 'admin123', nickname: '系统管理员', role: 'admin', status: 1, createdAt: '2026-08-01', lastLoginAt: daysAgo(0) },
      { id: 2, username: 'editor01', password: 'editor123', nickname: '内容运营小慧', role: 'editor', status: 1, createdAt: '2026-08-05', lastLoginAt: daysAgo(1) },
      { id: 3, username: 'editor02', password: 'editor123', nickname: '运营-小科', role: 'editor', status: 1, createdAt: '2026-08-12', lastLoginAt: daysAgo(6) }
    ],
    users, news, banners, media, categories, foods, feedback, exports, logs,
    config: {
      glucose: { lowDanger: 3.9, warnStart: 7.8, dangerStart: 10 },
      text: {
        disclaimer: '本系统提供的血糖估算、饮食建议与 AI 问答仅供健康管理参考，不构成医疗诊断或治疗建议；如有不适请及时就医。',
        agreement: '用户协议：请在合法合规范围内使用本系统，尊重他人隐私与知识产权。',
        about: '控糖健康管理系统（AI控糖助手）由贵州慧科未来科技有限公司运营。',
        announcement: '欢迎使用新版控糖助手：九时段记录 + 拍食物估糖已上线。'
      },
      defaults: { theme: 'green', fontSize: '较大', notifyGlucose: true, notifyMeal: true, notifyNews: false }
    }
  }
}

function load(): DBShape {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as DBShape
      const merged = { ...seed(), ...saved }
      // 兼容新增 username 之前已经保存在浏览器里的旧 Mock 数据。
      merged.users = (merged.users || []).map((user) => ({
        ...user,
        username: user.username || `user_${user.id}`
      }))
      return merged
    }
  } catch {
    /* ignore */
  }
  const fresh = seed()
  persist(fresh)
  return fresh
}

let db: DBShape = load()

function persist(state: DBShape = db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state))
  } catch {
    /* storage full/无权限时静默（演示） */
  }
}

function addLog(operator: string, role: Role, module: string, action: string, detail: string) {
  db.logs.unshift({
    id: ++seq, operator, role, module, action, detail, ip: '127.0.0.1', createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
  })
  if (db.logs.length > 200) db.logs.pop()
  persist()
}

/* ---------------- Mock API ---------------- */

export const api = {
  /* 认证 */
  async login(username: string, password: string) {
    await delay(240)
    const acc = db.accounts.find((a) => a.username === username && a.password === password && a.status === 1)
    if (!acc) throw new Error('账号或密码错误，或账号已被停用')
    acc.lastLoginAt = new Date().toLocaleString('zh-CN', { hour12: false })
    addLog(acc.username, acc.role, '登录', '登录后台', `账号 ${acc.username} 登录成功`)
    const { password: _pw, ...safe } = acc
    return safe
  },

  /* 看板 */
  async dashboardStats(): Promise<DashboardStats> {
    await delay()
    const trend = Array.from({ length: 14 }, (_, i) => {
      const idx = 14 - i
      return {
        date: date(Math.max(1, idx)),
        glucose: 120 + ((i * 37) % 160),
        meal: 80 + ((i * 53) % 130),
        users: 3 + ((i * 11) % 26)
      }
    })
    return {
      users: { total: db.users.length, today: 12, active: 186 },
      records: { todayGlucose: 328, todayMeal: 214, monthTotal: 8230 },
      content: { newsViews: db.news.reduce((s, n) => s + n.views, 0), newsCount: db.news.length, feedbackPending: db.feedback.filter((f) => f.status !== 'done').length },
      trend,
      complianceDist: [
        { level: '达标(ok)', value: db.users.filter((u) => u.compliance >= 70).length },
        { level: '偏高(warn)', value: db.users.filter((u) => u.compliance >= 40 && u.compliance < 70).length },
        { level: '需关注(danger)', value: db.users.filter((u) => u.compliance < 40).length }
      ],
      channelDist: CHANNELS.map((c, i) => ({ channel: c, value: 240 + i * 137 + ((i * 97) % 200) })),
      nodeHeat: [
        { node: '早餐前', value: 96 }, { node: '早餐', value: 82 }, { node: '早餐后', value: 90 },
        { node: '中餐前', value: 74 }, { node: '中餐', value: 70 }, { node: '中餐后', value: 78 },
        { node: '晚餐前', value: 60 }, { node: '晚餐', value: 58 }, { node: '晚餐后', value: 66 }
      ]
    }
  },

  /* ------- 资讯 ------- */
  async listNews() { await delay(); return [...db.news].sort((a, b) => b.id - a.id) },
  async saveNews(n: News) {
    await delay()
    const i = db.news.findIndex((x) => x.id === n.id)
    if (i >= 0) {
      db.news[i] = { ...db.news[i], ...n, updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }
    } else {
      n.id = ++seq
      n.createdAt = new Date().toLocaleString('zh-CN', { hour12: false })
      n.updatedAt = n.createdAt
      db.news.unshift(n)
    }
    persist(); return n
  },
  async removeNews(id: number) { await delay(); db.news = db.news.filter((x) => x.id !== id); persist() },
  async setNewsStatus(id: number, status: News['status']) { await delay(); const n = db.news.find((x) => x.id === id); if (n) { n.status = status; n.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false }); persist() } },

  /* ------- 轮播 ------- */
  async listBanners() { await delay(); return [...db.banners].sort((a, b) => a.sort - b.sort) },
  async saveBanner(b: Banner) {
    await delay()
    const i = db.banners.findIndex((x) => x.id === b.id)
    if (i >= 0) db.banners[i] = { ...db.banners[i], ...b }
    else { b.id = ++seq; db.banners.push(b) }
    persist(); return b
  },
  async removeBanner(id: number) { await delay(); db.banners = db.banners.filter((x) => x.id !== id); persist() },

  /* ------- 媒体 ------- */
  async listMedia() { await delay(); return [...db.media].sort((a, b) => b.id - a.id) },
  async mockUpload(name: string, bizType: MediaFile['bizType'], uploader: string) {
    await delay(400)
    const m: MediaFile = {
      id: ++seq, name, bizType,
      url: bizType === 'meal_photo' ? '/img/meal-demo.svg' : bizType === 'banner' ? '/img/banner-upload.svg' : '/img/news-upload.svg',
      size: Math.round(120000 + Math.random() * 800000), mime: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      uploader, createdAt: new Date().toLocaleString('zh-CN', { hour12: false })
    }
    db.media.unshift(m); persist(); return m
  },
  async removeMedia(id: number) { await delay(); db.media = db.media.filter((x) => x.id !== id); persist() },

  /* ------- 营养库 ------- */
  async listCategories() { await delay(); return [...db.categories].sort((a, b) => a.sort - b.sort) },
  async saveCategory(c: FoodCategory) {
    await delay()
    const i = db.categories.findIndex((x) => x.id === c.id)
    if (i >= 0) db.categories[i] = { ...db.categories[i], ...c }
    else { c.id = ++seq; db.categories.push(c) }
    persist(); return c
  },
  async removeCategory(id: number) {
    await delay()
    if (db.foods.some((f) => f.categoryId === id)) throw new Error('该分类下仍有食物，请先移动或删除食物')
    db.categories = db.categories.filter((x) => x.id !== id); persist()
  },
  async listFoods() { await delay(); return [...db.foods] },
  async saveFood(f: FoodItem) {
    await delay()
    const i = db.foods.findIndex((x) => x.id === f.id)
    f.categoryName = db.categories.find((c) => c.id === f.categoryId)?.name || ''
    if (i >= 0) { db.foods[i] = { ...db.foods[i], ...f, updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) } }
    else { f.id = ++seq; f.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false }); db.foods.push(f) }
    persist(); return f
  },
  async removeFood(id: number) { await delay(); db.foods = db.foods.filter((x) => x.id !== id); persist() },

  /* ------- 用户与服务 ------- */
  async listUsers() { await delay(); return [...db.users] },
  async toggleUserStatus(id: number, enabled: boolean) {
    await delay()
    const u = db.users.find((x) => x.id === id)
    if (u) { u.status = enabled ? 'enabled' : 'disabled'; persist() }
  },
  async archiveOf(userId: number): Promise<HealthArchive> {
    await delay(300)
    const u = db.users.find((x) => x.id === userId)
    const trend = Array.from({ length: 7 }, (_, i) => ({
      date: date(Math.max(1, 14 - i)),
      avg: Math.round((5.2 + ((i * 13) % 28) / 10) * 10) / 10,
      okRate: 55 + ((i * 17) % 45)
    }))
    const nodeStats: HealthArchive['nodeStats'] = [
      { node: 'before_breakfast', nodeName: '早餐前', avg: 6.1, samples: 12 },
      { node: 'after_breakfast', nodeName: '早餐后', avg: 8.4, samples: 11 },
      { node: 'before_lunch', nodeName: '中餐前', avg: 6.6, samples: 10 },
      { node: 'after_lunch', nodeName: '中餐后', avg: 9.1, samples: 9 }
    ]
    return {
      userId,
      owner: {
        nickname: u?.nickname || `糖友${userId}`,
        phone: u?.phone || '',
        age: u?.age || 0,
        diabetesType: u?.diabetesType || '2 型糖尿病',
        registeredAt: u?.registeredAt || ''
      },
      profile: { height: 168, weight: 66, medication: u?.diabetesType === '1 型糖尿病' ? '门冬胰岛素' : '二甲双胍 0.5g bid', exercise: '每周快走 3 次', diagnosedAt: '2021-06' },
      trend,
      nodeStats,
      mealSummary: { recordDays: 12, avgCarbsG: 46, avgCal: 528, topFoods: ['米饭', '清炒西兰花', '鸡胸肉', '苹果'] },
      summary: `近 7 日空腹均值 6.1 mmol/L，餐后峰值偏高（${u?.nickname || ''}早餐后均值为 8.4）；主食定量与餐后散步对峰值改善明显，建议保持当前用药并继续记录。`
    }
  },
  async listFeedback() { await delay(); return [...db.feedback].sort((a, b) => b.id - a.id) },
  async replyFeedback(id: number, reply: string, status: Feedback['status']) {
    await delay()
    const f = db.feedback.find((x) => x.id === id)
    if (f) {
      f.reply = reply
      f.status = status
      f.processedAt = status === 'done' ? new Date().toLocaleString('zh-CN', { hour12: false }) : f.processedAt
      persist()
    }
  },
  async listExports() { await delay(); return [...db.exports].sort((a, b) => b.id - a.id) },
  async finishExport(id: number) { await delay(); const t = db.exports.find((x) => x.id === id); if (t) { t.status = 'done'; t.fileUrl = `/download/export-${t.id}.xlsx`; persist() } },

  /* ------- 系统 ------- */
  async listAccounts() { await delay(); return [...db.accounts] },
  async saveAccount(a: AdminAccount) {
    await delay()
    const i = db.accounts.findIndex((x) => x.id === a.id)
    if (i >= 0) db.accounts[i] = { ...db.accounts[i], ...a }
    else { a.id = ++seq; a.createdAt = new Date().toLocaleString('zh-CN', { hour12: false }); db.accounts.push(a) }
    persist(); return a
  },
  async getConfig() { await delay(); return JSON.parse(JSON.stringify(db.config)) as SysConfig },
  async saveConfig(c: SysConfig) { await delay(); db.config = c; persist() },
  async listLogs() { await delay(); return [...db.logs] },

  /* 写操作日志（由视图调用，替代真实后端审计） */
  writeLog(operator: string, role: Role, module: string, action: string, detail: string) {
    addLog(operator, role, module, action, detail)
  }
}

export function resetDb() {
  localStorage.removeItem(DB_KEY)
  db = seed()
  persist()
}
