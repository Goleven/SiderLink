import { describe, it, expect, beforeAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AppSelect from '@/sidepanel/components/AppSelect.vue'

vi.mock('motion', () => ({
  animate: (el: HTMLElement, keyframes: Record<string, string | number>) => {
    if (keyframes.opacity != null) el.style.opacity = String(keyframes.opacity)
    if (typeof keyframes.transform === 'string') {
      el.style.transform = keyframes.transform
    }
    return {
      stop() {},
      finished: Promise.resolve(),
    }
  },
}))

const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

async function settle() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

describe('AppSelect', () => {
  it('shows selected label on the trigger', () => {
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'b' },
    })
    expect(wrapper.find('.trigger').text()).toContain('Beta')
  })

  it('opens listbox and emits update on option click', async () => {
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'a' },
    })
    await wrapper.find('.trigger').trigger('click')
    await settle()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
    await wrapper.findAll('[role="option"]')[1].trigger('pointerdown')
    await settle()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it('stays closed after select when wrapped in a label', async () => {
    const host = document.createElement('label')
    document.body.appendChild(host)
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'a' },
      attachTo: host,
    })
    await wrapper.find('.trigger').trigger('click')
    await settle()
    await wrapper.findAll('[role="option"]')[1].trigger('pointerdown')
    await settle()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    wrapper.unmount()
    host.remove()
  })

  it('closes on Escape without emitting', async () => {
    const wrapper = mount(AppSelect, {
      props: { options, modelValue: 'a' },
      attachTo: document.body,
    })
    await wrapper.find('.trigger').trigger('click')
    await settle()
    await wrapper.find('.trigger').trigger('keydown', { key: 'Escape' })
    await settle()
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('flips the menu above when there is no room below', async () => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 200,
    })
    const host = document.createElement('div')
    host.style.cssText =
      'position:fixed;left:0;top:140px;width:280px;padding:0;margin:0'
    document.body.appendChild(host)

    const wrapper = mount(AppSelect, {
      props: {
        options: [
          ...options,
          { value: 'c', label: 'Gamma' },
          { value: 'd', label: 'Delta' },
        ],
        modelValue: 'a',
      },
      attachTo: host,
    })

    const trigger = wrapper.find('.trigger').element as HTMLElement
    trigger.getBoundingClientRect = () =>
      ({
        top: 140,
        bottom: 180,
        left: 0,
        right: 280,
        width: 280,
        height: 40,
        x: 0,
        y: 140,
        toJSON: () => ({}),
      }) as DOMRect

    await wrapper.find('.trigger').trigger('click')
    await settle()

    expect(wrapper.find('.menu').classes()).toContain('above')
    wrapper.unmount()
    host.remove()
  })
})
