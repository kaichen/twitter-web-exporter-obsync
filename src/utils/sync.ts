import { db } from '@/core/database';
import { Tweet } from '@/types';
import {
  extractQuotedTweet,
  extractRetweetedTweet,
  extractTweetFullText,
  extractTweetMedia,
  getMediaOriginalUrl,
  getTweetURL,
} from '@/utils/api';
import { formatDateTime, parseTwitterDateTime } from '@/utils/common';
import logger from '@/utils/logger';

import { OBSIDIAN_DEFAULT_FOLDER, getVaultFile, putVaultFile } from './obsidian';

type ObsidianTweet = {
  id: string;
  created_at: string;
  screen_name: string;
  name: string;
  text: string;
  url: string;
  media: string[];
  metrics: {
    favorites: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    views: number | null;
  };
  context: {
    in_reply_to: string | null;
    retweeted_status: string | null;
    quoted_status: string | null;
  };
  source: 'home_timeline';
};

export type SyncSummary = {
  total: number;
  synced: number;
  skipped: number;
  files: number;
  errors: string[];
};

function isOkStatus(status: number) {
  return status >= 200 && status < 300;
}

function toObsidianTweet(tweet: Tweet): ObsidianTweet {
  const createdAt = parseTwitterDateTime(tweet.legacy.created_at);
  const createdAtIso = createdAt.isValid() ? createdAt.toISOString() : new Date(0).toISOString();
  const retweeted = extractRetweetedTweet(tweet);
  const quoted = extractQuotedTweet(tweet);

  return {
    id: tweet.rest_id,
    created_at: createdAtIso,
    screen_name: tweet.core.user_results.result.core.screen_name,
    name: tweet.core.user_results.result.core.name,
    text: extractTweetFullText(tweet),
    url: getTweetURL(tweet),
    media: extractTweetMedia(tweet).map((media) => getMediaOriginalUrl(media)),
    metrics: {
      favorites: tweet.legacy.favorite_count,
      retweets: tweet.legacy.retweet_count,
      replies: tweet.legacy.reply_count,
      quotes: tweet.legacy.quote_count,
      bookmarks: tweet.legacy.bookmark_count,
      views: typeof tweet.views?.count === 'undefined' ? null : +tweet.views.count,
    },
    context: {
      in_reply_to: tweet.legacy.in_reply_to_status_id_str ?? null,
      retweeted_status: retweeted?.rest_id ?? null,
      quoted_status: quoted?.rest_id ?? null,
    },
    source: 'home_timeline',
  };
}

function extractExistingIds(content: string) {
  const ids = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as { id?: string | number };
      if (parsed?.id !== undefined && parsed?.id !== null) {
        ids.add(String(parsed.id));
      }
    } catch (error) {
      logger.debug('Failed to parse JSONL line', error);
    }
  }

  return ids;
}

export async function syncHomeTimelineToObsidian(
  folder: string = OBSIDIAN_DEFAULT_FOLDER,
): Promise<SyncSummary> {
  const tweets = (await db.extGetCapturedTweets('HomeTimelineModule')) ?? [];
  const summary: SyncSummary = {
    total: tweets.length,
    synced: 0,
    skipped: 0,
    files: 0,
    errors: [],
  };

  if (!tweets.length) {
    return summary;
  }

  const buckets = new Map<string, ObsidianTweet[]>();

  for (const tweet of tweets) {
    const dateKey = formatDateTime(parseTwitterDateTime(tweet.legacy.created_at), 'YYYY-MM-DD');
    const items = buckets.get(dateKey) ?? [];
    items.push(toObsidianTweet(tweet));
    buckets.set(dateKey, items);
  }

  for (const [dateKey, items] of buckets) {
    const path = `${folder}/${dateKey}.jsonl`;
    let existingContent = '';

    try {
      const response = await getVaultFile(path);
      if (response.status === 404) {
        existingContent = '';
      } else if (isOkStatus(response.status)) {
        existingContent = response.responseText ?? '';
      } else {
        throw new Error(`GET ${path} failed (${response.status})`);
      }
    } catch (error) {
      summary.errors.push((error as Error).message);
      continue;
    }

    const existingIds = extractExistingIds(existingContent);
    const newItems = items.filter((item) => !existingIds.has(item.id));
    summary.skipped += items.length - newItems.length;

    if (!newItems.length) {
      continue;
    }

    const newLines = newItems.map((item) => JSON.stringify(item)).join('\n') + '\n';
    const combined = `${existingContent}${existingContent && !existingContent.endsWith('\n') ? '\n' : ''}${newLines}`;

    try {
      const response = await putVaultFile(path, combined);
      if (!isOkStatus(response.status)) {
        throw new Error(`PUT ${path} failed (${response.status})`);
      }
      summary.synced += newItems.length;
      summary.files += 1;
    } catch (error) {
      summary.errors.push((error as Error).message);
    }
  }

  return summary;
}
