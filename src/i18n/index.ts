import { createInstance, type TFunction } from 'i18next'

import type { SupportedLocale } from './locale.js'
import { en } from './resources/en.js'
import { ptBR } from './resources/pt-BR.js'

export interface Translator {
  locale: SupportedLocale
  t: TFunction<'translation'>
}

export const createTranslator = async (locale: SupportedLocale): Promise<Translator> => {
  const instance = createInstance()
  await instance.init({
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-BR'],
    resources: {
      en: { translation: en },
      'pt-BR': { translation: ptBR },
    },
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  return { locale, t: instance.getFixedT(locale, 'translation') }
}
