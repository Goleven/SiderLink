import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useFavoritesStore } from '../stores/favorites'

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

  async function markCompleted() {
    if (store.settings.hasCompletedTour) return
    try {
      await store.patchSettings({ hasCompletedTour: true })
    } catch {
      /* ignore persist failures; tour already ended */
    }
  }

  function buildSteps(): DriveStep[] {
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
          side: 'left',
          align: 'start',
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
        },
      },
      {
        popover: {
          title: t('tour.globalSearchTitle'),
          description: t('tour.globalSearchDesc'),
        },
      },
    ]
  }

  async function maybeStart() {
    if (running) return
    if (store.loading) return
    if (store.settings.hasCompletedTour) return

    await nextTick()
    // Wait one frame so IndexBar / list layout has settled in the narrow panel.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    if (store.settings.hasCompletedTour) return
    if (
      !document.querySelector('[data-tour="bookmark-list"]') ||
      !document.querySelector('[data-tour="index-bar"]')
    ) {
      return
    }

    running = true
    const tour = driver({
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
        void markCompleted()
      },
    })

    tour.drive()
  }

  return { maybeStart }
}
