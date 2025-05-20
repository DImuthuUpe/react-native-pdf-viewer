import { AlphaType, Canvas, ColorType, Group, Image, Matrix4, multiply4, Rect, scale, SkCanvas, Skia, SkImage } from "@shopify/react-native-skia";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { createWorkletRuntime, useDerivedValue, useSharedValue, withDecay } from "react-native-reanimated";
import RNFS from 'react-native-fs';
import { NitroModules } from "react-native-nitro-modules";
import { clearOutofScaleAllTiles, cleanUpOutofScalePageTiles, getPageTileFromCache, setPageTileInCache, getGridTileFromCache, setGridTileInCache, clearGridTileCache, printGridTileCacheEntries, printPageTileCacheEntries, clearOutOfScaleTilesForOffset } from "./TileCache";
const fileName = 'sample.pdf';//tilevalidation.pdf 'uneven.pdf';//'A17_FlightPlan.pdf';//'sample.pdf'; // Relative to assets
let filePath = '';

if (Platform.OS === 'ios') {
  filePath = `${RNFS.MainBundlePath}/${fileName}`;
} else {
  filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
  RNFS.copyFileAssets(fileName, filePath)
    .then(() => {
      console.log('Asset copied to:', filePath);
    })
    .catch((err) => {
      console.error('Error copying asset:', err);
    });
}


const boxedPdfium = NitroModules.box(PdfiumModule);
PdfiumModule.openPdf(filePath);

const { width: stageWidth, height: stageHeight } = Dimensions.get('screen');

const {width: windowWidth, height: windowHeight} = Dimensions.get('window');
const TILE_SIZE = 256;

const verticalTiles = Math.ceil(windowHeight / TILE_SIZE);
const horizontalTiles = Math.ceil(windowWidth / TILE_SIZE);
const canvasHeight = verticalTiles * TILE_SIZE;
const canvasWidth = horizontalTiles * TILE_SIZE;

const PAGE_GAP = 10;
const PAGE_COUNT = PdfiumModule.getPageCount();
const PIXEL_ZOOM = 2;
const MAX_SCALE = 2.9;
const USE_BGR565 = false;

const pageDims = PdfiumModule.getAllPageDimensions();

