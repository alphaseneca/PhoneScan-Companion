import {NativeEventEmitter, type NativeModule} from 'react-native';

type EventEmitterNativeModule = NativeModule & {
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

/**
 * Build a NativeEventEmitter that satisfies RN's addListener/removeListeners
 * contract. Native modules should implement matching no-op @ReactMethods;
 * these stubs cover binaries that have not been rebuilt yet.
 */
export function createModuleEventEmitter(
  nativeModule: EventEmitterNativeModule | null | undefined,
): NativeEventEmitter {
  if (nativeModule != null) {
    if (typeof nativeModule.addListener !== 'function') {
      nativeModule.addListener = () => undefined;
    }
    if (typeof nativeModule.removeListeners !== 'function') {
      nativeModule.removeListeners = () => undefined;
    }
  }

  return new NativeEventEmitter(nativeModule ?? undefined);
}
