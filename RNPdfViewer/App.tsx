import { AlphaType, Canvas, ColorType, Group, Image, matchFont, Matrix4, multiply4, Rect, scale, SkCanvas, SkData, Skia, SkImage, Text, translate, useTypeface } from "@shopify/react-native-skia";
import { useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, runOnJS, runOnUI } from "react-native-reanimated";
import RNFS from 'react-native-fs';
import { NitroModules } from "react-native-nitro-modules";
import { cleanUpOutofScaleTiles, deleteAllTilesFromCacheForPage, getTileFromCache, setTileInCache } from "./src/TileCache";
import { cleanUpOutofScalePageSnapshots, deleteAllSnapshotsFromCacheForPage, getPageFromCache, setPageInCache } from "./src/PageCache"; 
const fileName = 'A17_FlightPlan.pdf';//'sample.pdf'; // Relative to assets
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
const horizontalTiles = Math.ceil(width / TILE_SIZE)-1;
const canvasHeight = verticalTiles * TILE_SIZE;
const canvasWidth = horizontalTiles * TILE_SIZE;

const PAGE_GAP = 10;
const PAGE_COUNT = PdfiumModule.getPageCount();
const PIXEL_ZOOM = 2;
const MAX_SCALE = 3;
    
const App = () => {

  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(-2048);
  const scaleVal = useSharedValue<number>(1);
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
    scaleVal.value = e.scale;
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

    const offscreen = Skia.Surface.MakeOffscreen(
      TILE_SIZE * zoomFactor, 
      TILE_SIZE * zoomFactor)!;

    const canvas = offscreen.getCanvas();
    canvas.drawImage(img as SkImage, 0, 0);
    img?.dispose(); 
    data.dispose();
    const offImg = offscreen.makeImageSnapshot();
    offscreen.dispose();
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

  const getImageForTile = (xOff: number, yOff: number, scale: number, row: number, col: number) => {
    "worklet";

    if (yOff > 0) {
      return null;
    }
    
    const iteration = Math.floor(-yOff / canvasHeight);
    const offsetRow = Math.floor((-yOff % canvasHeight)/TILE_SIZE);

    const calculatedRow = offsetRow >= row ? iteration * verticalTiles + row : (iteration -1) * verticalTiles + row;

    const verticalTilesForPage = Math.ceil(pageDimensions.value[0][1] / TILE_SIZE);
    const localRow = calculatedRow % verticalTilesForPage;
    const page = Math.floor(calculatedRow / verticalTilesForPage);
    if (page < 0) {
      return null;
    }
    const img = getOffScreenTile(page, localRow, col, scale);
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
                <Image 
                x={useDerivedValue(() => scaleVal.value * (offsetX.value + horizontalTileId*TILE_SIZE))}
                y={useDerivedValue(() =>  { 
                  const absT = (offsetY.value + verticalTileId * TILE_SIZE) % canvasHeight;
                  const yPos =  absT < 0? absT + canvasHeight: absT;
                  return scaleVal.value * (yPos - TILE_SIZE * 2);})}
                image={useDerivedValue(() => getImageForTile(
                  offsetX.value, 
                  offsetY.value, 
                  scaleEndValue.value, 
                  verticalTileId, 
                  horizontalTileId))}
                width={useDerivedValue(() => TILE_SIZE * scaleVal.value)} 
                height={useDerivedValue(() => TILE_SIZE * scaleVal.value)}/>);
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