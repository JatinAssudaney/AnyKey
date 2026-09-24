import { h } from './h';
import type { UiRoot } from './root';

export interface PickerOverlay {
  /** Outlines `element` and shows `description` beside it, or hides the outline. Call again when the page moves. */
  place(element: Element | null, description: string): void;
  /** Says something through the banner's live region, such as what a key press highlighted. */
  announce(text: string): void;
  /** Confirms a saved shortcut. The banner's button then says Done, since closing throws nothing away. */
  confirm(text: string): void;
  showBanner(visible: boolean): void;
  /** Puts the outline back above anything shown since, such as the picker's panel. */
  raise(): void;
  remove(): void;
}

/** Room the banner keeps from the viewport's edge, in px. */
const EDGE = 16;

/**
 * The picker's outline around the highlighted element and its banner of instructions. Both sit in the top layer, so
 * page overlays can't cover them, and the outline lets the pointer through.
 */
export async function createPickerOverlay(root: UiRoot, onClose: () => void): Promise<PickerOverlay> {
  const container = await root.container();
  const chip = h('span', { class: 'ak-highlight-label' });
  const outline = h('div', { class: 'ak-highlight', popover: 'manual', 'aria-hidden': 'true' }, chip);
  const status = h('p', { class: 'ak-banner-status', role: 'status' });
  const close = h('button', { type: 'button', class: 'ak-button' }, 'Cancel');
  const banner = h(
    'div',
    { class: 'ak-surface ak-banner', popover: 'manual', role: 'region', 'aria-label': 'AnyKey picker' },
    h(
      'p',
      {},
      h('strong', {}, 'Pick an element for a shortcut. '),
      'Click it, or press Tab to move and Enter to pick. ↑ selects the parent and ↓ the child. Esc closes the picker.',
    ),
    status,
    close,
  );
  close.addEventListener('click', onClose);
  container.append(outline, banner);
  banner.showPopover();

  function show(element: HTMLElement, visible: boolean): void {
    if (visible === element.matches(':popover-open')) return;
    if (visible) element.showPopover();
    else element.hidePopover();
  }

  return {
    place(element, description) {
      if (!element?.isConnected) {
        show(outline, false);
        return;
      }
      const box = element.getBoundingClientRect();
      Object.assign(outline.style, {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      if (chip.textContent !== description) chip.textContent = description;
      // The label goes above the outline, or inside it when the element starts at the top of the viewport.
      outline.classList.toggle('ak-highlight-top', box.top < 28);
      show(outline, true);
      // The banner moves to the top while the element sits where the banner would cover it.
      const height = banner.offsetHeight + EDGE * 2;
      const underBottom = box.bottom > innerHeight - height && box.top < innerHeight;
      const underTop = box.top < height && box.bottom > 0;
      banner.classList.toggle('ak-banner-top', underBottom && !underTop);
    },
    announce(text) {
      status.classList.remove('ak-banner-saved');
      status.textContent = text;
    },
    confirm(text) {
      status.classList.add('ak-banner-saved');
      status.textContent = text;
      close.textContent = 'Done';
    },
    showBanner(visible) {
      show(banner, visible);
    },
    raise() {
      if (!outline.matches(':popover-open')) return;
      outline.hidePopover();
      outline.showPopover();
    },
    remove() {
      outline.remove();
      banner.remove();
    },
  };
}
