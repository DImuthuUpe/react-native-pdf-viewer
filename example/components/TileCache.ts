import { SkData } from '@shopify/react-native-skia';
import { LRUMap } from 'lru_map';

class LRUMapWithCallback extends LRUMap {
  constructor(maxSize: number) {
    super(maxSize);
  }

  set(key: string, value: SkData) {
    if (this.size >= this.limit) {
      const oldestKey = this.keys().next().value; // Get the oldest (least recently used) key
      const oldestValue = this.get(oldestKey);
      oldestValue?.dispose(); // Dispose of the oldest value
    }
    super.set(key, value); // Call the parent `set` method
  }
}

export default LRUMapWithCallback;