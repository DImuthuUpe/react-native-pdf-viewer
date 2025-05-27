import { AlphaType, Canvas, Circle, ColorType, Group, Image, PaintStyle, Rect, SkCanvas, Skia, SkImage } from "@shopify/react-native-skia";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useDerivedValue, useSharedValue, withDecay } from "react-native-reanimated";
import RNFS from 'react-native-fs';
import { NitroModules } from "react-native-nitro-modules";
import { getPageTileFromCache, setPageTileInCache } from "./TileCache";
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
const MAX_SCALE = 3.5;
const MIN_SCALE = 0.6;
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

    const prevScale = useSharedValue<number>(1);
    const prevOffsetX = useSharedValue<number>(0);
    const prevOffsetY = useSharedValue<number>(0);

    const pinchGesture = Gesture.Pinch()
    .onBegin((e) => {
        origin.value = { x: e.focalX, y: e.focalY };
        pinchInProgress.value = true;
        prevScale.value = scaleVal.value;
        prevOffsetX.value = offsetX.value;
        prevOffsetY.value = offsetY.value;
    })
    .onChange((e) => {
        scaleVal.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prevScale.value * e.scale));
        if (scaleVal.value === MIN_SCALE || scaleVal.value === MAX_SCALE) {
            return;
        }
        offsetY.value = prevOffsetY.value * e.scale - origin.value.y * (e.scale - 1);
        offsetX.value = prevOffsetX.value * e.scale - origin.value.x * (e.scale - 1);
        pinchInProgress.value = true;

    }).onEnd((e) => {
        pinchInProgress.value = false;
        global.gc();
    });
    
    const getTileFromPdfium = (page: number, row: number, col: number, zoomFactor: number) => {
        "worklet";
    
        const pageTileCache = getPageTileFromCache(page, zoomFactor, row + '_' + col);
        if (pageTileCache != null) {
            return pageTileCache;
        }

        //console.log("Get tile from pdfium page: " + page + " row: " + row + " col: " + col + " zoomFactor: " + zoomFactor);
        const pageWidth = pageDimsUI.value[page][0] * scaleVal.value;
    
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
        canvas.clear(Skia.Color('transparent'));
    
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
            const pageWidth = pageDim[0]  * scale;
            const pageHeight = pageDim[1] * (pinchInProgress ? scale : 1);
            const aggregatedHeight = pageDim[2] * (pinchInProgress ? scale : 1); // till the end of the page

            if (row !== 1 || col !== 2 || pageNum !== 0) {
                //return;
            }
        
            const verticalTileData: [number, number][] = [];
            
            //console.log("Processing tile: " + row + " col: " + col + " pageNum: " + pageNum + " realOffsetX: " + realOffsetX + " realOffsetY: " + realOffsetY);
            //console.log("Effective tile size: " + effectiveTileSize + " pageWidth: " + pageWidth + " pageHeight: " + pageHeight);


            if ((realOffsetX + effectiveTileSize <= pageWidth) && realOffsetX >= 0 ) {

                //console.log("Step 1");
                const ledtTileIdX = Math.floor(realOffsetX / effectiveTileSize);
                const translationX = realOffsetX - ledtTileIdX * effectiveTileSize;

                const rightTileIdX = ledtTileIdX + 1;
                const translationX2 = effectiveTileSize - translationX;

                verticalTileData.push([ledtTileIdX, translationX]);
                verticalTileData.push([rightTileIdX, -translationX2]);

                if (translationX + translationX2 < TILE_SIZE) { // This is for Zoom < 0 and zooming state. This makes sure that 3 rd tile is added to bottom
                    verticalTileData.push([rightTileIdX + 1, -(effectiveTileSize + translationX2)]);
                }
            } 

            if ( realOffsetX < pageWidth && realOffsetX + effectiveTileSize > pageWidth) {
                //console.log("Step 2");
                const leftTileIdX = Math.floor(realOffsetX / effectiveTileSize);
                const translationX = realOffsetX - leftTileIdX * effectiveTileSize;

                verticalTileData.push([leftTileIdX, translationX]);

                if ((effectiveTileSize - translationX) + realOffsetX < pageWidth ) { // Last partial tile of the page end
                    //console.log("Step 2.1");
                    verticalTileData.push([leftTileIdX + 1, -(effectiveTileSize - translationX)]);
                }

                if ((TILE_SIZE - translationX) + realOffsetX < pageWidth) { // Last partial tile of the page end
                    //console.log("Step 2.2");
                    verticalTileData.push([leftTileIdX + 1, -(effectiveTileSize - translationX)]);
                }
            }

            if (realOffsetX + TILE_SIZE >= 0 && realOffsetX < -effectiveTileSize) {
                //console.log("Step 3.1");
                const leftTileIdX = Math.ceil(realOffsetX / effectiveTileSize);
                const translationX = realOffsetX - leftTileIdX * effectiveTileSize;
                const rightTileIdX = leftTileIdX + 1;
                const translationX2 = effectiveTileSize - translationX;
                verticalTileData.push([rightTileIdX, -translationX2]);
            }

            if (realOffsetX + effectiveTileSize >= 0 && realOffsetX < 0) {
                //console.log("Step 3");
                const leftTileIdX = Math.floor(realOffsetX / effectiveTileSize);
                const translationX = realOffsetX - leftTileIdX * effectiveTileSize;
                const rightTileIdX = leftTileIdX + 1;
                const translationX2 = effectiveTileSize - translationX;

                verticalTileData.push([rightTileIdX, -translationX2]);

                if (effectiveTileSize + translationX2 < TILE_SIZE) { // This is for Zoom < 0 and zooming state. This makes sure that 2 bottom tiles are added
                    verticalTileData.push([rightTileIdX + 1, -(effectiveTileSize + translationX2)]);
                }
            }


            if ((realOffsetY + effectiveTileSize <= aggregatedHeight * (pinchInProgress ? 1 : scale)) && 
                (realOffsetY >= (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale) )) {

                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale);
                const topTileIdY = Math.floor(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;

                for (let i = 0; i < verticalTileData.length; i++) {
                    tilesAndOffsets.push([pageNum, topTileIdY, translationY * 2, verticalTileData[i][0], verticalTileData[i][1] * 2]);
                }


                const bottomTileIdY = topTileIdY + 1;
                const translationY2 = effectiveTileSize - translationY;

                for (let i = 0; i < verticalTileData.length; i++) {
                    tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, verticalTileData[i][0], verticalTileData[i][1]  * 2]);
                }


                if (translationY + translationY2 < TILE_SIZE) { // This is for Zoom < 0 and zooming state. This makes sure that 3 rd tile is added to bottom
                    for (let i = 0; i < verticalTileData.length; i++) {
                        tilesAndOffsets.push([pageNum, bottomTileIdY + 1, -(effectiveTileSize + translationY2) * 2, verticalTileData[i][0], verticalTileData[i][1] * 2]);
                    }
                }
            }
            
            if ( realOffsetY < aggregatedHeight * (pinchInProgress ? 1 : scale)
                 && realOffsetY + effectiveTileSize > aggregatedHeight * (pinchInProgress ? 1 : scale)) {


                // Tile is partially covered by page bottom part
                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale);
                const topTileIdY = Math.floor(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;

                for (let i = 0; i < verticalTileData.length; i++) {
                    tilesAndOffsets.push([pageNum, topTileIdY, translationY * 2, verticalTileData[i][0], verticalTileData[i][1] * 2]);
                }

                for (let i = 0; i < verticalTileData.length; i++) {
                    tilesAndOffsets.push([pageNum, topTileIdY + 1, -(effectiveTileSize - translationY) * 2 , verticalTileData[i][0], verticalTileData[i][1] * 2]);
                }

                if ((TILE_SIZE - translationY) + realOffsetY < aggregatedHeight * (pinchInProgress ? 1 : scale)) { // Last partial tile of the page end
                    for (let i = 0; i < verticalTileData.length; i++) {
                        tilesAndOffsets.push([pageNum, topTileIdY + 1, -(effectiveTileSize - translationY)  * 2,  verticalTileData[i][0], verticalTileData[i][1] * 2]);
                    }
                }
            }

            if (realOffsetY + TILE_SIZE >= (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale) && 
            realOffsetY + effectiveTileSize < (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale)) {

                // This is an edge case covering to show the top of page tile when ZOOM < 1. Else, the top of tile 
                // is not shown until the tile scroll up to TILE_SIZE * scale
                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale);
                const topTileIdY = Math.ceil(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;
                const bottomTileIdY = topTileIdY + 1;
                const translationY2 = effectiveTileSize - translationY;

                for (let i = 0; i < verticalTileData.length; i++) {
                    tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, verticalTileData[i][0], verticalTileData[i][1]  * 2]);
                }
            }

            if (realOffsetY + effectiveTileSize >= (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale) && 
                        realOffsetY < (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale)) {

                const localTileOffsetY = realOffsetY - (aggregatedHeight - pageHeight) * (pinchInProgress ? 1 : scale);
                const topTileIdY = Math.floor(localTileOffsetY / effectiveTileSize);
                const translationY = localTileOffsetY - topTileIdY * effectiveTileSize;
                const bottomTileIdY = topTileIdY + 1;
                const translationY2 = effectiveTileSize - translationY;

                for (let i = 0; i < verticalTileData.length; i++) {
                    tilesAndOffsets.push([pageNum, bottomTileIdY, -translationY2 * 2, verticalTileData[i][0], verticalTileData[i][1]  * 2]);
                }

                if (effectiveTileSize + translationY2 < TILE_SIZE) { // This is for Zoom < 0 and zooming state. This makes sure that 2 bottom tiles are added
                    for (let i = 0; i < verticalTileData.length; i++) {
                        tilesAndOffsets.push([pageNum, bottomTileIdY + 1, -(effectiveTileSize + translationY2) * 2, verticalTileData[i][0], verticalTileData[i][1] * 2]);
                    }
                }
            }
            
        });
    
        if (offscreen == null) {
          return null;
        }
        const canvas: SkCanvas = offscreen.getCanvas();
        canvas.clear(Skia.Color('transparent'));

        for (let i = 0; i < tilesAndOffsets.length; i++) {
            const pageNum = tilesAndOffsets[i][0];
            const pageTileY = tilesAndOffsets[i][1];
            const translationY = tilesAndOffsets[i][2];
            const pageTileX = tilesAndOffsets[i][3];
            const translationX = tilesAndOffsets[i][4];

            if (pageTileX < 0 || pageTileX > pageDimsUI.value[pageNum][0] * (pinchInProgress ? 1 : scale) / TILE_SIZE) {
               //continue;
            }

            //console.log("Page tile page: " + pageNum + " tileX: " + pageTileX + " transX " + translationX + " tileY: " + pageTileY + " transY: " + translationY);
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

        //canvas.save(); // Example annotation
        //canvas.drawCircle(100 - offsetX * 2, 100 - offsetY * 2, 50, Skia.Paint());

        const offImg = offscreen.makeImageSnapshot();
        //pageTile?.dispose();
        gcCycleCounter.value++;
        if (gcCycleCounter.value % 100 === 0) {
            global.gc();
            //console.log("GC cycle: " + gcCycleCounter.value);
        }
        return offImg;
    }

    const drawAnnotations = (offsetX: number, offsetY: number, scale: number) => {
        "worklet";
        const offscreen = Skia.Surface.MakeOffscreen(
            stageWidth,
            stageHeight)!;
        if (offscreen == null) {
          return null;
        }
        const canvas: SkCanvas = offscreen.getCanvas();
        canvas.clear(Skia.Color('transparent'));

        const paint = Skia.Paint();
        paint.setStyle(PaintStyle.Stroke);
        paint.setColor(Skia.Color('black'));  // Set the color for the stroke (optional)
        paint.setStrokeWidth(5); 

        canvas.save();
        canvas.translate(offsetX + 200 * scale, offsetY + 100 * scale);
        canvas.scale(scale, scale);
        canvas.drawCircle(
            0,
            0,
            50,
            paint
        );
        canvas.translate(0, 0);
        canvas.restore();


        paint.setColor(Skia.Color('red'));
        paint.setStrokeWidth(3);  // Set the color for the stroke (optional)
        canvas.save();
        canvas.translate(offsetX + 100 * scale, offsetY + 100 * scale);
        canvas.scale(scale, scale);
        canvas.drawPath(
            Skia.Path.MakeFromSVGString('M 100 100 L 200 200 L 300 100 Z')!,
            paint
        );
        canvas.restore();

        

        const offImg = offscreen.makeImageSnapshot();
        offscreen.dispose();
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
                    image={useDerivedValue(() => processTile(verticalTileId, horizontalTileId, scaleVal.value, -offsetX.value, -offsetY.value, pinchInProgress.value))}
                    width={useDerivedValue(() => TILE_SIZE )}
                    height={useDerivedValue(() => TILE_SIZE)}
                    />
                    </Group>
                    );
                  });
              })}
              <Image x={0} y={0} width={stageWidth} height={stageHeight}
                image={useDerivedValue(() => drawAnnotations(offsetX.value, offsetY.value, scaleVal.value))}/>
              </Group>
            </Canvas>
            <GestureDetector gesture={Gesture.Race(panGesture, pinchGesture)}>
              <Animated.View style={[StyleSheet.absoluteFill]} />
            </GestureDetector>
          </View>
        </GestureHandlerRootView>
    
      );

}

export default NewPdfViewer;