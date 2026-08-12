export type SupportedLocale = 'en' | 'pt-BR'

export interface LanguageSelection {
  locale: SupportedLocale
  arguments_: string[]
}

export type LanguageOptionErrorReason = 'missing-value' | 'unsupported' | 'duplicate'

export class LanguageOptionError extends Error {
  constructor(
    readonly reason: LanguageOptionErrorReason,
    readonly requested?: string,
    readonly systemLocale?: string,
  ) {
    super(reason)
    this.name = 'LanguageOptionError'
  }
}

export const normalizeLocale = (candidate: string | undefined): SupportedLocale | undefined => {
  const language = candidate?.replaceAll('_', '-').split('-')[0]?.toLowerCase()
  if (language === 'en') return 'en'
  if (language === 'pt') return 'pt-BR'
  return undefined
}

const languageOption = /^--lang(?:=(.*))?$/

export const resolveLanguage = (
  arguments_: readonly string[],
  systemLocale: string = Intl.DateTimeFormat().resolvedOptions().locale,
): LanguageSelection => {
  const remaining: string[] = []
  let explicitLocale: SupportedLocale | undefined
  let explicitOptionSeen = false

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]
    if (argument === undefined) continue
    if (argument === '--lang') {
      if (explicitOptionSeen) {
        throw new LanguageOptionError('duplicate', undefined, systemLocale)
      }
      explicitOptionSeen = true
      const requested = arguments_[index + 1]
      if (requested === undefined || requested === '' || requested.startsWith('--')) {
        throw new LanguageOptionError('missing-value', requested, systemLocale)
      }
      const normalized = normalizeLocale(requested)
      if (normalized === undefined) {
        throw new LanguageOptionError('unsupported', requested, systemLocale)
      }
      explicitLocale = normalized
      index += 1
      continue
    }

    const equalsMatch = languageOption.exec(argument)
    if (equalsMatch !== null) {
      if (explicitOptionSeen) {
        throw new LanguageOptionError('duplicate', equalsMatch[1], systemLocale)
      }
      explicitOptionSeen = true
      const requested = equalsMatch[1]
      if (requested === undefined || requested === '') {
        throw new LanguageOptionError('missing-value', requested, systemLocale)
      }
      const normalized = normalizeLocale(requested)
      if (normalized === undefined) {
        throw new LanguageOptionError('unsupported', requested, systemLocale)
      }
      explicitLocale = normalized
      continue
    }

    remaining.push(argument)
  }

  return {
    locale: explicitLocale ?? normalizeLocale(systemLocale) ?? 'en',
    arguments_: remaining,
  }
}
