type RequiredEnvName = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY';

export function getRequiredEnv(name: RequiredEnvName): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
