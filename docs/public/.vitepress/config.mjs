import {defineConfig} from 'vitepress'

export default defineConfig({
  title: 'Harness Kit',
  description: 'Connect coding agents to existing projects, preserve their workflow, and verify real changes.',
  lang: 'zh-CN',
  base: '/harness-kit/',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: '/logo-mark.svg',
    siteTitle: 'Harness Kit',
    nav: [
      {text: '开始使用', link: '/guides/installation'},
      {text: '工作流', link: '/guides/usage'},
      {text: '参考', link: '/reference/capabilities'},
      {text: '版本', link: '/releases/v0.7.0'},
      {text: 'GitHub', link: 'https://github.com/abcde1239/harness-kit'}
    ],
    sidebar: {
      '/guides/': [
        {text: '开始使用', items: [
          {text: '安装指南', link: '/guides/installation'},
          {text: '快速开始', link: '/guides/quickstart'},
          {text: '使用指南', link: '/guides/usage'}
        ]},
        {text: '工作流', items: [
          {text: '编码习惯提炼', link: '/guides/coding-style'}
        ]}
      ],
      '/reference/': [
        {text: '概念', items: [
          {text: '能力与适用范围', link: '/reference/capabilities'},
          {text: 'CLI 与 Skill', link: '/reference/cli-and-skill'}
        ]},
        {text: '配置与适配', items: [
          {text: '技术适配器', link: '/reference/adapters'},
          {text: '配置与调用', link: '/reference/configuration'},
          {text: '目标项目布局', link: '/reference/project-layout'}
        ]},
        {text: '协作与任务', items: [
          {text: '持久任务与验收', link: '/reference/tasks'},
          {text: '多 Agent 协作', link: '/reference/collaboration'},
          {text: '职责角色', link: '/reference/roles'}
        ]},
        {text: '发布边界', items: [
          {text: '公开与内部资料边界', link: '/reference/publication-boundary'}
        ]}
      ],
      '/releases/': [
        {text: '版本说明', items: [
          {text: 'v0.7.0', link: '/releases/v0.7.0'},
          {text: 'v0.6.0', link: '/releases/v0.6.0'},
          {text: 'v0.5.0', link: '/releases/v0.5.0'}
        ]}
      ]
    },
    socialLinks: [
      {icon: 'github', link: 'https://github.com/abcde1239/harness-kit'}
    ],
    search: {provider: 'local'},
    editLink: {
      pattern: 'https://github.com/abcde1239/harness-kit/edit/main/docs/public/:path'
    },
    footer: {
      message: 'Project-first onboarding and evidence-based verification for coding agents.',
      copyright: 'Harness Kit · Open-source project documentation'
    }
  },
  head: [
    ['meta', {name: 'theme-color', content: '#2563eb'}],
    ['link', {rel: 'icon', href: '/harness-kit/logo-mark.svg'}]
  ]
})
