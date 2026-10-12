/**
 * Действующая редакция условий (Terms of Service и Refund & Cancellation).
 * Держать равной `LEGAL_VERSION` во фронтенде (`src/lib/legal.ts`): витрина
 * присылает редакцию, которую показала человеку, и заказ принимается только с
 * действующей — иначе согласие было бы дано на текст, которого уже нет.
 */
export const CURRENT_TERMS_VERSION = '12 October 2026';
