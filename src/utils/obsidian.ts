import { GM_xmlhttpRequest } from '$';
import logger from '@/utils/logger';

export const OBSIDIAN_API_BASE_URL = __OBSIDIAN_API_BASE_URL__;
export const OBSIDIAN_API_TOKEN = __OBSIDIAN_API_TOKEN__;
export const OBSIDIAN_DEFAULT_FOLDER = 'Tweets';

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
  if (!OBSIDIAN_API_TOKEN) {
    throw new Error('Missing OBSIDIAN_API_TOKEN. Set env var and rebuild.');
  }
}

function request(method: 'GET' | 'PUT', path: string, data?: string) {
  assertToken();

  const baseUrl = OBSIDIAN_API_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}${path}`;

  return new Promise<ObsidianResponse>((resolve, reject) => {
    GM_xmlhttpRequest({
      method,
      url,
      headers: {
        Authorization: `Bearer ${OBSIDIAN_API_TOKEN}`,
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
