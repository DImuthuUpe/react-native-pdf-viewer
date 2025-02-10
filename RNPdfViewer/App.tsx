import { AlphaType, Canvas, ColorType, Group, Image, Matrix4, multiply4, Rect, scale, SkData, Skia, SkImage, Text, translate, useTypeface } from "@shopify/react-native-skia";
import { useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, runOnJS } from "react-native-reanimated";
import RNFS from 'react-native-fs';

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

PdfiumModule.openPdf(filePath);

const {width, height} = Dimensions.get('window');

const TILE_SIZE = 200;
const NUM_COLUMNS = Math.floor(width / TILE_SIZE);
const NUM_ROWS = Math.floor(height / TILE_SIZE);
const NUM_TILES = NUM_COLUMNS * NUM_ROWS;
const PAGE_GAP = 20;
const PAGE_COUNT = PdfiumModule.getPageCount();
const PIXEL_ZOOM = 4;
const MAX_SCALE = 3;


// Create an array of tile objects with position and image URI.
// (Replace the URI with your actual image sources.)
const tiles = Array.from({ length: NUM_TILES * PAGE_COUNT }, (_, totalTiles) => {
  const pageNumber = Math.trunc(totalTiles / NUM_TILES);
  const i = totalTiles % NUM_TILES;
  const row = Math.floor(i / NUM_COLUMNS);
  const col = i % NUM_COLUMNS;

  return {
    id: totalTiles,
    row: row,
    col: col,
    x: col * TILE_SIZE,
    y: row * TILE_SIZE + (pageNumber * NUM_ROWS * TILE_SIZE + PAGE_GAP * pageNumber),
    width: TILE_SIZE,
    height: TILE_SIZE,
    pageNumber: pageNumber,
    color: i % 2 === 0 ? "red" : "blue",
  };
});

function App(): React.JSX.Element {

  const origin = useSharedValue({ x: 0, y: 0 });
  const offset = useSharedValue(Matrix4());

  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(0);
  const scaleVal = useSharedValue<number>(1);
  
  const matrix = useSharedValue(Matrix4());

  const [visiblePage, setVisiblePage] = useState(0);

  const tileDataCache = useRef(new Map<number, SkImage>());

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
    scaleVal.value = e.scale;
  });


  const getTile = (tileid: number, tileRow: number, tileCol: number, scale: number, pageNumber: number, tileSize: number, pageWidth: number) => {

    const cacheEntry = tileDataCache.current.get(tileid)
    if (cacheEntry) {
      return cacheEntry;
    }
  
    const buf = PdfiumModule.getTile(pageNumber, -tileRow, -tileCol, pageWidth, tileSize * PIXEL_ZOOM, scale * PIXEL_ZOOM);
    const ints = new Uint8Array(buf);

    const data = Skia.Data.fromBytes(ints);
    const image = Skia.Image.MakeImage(
      {
          width: tileSize * PIXEL_ZOOM,
          height: tileSize * PIXEL_ZOOM,
          alphaType: AlphaType.Opaque,
          colorType: ColorType.RGBA_8888,
      },
      data,
      tileSize * PIXEL_ZOOM * 4);
    data.dispose();
    tileDataCache.current.set(tileid, image as SkImage);

    if (tileDataCache.current.size > 100) {
      tileDataCache.current.forEach((value, key) => {
        if (Math.abs(key - tileid) > 100) {
          console.log('disposing', key);
          value.dispose();
          tileDataCache.current.delete(key);
          console.log(HermesInternal.getInstrumentedStats())
        }
      });
    
    }

    return image;
  };
  
  const animatedMat = useDerivedValue(() => {
    // Update the matrix with decaying values. https://github.com/wcandillon/can-it-be-done-in-react-native/issues/174
    // This is the hook to re-render canvas when the page changes.
    runOnJS(setVisiblePage)(-Math.ceil(offsetY.value / (scaleVal.value * (NUM_ROWS * TILE_SIZE + PAGE_GAP))));
    return multiply4(translate(offsetX.value, offsetY.value), matrix.value);
  });

  return (  
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
          <Canvas style={{ flex: 1, backgroundColor: 'gray' }}> 
            <Group matrix={animatedMat}>
              {tiles.map((tile) => {

                if (Math.abs(tile.pageNumber - visiblePage) > 2) {
                  return null;
                }
                return (
                  <Image key={tile.id} x={tile.x} y={tile.y} width={tile.width} height={tile.height} 
                    image={getTile(tile.id, tile.row, tile.col, 0.5, tile.pageNumber, TILE_SIZE, width)! as SkImage} />
              )})}
            </Group>
          </Canvas>
        
        <GestureDetector gesture={Gesture.Race(pinchGesture, panGesture)}>
          <Animated.View style={[StyleSheet.absoluteFill]} />
        </GestureDetector>
      </View>
    </GestureHandlerRootView>);
  
};

export default App;