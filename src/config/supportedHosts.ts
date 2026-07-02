// Hosts the overlay content script runs on. Keep these in sync with the
// `matches` and `host_permissions` entries in public/manifest.json.
export const SUPPORTED_QUESTION_BANK_HOSTS = [
  'satsuiteeducatorquestionbank.collegeboard.org'
] as const;

export const SUPPORTED_QUESTION_BANK_MATCHES = SUPPORTED_QUESTION_BANK_HOSTS.map(
  (host) => `https://${host}/*`
);

export function isSupportedQuestionBankHost(hostname: string): boolean {
  return (SUPPORTED_QUESTION_BANK_HOSTS as readonly string[]).includes(hostname);
}
