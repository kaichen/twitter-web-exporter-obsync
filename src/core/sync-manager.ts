import { Signal } from '@preact/signals';
import { options } from '@/core/options';
import extensionManager from '@/core/extensions';
import { db } from '@/core/database';
import { syncHomeTimelineToObsidian } from '@/utils/sync';
import { OBSIDIAN_API_TOKEN } from '@/utils/obsidian';
import logger from '@/utils/logger';

const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 180;

/**
 * Manages automated Home Timeline sync to Obsidian.
 * Subscribes to option/extension changes and schedules periodic syncs.
 */
class SyncManager {
  private timerId: number | null = null;
  private inFlight = false;
  private tokenWarningLogged = false;

  /**
   * Signal for UI to observe sync state.
   */
  public signal = new Signal(0);

  /**
   * Initialize the scheduler. Call this once after app mount.
   */
  public start() {
    logger.debug('SyncManager started');
    this.subscribeToChanges();
    this.reschedule();
  }

  /**
   * Clean up resources.
   */
  public dispose() {
    this.clearTimer();
    logger.debug('SyncManager disposed');
  }

  /**
   * Subscribe to option and extension changes to reschedule as needed.
   */
  private subscribeToChanges() {
    options.signal.subscribe(() => {
      this.reschedule();
    });

    extensionManager.signal.subscribe(() => {
      this.reschedule();
    });
  }

  /**
   * Determine if auto-sync should run based on current configuration.
   */
  private shouldRun(): boolean {
    if (!options.get('homeTimelineAutoSyncEnabled', false)) {
      return false;
    }

    if (!OBSIDIAN_API_TOKEN) {
      if (!this.tokenWarningLogged) {
        logger.warn('Auto-sync disabled: Obsidian API token not configured');
        this.tokenWarningLogged = true;
      }
      return false;
    }

    const homeModule = extensionManager
      .getExtensions()
      .find((ext) => ext.name === 'HomeTimelineModule');
    if (!homeModule?.enabled) {
      return false;
    }

    return true;
  }

  /**
   * Clamp interval to valid range.
   */
  private getIntervalMs(): number {
    const minutes = options.get('homeTimelineAutoSyncIntervalMinutes', 15) ?? 15;
    const clamped = Math.max(MIN_INTERVAL_MINUTES, Math.min(MAX_INTERVAL_MINUTES, minutes));
    return clamped * 60 * 1000;
  }

  /**
   * Clear any existing timer.
   */
  private clearTimer() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Reschedule the timer based on current configuration.
   */
  private reschedule() {
    this.clearTimer();

    if (!this.shouldRun()) {
      logger.debug('Auto-sync not active (conditions not met)');
      return;
    }

    const intervalMs = this.getIntervalMs();
    logger.info(`Auto-sync scheduled: every ${intervalMs / 60000} minutes`);

    // Run immediately on first schedule, then at intervals
    this.tick();

    this.timerId = window.setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  /**
   * Execute a single sync tick with guards.
   */
  private async tick() {
    if (this.inFlight) {
      logger.debug('Auto-sync skipped: sync already in flight');
      return;
    }

    if (document.visibilityState !== 'visible') {
      logger.debug('Auto-sync skipped: page not visible');
      return;
    }

    if (!navigator.onLine) {
      logger.debug('Auto-sync skipped: browser offline');
      return;
    }

    const lastSyncAt = options.get('homeTimelineLastSyncAt') ?? null;
    if (lastSyncAt !== null) {
      const newCaptures = await db.extGetCapturesSince('HomeTimelineModule', lastSyncAt);
      if (!newCaptures || newCaptures.length === 0) {
        logger.debug('Auto-sync skipped: no new captures since last sync');
        return;
      }
    }

    this.inFlight = true;
    this.signal.value++;

    try {
      logger.info('Auto-sync started');
      const result = await syncHomeTimelineToObsidian(undefined, lastSyncAt);

      if (result.synced > 0 || result.skipped > 0) {
        logger.info(
          `Auto-sync complete: synced=${result.synced}, skipped=${result.skipped}, files=${result.files}`,
        );
      } else {
        logger.debug('Auto-sync complete: nothing to sync');
      }

      if (result.errors.length > 0) {
        logger.warn(`Auto-sync had ${result.errors.length} errors:`, result.errors);
      }

      options.set('homeTimelineLastSyncAt', Date.now());
    } catch (error) {
      logger.error('Auto-sync failed:', error);
    } finally {
      this.inFlight = false;
      this.signal.value++;
    }
  }
}

export const syncManager = new SyncManager();
