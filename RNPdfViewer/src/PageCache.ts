const initPageCache = (pageNum: number) => {
    "worklet";
    if (global.pageCache == null) {
        global.pageCache = {};
      }
  
      if (global.pageCache[pageNum] == null) {
        global.pageCache[pageNum] = {};
      }
}

export const getPageFromCache = (pageNum: number, scale: number) => {
    "worklet";
    initPageCache(pageNum);
    return global.pageCache[pageNum][scale];
}

export const setPageInCache = (pageNum: number, scale: number, img: SkImage) => {
    "worklet";
    initPageCache(pageNum);
    global.pageCache[pageNum][scale] = img;
    global.gc();
}

export const cleanUpOutofScalePageSnapshots = (pageNum: number, currentScale: number) => {
    "worklet";
    if (global.pageCache == null) {
        return
    }

    if (global.pageCache[pageNum] == null) {
        return
    }

    const scales = Object.keys(global.pageCache[pageNum]);
    for (let i = 0; i < scales.length; i++) {
        if (scales[i] != currentScale) {
            global.pageCache[pageNum][scales[i]].dispose();
            delete global.pageCache[pageNum][scales[i]];
        }
        global.gc();
    }
}  

export const deleteAllSnapshotsFromCacheForPage = (pageNum: number) => {
    "worklet";
    if (global.pageCache == null) {
      return
    }
    if (global.pageCache[pageNum] != null) {
        console.log("deleting all snapshots for page: " + pageNum);
        const scales = Object.keys(global.pageCache[pageNum]);
        for (let i = 0; i < scales.length; i++) {
            global.pageCache[pageNum][scales[i]].dispose();
            delete global.pageCache[pageNum][scales[i]];
        }
        delete global.pageCache[pageNum];
        global.gc();
    }
}
