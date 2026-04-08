import { en, type I18nKey } from './en'
import { es } from './es'

export type { I18nKey }

const strings: Record<string, Record<I18nKey, string>> = { en, es }

export function getTranslator(lang: string) {
  const dict = strings[lang] ?? en
  return function t(key: I18nKey): string {
    return dict[key] ?? en[key]
  }
}
