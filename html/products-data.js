// 作品数据
const productsData = [
  {
    cover: '../img/covers/cover1.jpg',
    alt: '理财App UI',
    title: '移动端理财App视觉与交互设计',
    stars: 5,
    description: '围绕新手理财路径优化信息层级与引导动效，提升开户转化与留存。',
    tags: ['Figma', 'After Effects'],
    date: '2024年02月02日'
  },
  {
    cover: '../img/covers/cover2.jpg',
    alt: '健身小程序',
    title: '健身打卡小程序体验优化',
    stars: 4,
    description: '以目标驱动的任务流与激励体系，重构训练计划与社交打卡动线。',
    tags: ['Sketch', 'Principle'],
    date: '2024年01月12日'
  },
  {
    cover: '../img/covers/cover3.jpg',
    alt: 'SaaS后台设计系统',
    title: 'SaaS 后台设计系统（规范与组件库）',
    stars: 4,
    description: '沉淀表格、表单、筛选等高频模式，统一样式与交互，缩短交付周期。',
    tags: ['Figma', 'Design Tokens'],
    date: '2023年12月28日'
  },
  {
    cover: '../img/covers/cover4.jpg',
    alt: 'B2B 官网改版',
    title: 'B2B 官网信息架构与改版',
    stars: 4,
    description: '通过内容分层与案例背书强化转化路径，日均线索提升 37%。',
    tags: ['墨刀', 'Figma'],
    date: '2023年11月05日'
  },
  {
    cover: '../img/covers/cover5.jpg',
    alt: '课程平台 UI',
    title: '在线课程平台 UI 重设计',
    stars: 4,
    description: '重新梳理学习路径与搜索筛选，提升课程发现效率与完成率。',
    tags: ['Adobe XD', 'Illustrator'],
    date: '2023年10月18日'
  },
  {
    cover: '../img/covers/cover6.jpg',
    alt: '电商 App 重设计',
    title: '电商 App 购物流程重设计',
    stars: 4,
    description: '对搜索、推荐与结算流程做性能与体验优化，提升转化与复购。',
    tags: ['Figma', 'PS'],
    date: '2023年09月09日'
  },
  {
    cover: '../img/covers/cover1.jpg',
    alt: '企业OA系统设计',
    title: '企业OA办公系统界面设计',
    stars: 5,
    description: '优化审批流程与消息通知，提升办公效率与用户体验。',
    tags: ['Figma', 'Sketch'],
    date: '2023年08月15日'
  },
  {
    cover: '../img/covers/cover2.jpg',
    alt: '社交App设计',
    title: '社交App社区功能设计',
    stars: 4,
    description: '重构社区互动与内容发现，提升用户活跃度与留存率。',
    tags: ['Figma', 'Principle'],
    date: '2023年07月22日'
  },
  {
    cover: '../img/covers/cover3.jpg',
    alt: '数据可视化平台',
    title: '数据可视化平台设计',
    stars: 5,
    description: '设计大屏与报表系统，让复杂数据更直观易懂。',
    tags: ['Figma', 'After Effects'],
    date: '2023年06月10日'
  },
  {
    cover: '../img/covers/cover4.jpg',
    alt: '医疗App设计',
    title: '医疗健康App界面设计',
    stars: 4,
    description: '优化预约挂号与在线问诊流程，提升医患沟通效率。',
    tags: ['Sketch', 'Figma'],
    date: '2023年05月18日'
  },
  {
    cover: '../img/covers/cover5.jpg',
    alt: '教育平台设计',
    title: '在线教育平台交互设计',
    stars: 4,
    description: '重构课程学习与作业提交流程，提升学习体验。',
    tags: ['Adobe XD', 'Figma'],
    date: '2023年04月25日'
  },
  {
    cover: '../img/covers/cover6.jpg',
    alt: '旅游App设计',
    title: '旅游出行App视觉设计',
    stars: 5,
    description: '优化行程规划与酒店预订，提升旅行规划体验。',
    tags: ['Figma', 'Illustrator'],
    date: '2023年03月12日'
  },
  {
    cover: '../img/covers/cover1.jpg',
    alt: '音乐App设计',
    title: '音乐播放App界面设计',
    stars: 4,
    description: '重新设计播放界面与歌单管理，提升音乐发现体验。',
    tags: ['Sketch', 'Principle'],
    date: '2023年02月08日'
  },
  {
    cover: '../img/covers/cover2.jpg',
    alt: '新闻阅读App',
    title: '新闻阅读App信息架构',
    stars: 4,
    description: '优化内容分类与阅读体验，提升信息获取效率。',
    tags: ['Figma', 'PS'],
    date: '2023年01月20日'
  },
  {
    cover: '../img/covers/cover3.jpg',
    alt: '金融理财App',
    title: '金融理财App用户体验优化',
    stars: 5,
    description: '优化投资流程与风险提示，提升用户信任度。',
    tags: ['Figma', 'After Effects'],
    date: '2022年12月15日'
  },
  {
    cover: '../img/covers/cover4.jpg',
    alt: '外卖配送App',
    title: '外卖配送App流程设计',
    stars: 4,
    description: '优化下单与配送跟踪流程，提升配送效率。',
    tags: ['墨刀', 'Figma'],
    date: '2022年11月22日'
  },
  {
    cover: '../img/covers/cover5.jpg',
    alt: '直播平台设计',
    title: '直播平台互动设计',
    stars: 4,
    description: '优化直播间互动与礼物系统，提升用户参与度。',
    tags: ['Figma', 'Principle'],
    date: '2022年10月30日'
  },
  {
    cover: '../img/covers/cover6.jpg',
    alt: '招聘平台设计',
    title: '招聘平台信息架构设计',
    stars: 5,
    description: '优化职位搜索与简历投递，提升匹配效率。',
    tags: ['Figma', 'Sketch'],
    date: '2022年09月18日'
  },
  {
    cover: '../img/covers/cover1.jpg',
    alt: '短视频App设计',
    title: '短视频App交互设计',
    stars: 4,
    description: '优化视频浏览与上传流程，提升内容创作体验。',
    tags: ['Figma', 'After Effects'],
    date: '2022年08月25日'
  },
  {
    cover: '../img/covers/cover2.jpg',
    alt: '运动健身App',
    title: '运动健身App界面设计',
    stars: 4,
    description: '优化训练计划与数据记录，提升运动激励效果。',
    tags: ['Sketch', 'Figma'],
    date: '2022年07月12日'
  },
  {
    cover: '../img/covers/cover3.jpg',
    alt: '知识付费平台',
    title: '知识付费平台设计',
    stars: 5,
    description: '优化课程购买与学习路径，提升知识获取体验。',
    tags: ['Figma', 'Illustrator'],
    date: '2022年06月20日'
  },
  {
    cover: '../img/covers/cover4.jpg',
    alt: '社区团购App',
    title: '社区团购App用户体验设计',
    stars: 4,
    description: '优化团购流程与商品展示，提升购买转化率。',
    tags: ['墨刀', 'Figma'],
    date: '2022年05月28日'
  },
  {
    cover: '../img/covers/cover5.jpg',
    alt: '智能家居App',
    title: '智能家居App控制界面设计',
    stars: 5,
    description: '优化设备控制与场景联动，提升智能生活体验。',
    tags: ['Figma', 'Principle'],
    date: '2022年04月15日'
  },
  {
    cover: '../img/covers/cover6.jpg',
    alt: '汽车服务App',
    title: '汽车服务App设计',
    stars: 4,
    description: '优化预约保养与故障报修流程，提升服务效率。',
    tags: ['Adobe XD', 'Figma'],
    date: '2022年03月22日'
  }
];

