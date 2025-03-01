import { SkImage } from "@shopify/react-native-skia";


const initGlobalTileCache = (scale: number, row: number) => {
    "worklet";
    if (global.globalTileCache == null) {
        global.globalTileCache = {};
    }

    if (global.globalTileCache[scale] == null) {
        global.globalTileCache[scale] = {};
    } 

    if (global.globalTileCache[scale][row] == null) {
        global.globalTileCache[scale][row] = {};
    }
}

export const getGlobalTileFromCache = (scale: number, row: number, col: number) => {
    "worklet";
    console.log("getGlobalTileFromCache: " + scale + " " + row + " " + col);
    initGlobalTileCache(scale, row);
    return global.globalTileCache[scale][row]?.[col];
}    

export const setGlobalTileInCache = (scale: number, row: number, col: number, img: SkImage) => {
    "worklet";
    initGlobalTileCache(scale, row);
    global.globalTileCache[scale][row][col] = img;
}

export const clearGlobalTileCache = (scale: number, row: number, col: number, verticalTiles: number) => {
    "worklet";
    if (global.globalTileCache != null) {
        const scales = Object.keys(global.globalTileCache);
        for (let i = 0; i < scales.length; i++) {
            const rows = Object.keys(global.globalTileCache[scales[i]]);
            for (let j = 0; j < rows.length; j++) {
                if (Math.abs(rows[j] - row) <= verticalTiles * 2) {
                    continue;
                }
                const cols = Object.keys(global.globalTileCache[scales[i]][rows[j]]);
                for (let k = 0; k < cols.length; k++) { 
                    console.log("deleting tile: " + scales[i] + " " + rows[j] + " " + cols[k]);
                    const img = global.globalTileCache[scales[i]][rows[j]][cols[k]];
                    delete global.globalTileCache[scales[i]][rows[j]][cols[k]];
                    img.dispose();
                }       

                delete global.globalTileCache[scales[i]][rows[j]];
            }
            delete global.globalTileCache[scales[i]];
        }
        delete global.globalTileCache;
        global.gc();
    }
}

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

export const setTileInCache = (page: number, scale: number, gridLocation: string, img: SkImage) => {
    "worklet";
    initTileCache(page, scale); 
    const pages = Object.keys(global.skImageCache);
    if (pages.length > 5) {
        for (let i = 0; i < pages.length; i++) {
            if (Math.abs(pages[i] - page) > 3) {
                deleteAllTilesFromCacheForPage(pages[i]);
            }
        }
    }

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
  