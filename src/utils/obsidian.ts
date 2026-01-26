import { GM_xmlhttpRequest } from '$';
import logger from '@/utils/logger';
import { options } from '@/core/options';

export const OBSIDIAN_DEFAULT_FOLDER = 'Tweets';

function getObsidianApiBaseUrl(): string {
  return options.get('obsidianApiBaseUrl') || __OBSIDIAN_API_BASE_URL__ || 'http://127.0.0.1:27123';
}

function getObsidianApiToken(): string {
  return options.get('obsidianApiToken') || __OBSIDIAN_API_TOKEN__ || '';
}

export type ObsidianResponse = {
  status: number;
  responseText: string;
};

function encodeVaultPath(path: string) {
  return path
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function assertToken() {
  const token = getObsidianApiToken();
  if (!token) {
    throw new Error('Missing Obsidian API Token. Configure it in Settings.');
  }
}

function request(method: 'GET' | 'PUT', path: string, data?: string) {
  assertToken();

  const baseUrl = getObsidianApiBaseUrl().replace(/\/$/, '');
  const token = getObsidianApiToken();
  const url = `${baseUrl}${path}`;

  return new Promise<ObsidianResponse>((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(data ? { 'Content-Type': 'text/plain; charset=utf-8' } : {}),
      },
      data,
      onload: (response) => {
        resolve({
          status: response.status,
          responseText: response.responseText ?? '',
        });
      },
      onerror: (error) => {
        logger.error('Obsidian request failed', error);
        reject(new Error('Obsidian request failed'));
      },
    });
  });
}

export async function getVaultFile(path: string) {
  const encodedPath = encodeVaultPath(path);
  return request('GET', `/vault/${encodedPath}`);
}

export async function putVaultFile(path: string, content: string) {
  const encodedPath = encodeVaultPath(path);
  return request('PUT', `/vault/${encodedPath}`, content);
}
