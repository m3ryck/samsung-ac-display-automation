import 'i18next'

import type { en } from './resources/en.js'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    strictKeyChecks: true
    resources: {
      translation: typeof en
    }
  }
}
