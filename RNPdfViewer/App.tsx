import { AlphaType, Canvas, ColorType, Group, Image, Matrix4, multiply4, Rect, scale, SkCanvas, SkData, Skia, SkImage, Text, translate, useTypeface } from "@shopify/react-native-skia";
import { useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, runOnJS, runOnUI } from "react-native-reanimated";
import RNFS from 'react-native-fs';
import { NitroModules } from "react-native-nitro-modules";
import { cleanUpOutofScaleTiles, deleteAllTilesFromCacheForPage, getTileFromCache, setTileInCache } from "./src/TileCache";
const fileName = 'sample.pdf'; // Relative to assets
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
const NUM_COLUMNS = Math.floor(width / TILE_SIZE);
const NUM_ROWS = Math.floor(height / TILE_SIZE);
const NUM_TILES = NUM_COLUMNS * NUM_ROWS;
const PAGE_GAP = 20;
const PAGE_COUNT = 10;
const PIXEL_ZOOM = 2;
const MAX_SCALE = 3;

//const tileSize = TILE_SIZE * PIXEL_ZOOM;

const pixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
    pixels.fill(255);
    let i = 0;
    for (let x = 0; x < TILE_SIZE; x++) {
      for (let y = 0; y < TILE_SIZE; y++) {
        pixels[i++] = (x * y) % 255;
      }
    }

    
const App = () => {

  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(0);
  const origin = useSharedValue({ x: 0, y: 0 });
  const offset = useSharedValue(Matrix4());
  const matrix = useSharedValue(Matrix4());
  const scaleEndValue = useSharedValue<number>(1);

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
      offset.value = matrix.value;
  })
  .onChange((e) => {
    if (e.scale > MAX_SCALE) {
      return;
    }
    matrix.value = multiply4(
      offset.value,
      scale(e.scale, e.scale, 1, origin.value)
    );
  }).onEnd((e) => {
    scaleEndValue.value = e.scale;
  });

  const getTileFromPdfium = (page: number, row: number, col: number, zoomFactor: number) => {
    "worklet";
    const tileBuf = boxedPdfium.unbox().getTile(page, -row, -col, width / 2, TILE_SIZE * zoomFactor, zoomFactor);

    const data = Skia.Data.fromBytes(new Uint8Array(tileBuf));
    const img = Skia.Image.MakeImage(
      {
        width: TILE_SIZE * zoomFactor,
        height: TILE_SIZE * zoomFactor,
        alphaType: AlphaType.Opaque,
        colorType: ColorType.BGRA_8888,
      },
      data,
      TILE_SIZE * zoomFactor * 4
    );
    data.dispose();
    return img;
  }

  const drawTile = (canvas: SkCanvas, offX: number, offY: number, 
    scale: number, page: number, col: number, row: number) => {

    "worklet";
    
    const zoomFactor = PIXEL_ZOOM * scale;
    canvas.translate((col * TILE_SIZE + offX) * zoomFactor, 
                     (row * TILE_SIZE + offY) * zoomFactor);

    const gridLocation = `${col}-${row}`;

    var img = getTileFromCache(page, scale, gridLocation);
                 
    if (img == null) {      
      img = getTileFromPdfium(page, row, col, zoomFactor);
      setTileInCache(page, scale, gridLocation, img);
    }

    canvas.drawImage(img as SkImage,  0,  0, );
    canvas.translate(- (col * TILE_SIZE + offX) * zoomFactor, -(offY + row * TILE_SIZE) * zoomFactor);
  }

  const drawTiles = (canvas: SkCanvas, offX: number, offY: number, scale: number, pageNum: number) => {
    'worklet';

    canvas.save();
    
    drawTile(canvas, offX, offY, scale, pageNum, 0, 0);
    drawTile(canvas, offX, offY, scale, pageNum, 1, 0);
    drawTile(canvas, offX, offY, scale, pageNum, 2, 0);
    drawTile(canvas, offX, offY, scale, pageNum, 0, 1);
    drawTile(canvas, offX, offY, scale, pageNum, 1, 1);
    drawTile(canvas, offX, offY, scale, pageNum, 2, 1);
    drawTile(canvas, offX, offY, scale, pageNum, 0, 2);
    drawTile(canvas, offX, offY, scale, pageNum, 1, 2);
    drawTile(canvas, offX, offY, scale, pageNum, 2, 2);

    drawTile(canvas, offX, offY, scale, pageNum, 0, 3);
    drawTile(canvas, offX, offY, scale, pageNum, 1, 3);
    drawTile(canvas, offX, offY, scale, pageNum, 2, 3);
    canvas.restore();


  };

  const getOffScreenPage = (pageNum: number, yOff: number, scale: number) => {
    "worklet";

    const pageByOffset = Math.ceil(-yOff / (1050 * scale));
    if ((pageNum - pageByOffset) > (2 / scale)) {
      deleteAllTilesFromCacheForPage(pageNum);
      return null;
    }  

    scale = Math.ceil(scale);
    
    cleanUpOutofScaleTiles(pageNum,scale);

    if (global.pageCache == null) {
      global.pageCache = {};
    }

    if (global.pageCache[pageNum] == null) {
      global.pageCache[pageNum] = {};
    }


    const keys = Object.keys(global.pageCache[pageNum]);
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] != scale) {
          global.pageCache[pageNum][keys[i]].dispose();
          delete global.pageCache[pageNum][keys[i]];
          global.gc();
        }
    }

    if (global.pageCache[pageNum][scale] == null) {
      const offscreen = Skia.Surface.MakeOffscreen(stageWidth * PIXEL_ZOOM * scale, stageHeight * PIXEL_ZOOM * scale)!;
      
      const canvas = offscreen.getCanvas();
      drawTiles(canvas, 0, 0, scale, pageNum);
      global.gc();
      global.pageCache[pageNum][scale] = offscreen.makeImageSnapshot();
    }

    
    return global.pageCache[pageNum][scale];
  };


  const animatedMat = useDerivedValue(() => {
    // Update the matrix with decaying values. https://github.com/wcandillon/can-it-be-done-in-react-native/issues/174
    // This is the hook to re-render canvas when the page changes.
    return multiply4(translate(offsetX.value, offsetY.value), matrix.value);
  });

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
          <Group matrix={animatedMat}>
            {[...Array(PAGE_COUNT)].map((_, i) => (
              <Image key={i} image={useDerivedValue(() => getOffScreenPage(i, offsetY.value, scaleEndValue.value))} y={1050 * i} width={stageWidth} height={stageHeight} />
            ))}
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