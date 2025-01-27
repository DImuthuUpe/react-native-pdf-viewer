import { SkData, SkImage } from '@shopify/react-native-skia';
import { LRUMap } from 'lru_map';

class TileCache {
    limit: number;
    tileSize: number;
    cache: Map<string, [SkData, SkImage]>;


    constructor(limit: number, tileSize: number) {
        this.limit = limit;
        this.tileSize = tileSize;
        this.cache = new Map();
    }
    
    // Key is in format ${pageNumber}-${scale}-${tileRow}-${tileCol}
    set(key: string, value: [SkData, SkImage]) {
        if (this.cache.size >= this.limit) {

            // remove the key with furtherst distance from current page
            const currentPage = Number(key.split('-')[0])
            let furthestKey = ''
            let furthestDistance = 0;

            for (let k of this.cache.keys()) {
                const page = Number(k.split('-')[0])
                if (Math.abs(currentPage - page) > furthestDistance) {
                    furthestKey = k;
                    furthestDistance = Math.abs(currentPage - page);
                }
            }

            this.cache.get(furthestKey)?.[0].dispose();
            this.cache.delete(furthestKey);
        }
        this.cache.set(key, value);
    }

    get(key: string): [SkData, SkImage] | undefined {
        return this.cache.get(key);
    }
}

export default TileCache;