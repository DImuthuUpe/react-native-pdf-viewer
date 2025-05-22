import { SkImage } from "@shopify/react-native-skia";


const initGlobalTileCache = (scale: number, row: number) => { // Cache to store processsed tiles for grid
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

const initPageTileCache = (page: number, scale: number) => { // Cache to store raw tiles fetched from pdfium
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

export const getGridTileFromCache = (scale: number, row: number, col: number) => {
    "worklet";
    initGlobalTileCache(scale, row);
    return global.globalTileCache[scale][row]?.[col];
}    

export const setGridTileInCache = (scale: number, row: number, col: number, img: SkImage) => {
    "worklet";
    initGlobalTileCache(scale, row);
    global.globalTileCache[scale][row][col] = img;
}

export const clearOutofScaleAllTiles = (scale: number) => {
    "worklet";
    if (global.globalTileCache != null) {
        const scales = Object.keys(global.globalTileCache);
        for (let i = 0; i < scales.length; i++) {
            if (Number(scales[i]) !== scale) {
                const rows = Object.keys(global.globalTileCache[scales[i]]);
                for (let j = 0; j < rows.length; j++) {
                    const cols = Object.keys(global.globalTileCache[scales[i]][rows[j]]);
                    for (let k = 0; k < cols.length; k++) {
                        const img = global.globalTileCache[scales[i]][rows[j]][cols[k]];
                        delete global.globalTileCache[scales[i]][rows[j]][cols[k]];
                        img.dispose();
                    }
                }
                delete global.globalTileCache[scales[i]];
            }
        }
    }

    if (global.skImageCache != null) {
        const pages = Object.keys(global.skImageCache);
        for (let i = 0; i < pages.length; i++) {
            const scales = Object.keys(global.skImageCache[pages[i]]);
            for (let j = 0; j < scales.length; j++) {
                if (Number(scales[j]) !== scale) {
                    const gridLocations = Object.keys(global.skImageCache[pages[i]][scales[j]]);
                    for (let k = 0; k < gridLocations.length; k++) {
                        global.skImageCache[pages[i]][scales[j]][gridLocations[k]]?.dispose();
                        delete global.skImageCache[pages[i]][scales[j]][gridLocations[k]];
                    }
                    delete global.skImageCache[pages[i]][scales[j]];
                }
            }
        }
    }


    global.gc();
}

export const clearOutOfScaleTilesForOffset = (scale: number, yOffset: number, tileSize: number, windowHeight: number) => {
    "worklet";

    const viewPortHeight = Math.ceil(windowHeight / scale);
    const viewPortTopRow = Math.floor(yOffset / tileSize);
    const viewPortBottomRow = Math.ceil((yOffset + viewPortHeight) / tileSize);
    console.log("scale " + scale + " viewPortTopRow: " + viewPortTopRow + " viewPortBottomRow: " + viewPortBottomRow);

    if (global.globalTileCache != null) {
        const scales = Object.keys(global.globalTileCache);
        for (let i = 0; i < scales.length; i++) {
            if (Number(scales[i]) === scale) {
                const rows = Object.keys(global.globalTileCache[scales[i]]);
                for (let j = 0; j < rows.length; j++) {
                    if (Number(rows[j]) >= viewPortTopRow && Number(rows[j]) <= viewPortBottomRow) {
                        continue;
                    }
                    const cols = Object.keys(global.globalTileCache[scales[i]][rows[j]]);
                    for (let k = 0; k < cols.length; k++) {
                        const img = global.globalTileCache[scales[i]][rows[j]][cols[k]];
                        delete global.globalTileCache[scales[i]][rows[j]][cols[k]];
                        img.dispose();
                        console.log("Deleting tile: Scale " + scales[i] + " Row " + rows[j] + " Col " + cols[k]);
                    }
                }
            }
        }
    }
}

export const clearGridTileCache = (scale: number, row: number, col: number, verticalTiles: number) => {
    "worklet";
    if (global.globalTileCache != null) {
        const scales = Object.keys(global.globalTileCache);
        for (let i = 0; i < scales.length; i++) {
            const rows = Object.keys(global.globalTileCache[scales[i]]);
            for (let j = 0; j < rows.length; j++) {
                if (Math.abs(Number(rows[j]) - row) <= verticalTiles + 1) {
                    continue;
                }
                const cols = Object.keys(global.globalTileCache[scales[i]][rows[j]]);
                for (let k = 0; k < cols.length; k++) { 
                    console.log("Deleting tile: Scale " + scales[i] + " Row " + rows[j] + " Col " + cols[k]);
                    const img = global.globalTileCache[scales[i]][rows[j]][cols[k]];
                    delete global.globalTileCache[scales[i]][rows[j]][cols[k]];
                    img.dispose();
                    //global.gc();
                }
            }
        }
    }
}

export const printPageTileCacheEntries = () => {
    "worklet";
    console.log("Page tile cache entries");
    const pages = Object.keys(global.skImageCache);
    for (let i = 0; i < pages.length; i++) {
        const scales = Object.keys(global.skImageCache[pages[i]]);
        for (let j = 0; j < scales.length; j++) {
            const gridLocations = Object.keys(global.skImageCache[pages[i]][scales[j]]);
            console.log("Page: " + pages[i] + " Scale: " + scales[j] + " GridLocations: " + gridLocations);
        }
    }
    console.log("Page tile cache entries end");
}

export const printGridTileCacheEntries = () => {
    "worklet";
    console.log("Grid tile cache entries");
    const scales = Object.keys(global.globalTileCache);
    for (let i = 0; i < scales.length; i++) {
        const rows = Object.keys(global.globalTileCache[scales[i]]);
        for (let j = 0; j < rows.length; j++) {
            const cols = Object.keys(global.globalTileCache[scales[i]][rows[j]]);
            console.log("Scale: " + scales[i] + " Row: " + rows[j] + " Col: " + cols);
        }
    }
    console.log("Grid tile cache entries end");
}

export const getPageTileFromCache = (page: number, scale: number, gridLocation: string) => {
    "worklet";
    initPageTileCache(page, scale);
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
                global.skImageCache[page][scales[i]][gridLocations[j]]?.dispose();
                delete global.skImageCache[page][scales[i]][gridLocations[j]];
            }
            delete global.skImageCache[page][scales[i]];
        }
        delete global.skImageCache[page];
        global.gc();
    }
} 

export const setPageTileInCache = (page: number, scale: number, gridLocation: string, img: SkImage) => {
    "worklet";
    initPageTileCache(page, scale); 
    const pages = Object.keys(global.skImageCache);
    if (pages.length > 2) {
        for (let i = 0; i < pages.length; i++) {
            if (Math.abs(pages[i] - page) > 3) {
                deleteAllTilesFromCacheForPage(pages[i]);
            }
        }
    }

    global.skImageCache[page][scale][gridLocation] = img;
}

export const cleanUpOutofScalePageTiles = (page: number, currentScale: number) => {
    "worklet";
    if (global.skImageCache == null) {
        return;
    }

    if (global.skImageCache[page] == null) {
        return;
    }

    const scales = Object.keys(global.skImageCache[page]);
    for (let i = 0; i < scales.length; i++) {
        if (Number(scales[i]) !== currentScale) {
            const gridLocations = Object.keys(global.skImageCache[page][scales[i]]);
            for (let j = 0; j < gridLocations.length; j++) {
                global.skImageCache[page][scales[i]][gridLocations[j]]?.dispose();
                delete global.skImageCache[page][scales[i]][gridLocations[j]];
            }
            delete global.skImageCache[page][scales[i]];
        }
    }
}
  