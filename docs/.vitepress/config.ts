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
                { text: '插件模板', link: '/cn/guide/plugin-template' },
                { text: '插件描述文件', link: '/cn/guide/plugin-json' }
              ]
            }
          ],
          '/cn/api/': [
            {
              text: 'API',
              items: [
                { text: '概览', link: '/cn/api/' },
                { text: '插件生命周期', link: '/cn/api/plugin-lifecycle' },
                { text: '事件', link: '/cn/api/events' },
                { text: '命令', link: '/cn/api/commands' },
                { text: '调度器', link: '/cn/api/scheduler' },
                { text: '配置', link: '/cn/api/configuration' },
                { text: '权限', link: '/cn/api/permissions' },
                { text: '服务注册', link: '/cn/api/services' },
                { text: '世界', link: '/cn/api/worlds' },
                { text: '实体', link: '/cn/api/entities' },
                { text: '玩家', link: '/cn/api/players' },
                { text: '方块', link: '/cn/api/blocks' },
                { text: '物品', link: '/cn/api/items' },
                { text: '组件', link: '/cn/api/components' },
                { text: '区域', link: '/cn/api/regions' },
                { text: '数据包', link: '/cn/api/packets' },
                { text: '占位符与 MiniMessage', link: '/cn/api/placeholders' },
                { text: 'GUI', link: '/cn/api/gui' },
                { text: '记分板', link: '/cn/api/scoreboard' },
                { text: '玩家表现', link: '/cn/api/presentation' }
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
                { text: 'Plugin Template', link: '/en/guide/plugin-template' },
                { text: 'Plugin Descriptor', link: '/en/guide/plugin-json' }
              ]
            }
          ],
          '/en/api/': [
            {
              text: 'API',
              items: [
                { text: 'Overview', link: '/en/api/' },
                { text: 'Plugin Lifecycle', link: '/en/api/plugin-lifecycle' },
                { text: 'Events', link: '/en/api/events' },
                { text: 'Commands', link: '/en/api/commands' },
                { text: 'Scheduler', link: '/en/api/scheduler' },
                { text: 'Configuration', link: '/en/api/configuration' },
                { text: 'Permissions', link: '/en/api/permissions' },
                { text: 'Services', link: '/en/api/services' },
                { text: 'Worlds', link: '/en/api/worlds' },
                { text: 'Entities', link: '/en/api/entities' },
                { text: 'Players', link: '/en/api/players' },
                { text: 'Blocks', link: '/en/api/blocks' },
                { text: 'Items', link: '/en/api/items' },
                { text: 'Components', link: '/en/api/components' },
                { text: 'Regions', link: '/en/api/regions' },
                { text: 'Packets', link: '/en/api/packets' },
                { text: 'Placeholders and MiniMessage', link: '/en/api/placeholders' },
                { text: 'GUI', link: '/en/api/gui' },
                { text: 'Scoreboards', link: '/en/api/scoreboard' },
                { text: 'Player Presentation', link: '/en/api/presentation' }
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
