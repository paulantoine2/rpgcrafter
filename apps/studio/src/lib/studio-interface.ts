export type StudioInterface = 'modern' | 'rpgMakerMz';

export const studioInterfaceStorageKey = 'rpgcrafter.studio.interface';
export const studioInterfaceChangeEvent = 'studio-interface-change';

export function readStudioInterface(storage: Pick<Storage, 'getItem'> = window.localStorage): StudioInterface {
  try {
    const value = storage.getItem(studioInterfaceStorageKey);
    return value === 'rpgMakerMz' || value === 'modern' ? value : 'modern';
  } catch {
    return 'modern';
  }
}

export function writeStudioInterface(value: StudioInterface, storage: Pick<Storage, 'setItem'> = window.localStorage) {
  try {
    storage.setItem(studioInterfaceStorageKey, value);
  } catch {
    // The interface can still be changed for this session when storage is unavailable.
  }
}

export function applyStudioInterface(value: StudioInterface, root: HTMLElement = document.documentElement) {
  root.dataset.studioInterface = value;
  root.dispatchEvent(new Event(studioInterfaceChangeEvent));
}
