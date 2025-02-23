import { AlphaType, Canvas, ColorType, Group, Image, Matrix4, multiply4, Rect, scale, SkCanvas, SkData, Skia, SkImage, Text, translate, useTypeface } from "@shopify/react-native-skia";
import { useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, runOnJS, runOnUI } from "react-native-reanimated";
import RNFS from 'react-native-fs';
import { NitroModules } from "react-native-nitro-modules";
import { cleanUpOutofScaleTiles, deleteAllTilesFromCacheForPage, getTileFromCache, setTileInCache } from "./src/TileCache";
import { cleanUpOutofScalePageSnapshots, deleteAllSnapshotsFromCacheForPage, getPageFromCache, setPageInCache } from "./src/PageCache"; 
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
const PAGE_GAP = 10;
const PAGE_COUNT = PdfiumModule.getPageCount();
const PIXEL_ZOOM = 2;
const MAX_SCALE = 3;
    
const App = () => {

  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(0);
  const origin = useSharedValue({ x: 0, y: 0 });
  const offset = useSharedValue(Matrix4());
  const matrix = useSharedValue(Matrix4());
  const scaleEndValue = useSharedValue<number>(1);
  const pageDimensions = useSharedValue(PdfiumModule.getAllPageDimensions());

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
    const tileBuf = boxedPdfium.unbox().getTile(page, -row, -col, width, TILE_SIZE * zoomFactor, zoomFactor);

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
    
    const pageWidth = pageDimensions.value[pageNum][0] * PIXEL_ZOOM;
    const pageHeight = pageDimensions.value[pageNum][0] * PIXEL_ZOOM;

    const numCols = Math.ceil(pageWidth / TILE_SIZE);
    const numRows = Math.ceil(pageHeight / TILE_SIZE);

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        drawTile(canvas, offX, offY, scale, pageNum, col, row);
      }
    }
    canvas.restore();
  };

  const getOffScreenPage = (pageNum: number, yOff: number, scale: number) => {
    "worklet";

    const pageTopY = PAGE_GAP * pageNum + pageDimensions.value[pageNum][2] - pageDimensions.value[0][1];
    const pageBottomY = pageTopY + pageDimensions.value[pageNum][1];

    if (pageBottomY * scale < -yOff || pageTopY * scale > -yOff + height) {
      deleteAllTilesFromCacheForPage(pageNum);
      deleteAllSnapshotsFromCacheForPage(pageNum);
      return null;
    }

    scale = Math.ceil(scale);
    
    cleanUpOutofScaleTiles(pageNum,scale);
    cleanUpOutofScalePageSnapshots(pageNum, scale);

    var img = getPageFromCache(pageNum, scale);

    if (img == null) {
      const offscreen = Skia.Surface.MakeOffscreen(
        pageDimensions.value[pageNum][0] * PIXEL_ZOOM * scale, 
        pageDimensions.value[pageNum][1] * PIXEL_ZOOM * scale)!;

      const canvas = offscreen.getCanvas();
      drawTiles(canvas, 0, 0, scale, pageNum);
      img = offscreen.makeImageSnapshot();
      setPageInCache(pageNum, scale, img);
    }
    return img;
  };


  const animatedMat = useDerivedValue(() => {
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
              <Image key={i} 
              image={useDerivedValue(() => getOffScreenPage(i, offsetY.value, scaleEndValue.value))} 
              y={pageDimensions.value[i][2] - pageDimensions.value[0][1] + PAGE_GAP * i} 
              width={pageDimensions.value[i][0]}
              height={pageDimensions.value[i][1]} />
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