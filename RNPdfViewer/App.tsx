import { AlphaType, Canvas, ColorType, Group, Image, Matrix4, multiply4, Rect, scale, SkCanvas, Skia, SkImage } from "@shopify/react-native-skia";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useDerivedValue, useSharedValue, withDecay } from "react-native-reanimated";
import RNFS from 'react-native-fs';
import { NitroModules } from "react-native-nitro-modules";
import { clearOutofScaleAllTiles, cleanUpOutofScaleTiles, getTileFromCache, setTileInCache, getGlobalTileFromCache, setGlobalTileInCache, clearGlobalTileCache } from "./src/TileCache";
const fileName = 'A17_FlightPlan.pdf';//'uneven.pdf';//'A17_FlightPlan.pdf';//'sample.pdf'; // Relative to assets
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


const boxedPdfium = NitroModules.box(PdfiumModule)
PdfiumModule.openPdf(filePath);

const { width: stageWidth, height: stageHeight } = Dimensions.get('screen');

const {width, height} = Dimensions.get('window');
const TILE_SIZE = 256;

const verticalTiles = Math.ceil(height / TILE_SIZE) * 2;
const horizontalTiles = Math.ceil(width / TILE_SIZE);
const canvasHeight = verticalTiles * TILE_SIZE;
const canvasWidth = horizontalTiles * TILE_SIZE;

const PAGE_GAP = 10;
const PAGE_COUNT = PdfiumModule.getPageCount();
const PIXEL_ZOOM = 2;
const MAX_SCALE = 2.9;

const pageDims = PdfiumModule.getAllPageDimensions();

                        // page1 , pageTile1, offset1, page2, pageTile2, offset2
const tilePageCoverage: [number, number, number, number, number, number][] = [];

const parts : [number, number, number][] = [];
for (let tileStep = 0; tileStep * TILE_SIZE < pageDims[PAGE_COUNT -1][2]; tileStep++) {
  const tileStartY = tileStep * TILE_SIZE;
  const tileEndY = tileStartY + TILE_SIZE;
  pageDims.forEach((pageDim, pageNum) => {
    const pageHeight = pageDim[1];
    const pageStartY = pageDim[2] - pageHeight;
    const pageEndY = pageStartY + pageHeight;

    if (tileStartY >= pageStartY && tileEndY <= pageEndY) {
      // Tile is fully covered by page
      const tileOffset = tileStartY - pageStartY;
      if (tileOffset % TILE_SIZE == 0) {
        // Tile is aligned with page tile
        const pageTile = Math.floor(tileOffset / TILE_SIZE);
        const translation = 0
        parts.push([pageNum, pageTile, translation]);
      } else {
        // Tile is covered by 2 page tiles
        const pageTile1 = Math.floor(tileOffset / TILE_SIZE);
        const translation1 = tileOffset - pageTile1 * TILE_SIZE;

        const pageTile2 = pageTile1 + 1;
        const translation2 = TILE_SIZE - translation1;

        parts.push([pageNum, pageTile1, translation1]);
        parts.push([pageNum, pageTile2, -translation2]);
      }
    } else if (tileStartY < pageStartY && tileEndY > pageStartY) {
      // Tile is partially covered by page top part
      const pageTile = 0;
      const translation = tileStartY - pageStartY;
      parts.push([pageNum, pageTile, translation]);
    } else if (tileStartY < pageEndY && tileEndY > pageEndY) {
      // Tile is partially covered by page bottom part
      const pageTile = Math.floor((tileStartY - pageStartY) / TILE_SIZE);
      const translation = tileStartY - (pageStartY + pageTile * TILE_SIZE);
      parts.push([pageNum, pageTile, translation]);
    }
  });

  if (parts.length == 2) {
    tilePageCoverage.push([parts[0][0], parts[0][1], parts[0][2], parts[1][0], parts[1][1], parts[1][2]]);
    parts.length = 0;
  } else if (parts.length == 1) {
    tilePageCoverage.push([parts[0][0], parts[0][1], parts[0][2], -1, -1, -1]);
    parts.length = 0;
  } else {
    tilePageCoverage.push([-1, -1, -1, -1, -1, -1]);
  }

}

