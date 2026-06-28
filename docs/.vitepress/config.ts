import { defineConfig } from 'vitepress'

const beianLink =
  '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">浙ICP备2024112356号</a>'

export default defineConfig({
  title: 'Fand',
  description: 'Official documentation for the Fand Minecraft server and plugin API.',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/icon.png' }]
  ],
  locales: {
    root: {
      label: 'Languages',
      lang: 'zh-CN',
      title: 'Fand',
      description: 'Official documentation for Fand.',
      themeConfig: {
        nav: [
          { text: '简体中文', link: '/cn/' },
          { text: 'English', link: '/en/' },
          { text: 'GitHub', link: 'https://github.com/FandMC/FandDocs' }
        ],
        footer: {
          message: 'Released under the GPL-3.0 license.',
          copyright: `Copyright FandMC · ${beianLink}`
        }
      }
    },
    cn: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Fand',
      description: 'Fand 现代化 Minecraft 插件服务端官方文档。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/cn/guide/getting-started' },
          { text: 'API', link: '/cn/api/' },
          { text: 'English', link: '/en/' },
          { text: 'GitHub', link: 'https://github.com/FandMC/FandDocs' }
        ],
        sidebar: {
          '/cn/guide/': [
            {
              text: '指南',
              items: [
                { text: '快速开始', link: '/cn/guide/getting-started' },
                { text: '插件模板', link: '/cn/guide/plugin-template' }
              ]
            }
          ],
          '/cn/api/': [
            {
              text: 'API',
              items: [
                { text: '概览', link: '/cn/api/' }
              ]
            }
          ]
        },
        outline: {
          label: '页面导航'
        },
        editLink: {
          pattern: 'https://github.com/FandMC/FandDocs/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页'
        },
        lastUpdated: {
          text: '最后更新'
        },
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        darkModeSwitchLabel: '外观',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '返回顶部',
        langMenuLabel: '切换语言',
        footer: {
          message: '基于 GPL-3.0 协议发布。',
          copyright: `Copyright FandMC · ${beianLink}`
        }
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      title: 'Fand',
      description: 'Official documentation for the Fand Minecraft server and plugin API.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/en/guide/getting-started' },
          { text: 'API', link: '/en/api/' },
          { text: '简体中文', link: '/cn/' },
          { text: 'GitHub', link: 'https://github.com/FandMC/FandDocs' }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Guide',
              items: [
                { text: 'Getting Started', link: '/en/guide/getting-started' },
                { text: 'Plugin Template', link: '/en/guide/plugin-template' }
              ]
            }
          ],
          '/en/api/': [
            {
              text: 'API',
              items: [
                { text: 'Overview', link: '/en/api/' }
              ]
            }
          ]
        },
        editLink: {
          pattern: 'https://github.com/FandMC/FandDocs/edit/main/docs/:path',
          text: 'Edit this page on GitHub'
        },
        footer: {
          message: 'Released under the GPL-3.0 license.',
          copyright: `Copyright FandMC · ${beianLink}`
        }
      }
    }
  },
  themeConfig: {
    logo: '/icon.png',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/FandMC/FandDocs' }
    ],
    search: {
      provider: 'local'
    }
  }
})
