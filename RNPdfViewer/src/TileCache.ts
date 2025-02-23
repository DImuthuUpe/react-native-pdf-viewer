import { SkImage } from "@shopify/react-native-skia";


const initTileCache = (page: number, scale: number) => {
    "worklet";
    if (global.skImageCache == null) {
        global.skImageCache = {};
    }

    if (global.skImageCache[page] == null) {
    global.skImageCache[page] = {};
    }  

    if (global.skImageCache[page][scale] == null) {
    global.skImageCache[page][scale] = {};
    }  
}
export const getTileFromCache = (page: number, scale: number, gridLocation: string) => {
    "worklet";
    initTileCache(page, scale);
    return global.skImageCache[page][scale]?.[gridLocation];
  }

export const setTileInCache = (page: number, scale: number, gridLocation: string, img: SkImage) => {
    "worklet";
    initTileCache(page, scale); 
    global.skImageCache[page][scale][gridLocation] = img;
}

export const cleanUpOutofScaleTiles = (page: number, currentScale: number) => {
    "worklet";
    if (global.skImageCache == null) {
        return
    }

    if (global.skImageCache[page] == null) {
        return
    }

    const scales = Object.keys(global.skImageCache[page]);
    for (let i = 0; i < scales.length; i++) {
        if (scales[i] != currentScale) {
            const gridLocations = Object.keys(global.skImageCache[page][scales[i]]);
            for (let j = 0; j < gridLocations.length; j++) {
                global.skImageCache[page][scales[i]][gridLocations[j]].dispose();
                delete global.skImageCache[page][scales[i]][gridLocations[j]];
            }
            delete global.skImageCache[page][scales[i]];
        }
    }
}

export const deleteAllTilesFromCacheForPage = (page: number) => {
    "worklet";
    if (global.skImageCache == null) {
      return
    }
    if (global.skImageCache[page] != null) {
        const scales = Object.keys(global.skImageCache[page]);
        console.log("deleting all tiles for page: " + page);
        for (let i = 0; i < scales.length; i++) {

            const gridLocations = Object.keys(global.skImageCache[page][scales[i]]);
            for (let j = 0; j < gridLocations.length; j++) {
                global.skImageCache[page][scales[i]][gridLocations[j]].dispose();
                delete global.skImageCache[page][scales[i]][gridLocations[j]];
            }
            delete global.skImageCache[page][scales[i]];
        }
        delete global.skImageCache[page];
        global.gc();
    }
}   