pageDims.forEach((pageDim, pageNum) => {
  console.log(`Page ${pageNum} dims: ${pageDim}`);
}
);
tilePageCoverage.forEach((tilePage) => {
  console.log(tilePage);
}
);

const App = () => {

  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(-2048);
  const scaleVal = useSharedValue<number>(1);
  const origin = useSharedValue({ x: 0, y: 0 });
  const offset = useSharedValue(Matrix4());
  const matrix = useSharedValue(Matrix4());
  const scaleEndValue = useSharedValue<number>(1);
  const pageCoverageTiles = useSharedValue(tilePageCoverage);
  const pageDimension = useSharedValue(pageDims);

  const width = stageWidth;

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


  const resetCache = (lastScale: number) => {
    "worklet";
    console.log("Resetting cache for scale: " + Math.ceil(lastScale));
    clearOutofScaleAllTiles(Math.ceil(lastScale));
  }

  const pinchGesture = Gesture.Pinch()
  .onBegin((e) => {
      origin.value = { x: e.focalX, y: e.focalY };
      offset.value = matrix.value;
  })
  .onChange((e) => {
    if (e.scale > MAX_SCALE || e.scale < 0.51) {
      return;
    }
  
    scaleVal.value = e.scale;
    matrix.value = multiply4(
      offset.value,
      scale(e.scale, e.scale, 1, origin.value)
    );
  }).onEnd((e) => {
    scaleEndValue.value = e.scale > MAX_SCALE? MAX_SCALE: e.scale < 0.51? 0.51: e.scale;
    resetCache(e.scale);
  });

  const getTileFromPdfium = (page: number, row: number, col: number, zoomFactor: number) => {
    "worklet";

    const pageWidth = pageDimension.value[page][0];
    const pageHeight = pageDimension.value[page][1];

    const tileStartX = col * TILE_SIZE;
    const tileEndX = (col + 1) * TILE_SIZE;
    const tileWidth = pageWidth > tileEndX?
      TILE_SIZE * zoomFactor: tileStartX > pageWidth?
      0: Math.ceil(pageWidth - tileStartX) * zoomFactor;

    if (tileWidth == 0) {
      return null;
    }
    const tileHeight = TILE_SIZE * zoomFactor;
    const tileBuf = boxedPdfium.unbox().getTileBgr565(
      page,
      -row  * TILE_SIZE * zoomFactor,
      -col * TILE_SIZE * zoomFactor,
      width,
      tileWidth,
      tileHeight,
      zoomFactor);

    const data = Skia.Data.fromBytes(new Uint8Array(tileBuf));
    const img = Skia.Image.MakeImage(
      {
        width: tileWidth,
        height: tileHeight,
        alphaType: AlphaType.Opaque,
        colorType: ColorType.RGB_565,
      },
      data,
      tileWidth * 2
    );

    if (global.coffscreens == null) {
      global.coffscreens = {};
    }

    if (global.coffscreens[zoomFactor] == null) {
      global.coffscreens[zoomFactor] = {};

      global.coffscreens[zoomFactor] = Skia.Surface.MakeOffscreen(
        TILE_SIZE * zoomFactor,
        TILE_SIZE * zoomFactor)!;
    }

    const offscreen = global.coffscreens[zoomFactor];

    if (offscreen == null) {
      return null;
    }
    const canvas = offscreen.getCanvas();
    canvas.drawImage(img as SkImage, 0, 0);
    const offImg = offscreen.makeImageSnapshot();
    img?.dispose();
    data.dispose();
    //offscreen.dispose();
    return offImg;
  }

  const getOffScreenTile = (pageNum: number, row: number, col: number, scale: number) => {
    "worklet";

    const gridLocation = `${col}-${row}`;
    var img = getTileFromCache(pageNum, scale, gridLocation);
    if (img == null) {
      img = getTileFromPdfium(pageNum, row, col, PIXEL_ZOOM * Math.ceil(scale));
      setTileInCache(pageNum, scale, gridLocation, img);
      cleanUpOutofScaleTiles(pageNum, scale);
    }
    return img;
  }

  const getTileImage = (row: number, col: number, zoomFactor: number, yOff: number) => {
    "worklet";
    yOff += 2048 + TILE_SIZE; // This is always base coordinate as it the scale is handled by outside
    const canvasStart = yOff = -yOff;  
    const scaledHeight = height / zoomFactor;
    const canvasEnd = yOff + scaledHeight;
    if ((row - 1) * TILE_SIZE > canvasEnd || (row + 1) * TILE_SIZE < canvasStart) {
      zoomFactor = 1;
    }

    const cacheImg = getGlobalTileFromCache(zoomFactor, row, col);
    if (cacheImg != null) {
      return cacheImg;
    }

    if (global.offscreens == null) {
      global.offscreens = {};
    }

    if (global.offscreens[zoomFactor] == null) {
      global.offscreens[zoomFactor] = {};

      global.offscreens[zoomFactor] = Skia.Surface.MakeOffscreen(
        TILE_SIZE * PIXEL_ZOOM * zoomFactor,
        TILE_SIZE * PIXEL_ZOOM * zoomFactor)!;
    }
    const offscreen = global.offscreens[zoomFactor];

    const canvas:SkCanvas = offscreen.getCanvas();
    const resetColor = Skia.Color("transparent");
    canvas.clear(resetColor);
    //canvas.clear(0xFFFFFFFF);

    const tilePages = pageCoverageTiles.value[row];
    if (tilePages== null) {
      return null;
    }

    for (let partIdx = 0; partIdx <= 1; partIdx++) {
      const pageNum = tilePages[0 + partIdx * 3];
      const pageTile = tilePages[1 + partIdx * 3];
      const translation = tilePages[2 + partIdx * 3];
      if (pageNum == -1) {
        continue;
      }
      canvas.save();
      canvas.translate(0, -translation * 2 * zoomFactor);
      const img = getOffScreenTile(pageNum, pageTile, col, zoomFactor);
      if (img != null) {
        canvas.drawImage(img as SkImage, 0,0);
        //img?.dispose();
      }
      canvas.restore();
    }

    const img = offscreen.makeImageSnapshot();
    //offscreen.dispose();
    setGlobalTileInCache(zoomFactor, row, col, img);
    clearGlobalTileCache(zoomFactor, row, col, verticalTiles);
    return img;
  }


  const getImageForTile = (xOff: number, yOff: number, scale: number, row: number, col: number) => {
    "worklet";

    if (yOff > 0) {
      return null;
    }

    const iteration = Math.floor(-yOff / canvasHeight);
    const offsetRow = Math.floor((-yOff % canvasHeight)/TILE_SIZE);

    const calculatedRow = offsetRow >= row ? iteration * verticalTiles + row : (iteration -1) * verticalTiles + row;

    const img = getTileImage(calculatedRow, col, scale, yOff);
    return img;
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
                <Rect x={useDerivedValue(() => scaleVal.value * (offsetX.value + horizontalTileId*TILE_SIZE))}
                y={useDerivedValue(() =>  {
                  const absT = (offsetY.value + verticalTileId * TILE_SIZE) % canvasHeight;
                  const yPos =  absT < 0? absT + canvasHeight: absT;
                  return scaleVal.value * (yPos - TILE_SIZE);})}
                color={"black"}
                strokeWidth={1}
                style={"stroke"}
                width={useDerivedValue(() => TILE_SIZE * scaleVal.value)}
                height={useDerivedValue(() => TILE_SIZE * scaleVal.value)}
                  />
                <Image
                x={useDerivedValue(() => scaleVal.value * (offsetX.value + horizontalTileId*TILE_SIZE))}
                y={useDerivedValue(() =>  {
                  const absT = (offsetY.value + verticalTileId * TILE_SIZE) % canvasHeight;
                  const yPos =  absT < 0? absT + canvasHeight: absT;
                  return scaleVal.value * (yPos - TILE_SIZE );})}
                image={useDerivedValue(() => getImageForTile(
                  offsetX.value,
                  offsetY.value,
                  Math.ceil(scaleEndValue.value),
                  verticalTileId,
                  horizontalTileId))}
                width={useDerivedValue(() => TILE_SIZE * scaleVal.value)}
                height={useDerivedValue(() => TILE_SIZE * scaleVal.value)}

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
};

export default App;
