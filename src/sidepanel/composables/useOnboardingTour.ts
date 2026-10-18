import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useFavoritesStore } from '../stores/favorites'

type TourSettingsHost = {
  openSettings: () => void
  closeSettings: () => void
}

let settingsHost: TourSettingsHost | null = null

/** App owns the settings sheet; the tour opens and closes it between steps. */
export function bindOnboardingTourSettings(host: TourSettingsHost) {
  settingsHost = host
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function raf() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

async function waitForSelector(selector: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return true
    await delay(40)
  }
  return Boolean(document.querySelector(selector))
}

async function openSettingsForTour() {
  settingsHost?.openSettings()
  const ready = await waitForSelector('[data-tour="settings-open-mode"]', 2000)
  if (!ready) return false
  // Settings slides in for 0.4s; measure the spotlight after it settles.
  await delay(prefersReducedMotion() ? 32 : 480)
  await nextTick()
  await raf()
  return true
}

async function closeSettingsForTour() {
  settingsHost?.closeSettings()
  const deadline = Date.now() + 1500
  while (Date.now() < deadline && document.querySelector('.settings')) {
    await delay(40)
  }
  await nextTick()
  await raf()
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * First-run Driver.js tour for the side panel main list.
 * Completing, skipping, or closing marks `settings.hasCompletedTour`.
 */
export function useOnboardingTour() {
  const { t } = useI18n()
  const store = useFavoritesStore()
  let running = false
  let alive = false

  async function markCompleted() {
    if (store.settings.hasCompletedTour) return
    try {
      await store.patchSettings({ hasCompletedTour: true })
    } catch {
      /* ignore persist failures; tour already ended */
    }
  }

  let navigating = false

  async function go(driverApi: Driver, action: () => Promise<boolean>) {
    if (navigating) return
    navigating = true
    try {
      if ((await action()) && alive) driverApi.moveNext()
    } finally {
      navigating = false
    }
  }

  async function back(driverApi: Driver, action: () => Promise<boolean | void>) {
    if (navigating) return
    navigating = true
    try {
      if ((await action()) !== false && alive) driverApi.movePrevious()
    } finally {
      navigating = false
    }
  }

  function settingsSection(
    id: string,
    title: string,
    description: string,
  ): DriveStep {
    return {
      element: `[data-tour="${id}"]`,
      popover: {
        title,
        description,
        side: 'bottom',
        align: 'center',
      },
    }
  }

  function buildSteps(): DriveStep[] {
    const openMode = settingsSection(
      'settings-open-mode',
      t('tour.openModeTitle'),
      t('tour.openModeDesc'),
    )
    openMode.popover!.onPrevClick = (_el, _step, { driver: driverApi }) => {
      void back(driverApi, closeSettingsForTour)
    }

    const sync = settingsSection(
      'settings-sync',
      t('tour.syncTitle'),
      t('tour.syncDesc'),
    )
    sync.popover!.onNextClick = (_el, _step, { driver: driverApi }) => {
      void go(driverApi, async () => {
        await closeSettingsForTour()
        return true
      })
    }

    return [
      {
        popover: {
          title: t('tour.welcomeTitle'),
          description: t('tour.welcomeDesc'),
        },
      },
      {
        element: '[data-tour="bookmark-list"]',
        popover: {
          title: t('tour.listTitle'),
          description: t('tour.listDesc'),
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="index-bar"]',
        popover: {
          title: t('tour.indexTitle'),
          description: t('tour.indexDesc'),
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-dock-id="__add"]',
        popover: {
          title: t('tour.addTitle'),
          description: t('tour.addDesc'),
          side: 'right',
          align: 'end',
        },
      },
      {
        element: '[data-dock-id="__settings"]',
        popover: {
          title: t('tour.settingsTitle'),
          description: t('tour.settingsDesc'),
          side: 'right',
          align: 'end',
          onNextClick: (_el, _step, { driver: driverApi }) => {
            void go(driverApi, openSettingsForTour)
          },
        },
      },
      openMode,
      settingsSection(
        'settings-theme',
        t('tour.themeTitle'),
        t('tour.themeDesc'),
      ),
      settingsSection(
        'settings-background',
        t('tour.backgroundTitle'),
        t('tour.backgroundDesc'),
      ),
      settingsSection(
        'settings-language',
        t('tour.languageTitle'),
        t('tour.languageDesc'),
      ),
      settingsSection(
        'settings-groups',
        t('tour.groupsTitle'),
        t('tour.groupsDesc'),
      ),
      sync,
      {
        popover: {
          title: t('tour.globalSearchTitle'),
          description: t('tour.globalSearchDesc'),
          onPrevClick: (_el, _step, { driver: driverApi }) => {
            void back(driverApi, openSettingsForTour)
          },
        },
      },
    ]
  }

  async function drive(force: boolean) {
    if (running) return
    if (store.loading) return
    if (!force && store.settings.hasCompletedTour) return

    running = true
    try {
      await nextTick()
      // Wait one frame so IndexBar / list layout has settled in the narrow panel.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      if (
        (!force && store.settings.hasCompletedTour) ||
        !document.querySelector('[data-tour="bookmark-list"]') ||
        !document.querySelector('[data-tour="index-bar"]')
      ) {
        running = false
        return
      }
    } catch (error) {
      running = false
      throw error
    }

    let tour: ReturnType<typeof driver>
    try {
      tour = driver({
        animate: !prefersReducedMotion(),
        allowClose: true,
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 12,
        popoverOffset: 10,
        popoverClass: 'sider-tour-popover',
        showProgress: true,
        progressText: t('tour.progress'),
        nextBtnText: t('tour.next'),
        prevBtnText: t('tour.prev'),
        doneBtnText: t('tour.done'),
        disableActiveInteraction: true,
        steps: buildSteps(),
        onDestroyStarted: (_el, _step, { driver: d }) => {
          d.destroy()
        },
        onDestroyed: () => {
          running = false
          alive = false
          settingsHost?.closeSettings()
          void markCompleted()
        },
      })
    } catch (error) {
      running = false
      throw error
    }

    alive = true
    tour.drive()
  }

  function maybeStart() {
    return drive(false)
  }

  /** Start even after the first-run tour has already been completed. */
  function replay() {
    return drive(true)
  }

  return { maybeStart, replay }
}
