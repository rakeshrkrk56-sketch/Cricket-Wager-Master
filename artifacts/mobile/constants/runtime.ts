import Constants from 'expo-constants';

function normalizeDomain(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

export const apiDomain =
  normalizeDomain(process.env.EXPO_PUBLIC_DOMAIN) ||
  normalizeDomain(Constants.expoConfig?.extra?.apiDomain);

export const apiBaseUrl = apiDomain ? `https://${apiDomain}` : '';