const NewPdfViewer = () => {
    const offsetX = useSharedValue<number>(0);
    const offsetY = useSharedValue<number>(0);
    const scaleVal = useSharedValue<number>(1);
    const gcCycleCounter = useSharedValue<number>(0);
    const origin = useSharedValue({ x: 0, y: 0 });
    const pageDimsUI = useSharedValue(pageDims);
    const pinchInProgress = useSharedValue<boolean>(false);


    const panGesture = Gesture.Pan().onChange((e) => {

        offsetX.value += e.changeX;
        offsetY.value += e.changeY;
    
    }).onEnd((e) => {
        offsetX.value = withDecay({
          velocity: e.velocityX
        });
    
        offsetY.value = withDecay({
          velocity: e.velocityY
        });
    });

    const pinchGesture = Gesture.Pinch()
    .onBegin((e) => {
        origin.value = { x: e.focalX, y: e.focalY };
        pinchInProgress.value = true;
    })
    .onChange((e) => {
        scaleVal.value = e.scale;
        pinchInProgress.value = true;
    }).onEnd((e) => {
        console.log("Pinch end");
        pinchInProgress.value = false;
    });
    
    const getTileFromPdfium = (page: number, row: number, col: number, zoomFactor: number) => {
        "worklet";
    
        const pageTileCache = getPageTileFromCache(page, zoomFactor, row + '_' + col);
        if (pageTileCache != null) {
            return pageTileCache;
        }

        console.log("Get tile from pdfium page: " + page + " row: " + row + " col: " + col + " zoomFactor: " + zoomFactor);
        const pageWidth = pageDimsUI.value[page][0] * 2;
        const pageHeight = pageDimsUI.value[page][1];
    
        const tileStartX = col * TILE_SIZE;
        const tileEndX = (col + 1) * TILE_SIZE;
        const tileWidth = pageWidth > tileEndX ?
          TILE_SIZE * 2: tileStartX > pageWidth ?
          0 : Math.ceil(pageWidth - tileStartX) * 2;
    
        if (tileWidth === 0) {
          return null;
        }

        
        const tileHeight = TILE_SIZE * 2;
    
        const tileBuf = USE_BGR565 ? boxedPdfium.unbox().getTileBgr565(
          page,
          -row  * TILE_SIZE * 2,
          -col * TILE_SIZE * 2,
          stageWidth * 2,
          tileWidth,
          tileHeight,
          zoomFactor) : boxedPdfium.unbox().getTile(
            page,
            -row  * TILE_SIZE * 2,
            -col * TILE_SIZE * 2,
            stageWidth * 2,
            tileWidth,
            tileHeight,
            zoomFactor);
    
        const data = Skia.Data.fromBytes(new Uint8Array(tileBuf));
        const img = Skia.Image.MakeImage(
          {
            width: tileWidth,
            height: tileHeight,
            alphaType: AlphaType.Opaque,
            colorType: USE_BGR565 ? ColorType.RGB_565 : ColorType.RGBA_8888,
          },
          data,
          tileWidth * (USE_BGR565 ? 2 : 4)
        );
    
        const offscreen = Skia.Surface.MakeOffscreen(
            TILE_SIZE * 2,
            TILE_SIZE * 2)!;
    
        if (offscreen == null) {
          return null;
        }
        const canvas = offscreen.getCanvas();
        canvas.clear(Skia.Color('black'));
    
        canvas.drawImage(img as SkImage, 0, 0);
        const offImg = offscreen.makeImageSnapshot();
        img?.dispose();
        data.dispose();
        offscreen.dispose();

        setPageTileInCache(page, zoomFactor, row + '_' + col, offImg);
        return offImg;
    }

    const getTileOffScreen = (row: number, col: number) => {
        "worklet";
        global.tileOffscreens = global.tileOffscreens || {};
        global.tileOffscreens[row] = global.tileOffscreens[row] || {};
        if (global.tileOffscreens[row][col] != null) {
            return global.tileOffscreens[row][col];
        }
        const offscreen = Skia.Surface.MakeOffscreen(
            TILE_SIZE * 2,
            TILE_SIZE * 2)!;
        if (offscreen == null) {
          return null;
        }
        global.tileOffscreens[row][col] = offscreen;
        return offscreen;
    }
    const processTile = (row: number, col: number, scale: number, offsetX: number, offsetY: number, pinchInProgress: boolean) => {
        "worklet";

        const realOffsetY = (offsetY + row * TILE_SIZE);
        const realOffsetX = (offsetX + col * TILE_SIZE);

        const offscreen = getTileOffScreen(row, col);

        // [pageNum, pageTileY, translationY, pageTileX, translationX]
        const tilesAndOffsets: [number, number, number, number, number][] = [];

        const effectiveTileSize = TILE_SIZE * (pinchInProgress ? scale : 1);
        pageDims.forEach((pageDim, pageNum) => {
            const pageWidth = pageDim[0];
            const pageHeight = pageDim[1] * (pinchInProgress ? scale : 1);
            const aggregatedHeight = pageDim[2] * (pinchInProgress ? scale : 1); // till the end of the page

            
            if ((realOffsetY + effectiveTileSize <= aggregatedHeight) && 
                (realOffsetY >= aggregatedHeight - pageHeight)) {
                
                
                const leftTileIdX = Math.floor(realOffsetX / effectiveTileSize);
                const leftTranslationX = realOffsetX - leftTileIdX * effectiveTileSize;
                const rightTileIdX = leftTileIdX + 1;
                const rightTranslationX = effectiveTileSize - leftTranslationX;


                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight);
                const topTileIdY = Math.floor(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;

                tilesAndOffsets.push([pageNum, topTileIdY, translationY * 2, leftTileIdX, leftTranslationX * 2]);
                tilesAndOffsets.push([pageNum, topTileIdY, translationY * 2, rightTileIdX, -rightTranslationX * 2]);
                
                const bottomTileIdY = topTileIdY + 1;
                const translationY2 = effectiveTileSize - translationY;

                tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, leftTileIdX, leftTranslationX * 2]);
                tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, rightTileIdX, -rightTranslationX * 2]);

            } 
            
            /*else if ( realOffsetY < aggregatedHeight && realOffsetY + effectiveTileSize > aggregatedHeight) {

                const leftTileIdX = Math.floor(realOffsetX / effectiveTileSize);
                const leftTranslationX = realOffsetX - leftTileIdX * effectiveTileSize;
                const rightTileIdX = leftTileIdX + 1;
                const rightTranslationX = effectiveTileSize - leftTranslationX;

                // Tile is partially covered by page bottom part
                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight);
                const topTileIdY = Math.floor(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;
                tilesAndOffsets.push([pageNum, topTileIdY, translationY * 2, leftTileIdX, leftTranslationX * 2]);
                tilesAndOffsets.push([pageNum, topTileIdY, translationY * 2, rightTileIdX, -rightTranslationX * 2]);

            } else if (realOffsetY + effectiveTileSize >= aggregatedHeight - pageHeight && realOffsetY < aggregatedHeight - pageHeight) {
                
                const leftTileIdX = Math.floor(realOffsetX / effectiveTileSize);
                const leftTranslationX = realOffsetX - leftTileIdX * effectiveTileSize;
                const rightTileIdX = leftTileIdX + 1;
                const rightTranslationX = effectiveTileSize - leftTranslationX;
                
                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight);
                const topTileIdY = Math.floor(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;
                const bottomTileIdY = topTileIdY + 1;
                const translationY2 = effectiveTileSize - translationY;
                tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, leftTileIdX, leftTranslationX * 2]);
                tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, rightTileIdX, -rightTranslationX * 2]);
            }*/
            
        });
    
        if (offscreen == null) {
          return null;
        }
        const canvas = offscreen.getCanvas();
        canvas.clear(Skia.Color('transparent'));

        for (let i = 0; i < tilesAndOffsets.length; i++) {
            const pageNum = tilesAndOffsets[i][0];
            const pageTileY = tilesAndOffsets[i][1];
            const translationY = tilesAndOffsets[i][2];
            const pageTileX = tilesAndOffsets[i][3];
            const translationX = tilesAndOffsets[i][4];

            if (pageTileX < 0 || pageTileX > pageDimsUI.value[pageNum][0] / TILE_SIZE) {
               continue;
            }

            const pageTile = getTileFromPdfium(pageNum, pageTileY, pageTileX, 2 * (pinchInProgress ? 1 : scale));

            if (pageTile == null) {
                return null;
            }
            canvas.save();

            canvas.translate(-translationX, -translationY);
            canvas.scale((pinchInProgress ? scale : 1), (pinchInProgress ? scale : 1));

            canvas.drawImage(pageTile as SkImage, 0, 0);
            canvas.restore();
        }

        const offImg = offscreen.makeImageSnapshot();
        //pageTile?.dispose();
        gcCycleCounter.value++;
        if (gcCycleCounter.value % 100 === 0) {
            global.gc();
            //console.log("GC cycle: " + gcCycleCounter.value);
        }
        return offImg;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <Canvas
            style={{
              width: stageWidth,
              height: stageHeight,
              backgroundColor: 'lightblue',
            }}
            >
              <Group>
              {[...Array(horizontalTiles).keys()].map((horizontalTileId) => {
                return [...Array(verticalTiles).keys()].map((verticalTileId) => {
                  return (
                    <Group>
                    <Rect 
                     x={useDerivedValue(() => horizontalTileId * TILE_SIZE)}
                     y={useDerivedValue(() =>  verticalTileId * TILE_SIZE)}
                    color={"black"}
                    strokeWidth={1}
                    style={"stroke"}
                    width={useDerivedValue(() => TILE_SIZE )}
                    height={useDerivedValue(() => TILE_SIZE)}
                        />
                    <Image
                    x={useDerivedValue(() => horizontalTileId * TILE_SIZE)}
                    y={useDerivedValue(() =>  verticalTileId * TILE_SIZE)}
                    image={useDerivedValue(() => processTile(verticalTileId, horizontalTileId, 2, -offsetX.value, -offsetY.value, false))}
                    width={useDerivedValue(() => TILE_SIZE )}
                    height={useDerivedValue(() => TILE_SIZE)}
                    />
                    </Group>
                    );
                  });
              })}
              </Group>
            </Canvas>
            <GestureDetector gesture={Gesture.Race(pinchGesture, panGesture)}>
              <Animated.View style={[StyleSheet.absoluteFill]} />
            </GestureDetector>
          </View>
        </GestureHandlerRootView>
    
      );

}

export default NewPdfViewer;