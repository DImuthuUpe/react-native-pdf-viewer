import { AlphaType, Canvas, ColorType, Group, Image, Matrix4, multiply4, Rect, scale, Skia, SkImage, translate } from "@shopify/react-native-skia";
import { StrictMode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PdfiumModule } from "react-native-pdfium";
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue, withDecay } from "react-native-reanimated";
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

const getTile = (tileRow: number, tileCol: number, scale: number, pageNumber: number, tileSize: number, pageWidth: number) => {
  const buf = PdfiumModule.getTile(pageNumber, -tileRow, -tileCol, pageWidth, tileSize, scale);
  const ints = new Uint8Array(buf);
  const data = Skia.Data.fromBytes(ints);

  const image = Skia.Image.MakeImage(
    {
        width: tileSize,
        height: tileSize,
        alphaType: AlphaType.Opaque,
        colorType: ColorType.RGBA_8888,
    },
    data,
    tileSize * 4);

  return [image, data];
};


const TILE_SIZE = 200;
const NUM_TILES = 140;
const NUM_COLUMNS = 10;
const NUM_ROWS = NUM_TILES / NUM_COLUMNS;
const PAGE_GAP = 20;
const PAGE_COUNT = PdfiumModule.getPageCount(filePath);

// Create an array of tile objects with position and image URI.
// (Replace the URI with your actual image sources.)
const tiles = Array.from({ length: NUM_TILES * PAGE_COUNT }, (_, totalTiles) => {
  const pageNumber = Math.trunc(totalTiles / NUM_TILES);
  const i = totalTiles % NUM_TILES;
  const row = Math.floor(i / NUM_COLUMNS);
  const col = i % NUM_COLUMNS;
  return {
    id: totalTiles,
    x: col * TILE_SIZE,
    y: row * TILE_SIZE + (pageNumber * NUM_ROWS * TILE_SIZE + PAGE_GAP * pageNumber),
    width: TILE_SIZE,
    height: TILE_SIZE,
    color: i % 2 === 0 ? "red" : "blue",
    tileData: getTile(row, col, 1, pageNumber + 1, TILE_SIZE, 1000),
  };
});

function App(): React.JSX.Element {

  const origin = useSharedValue({ x: 0, y: 0 });
  const offset = useSharedValue(Matrix4());

  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(0);
  
  const matrix = useSharedValue(Matrix4());

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
    matrix.value = multiply4(
      offset.value,
      scale(e.scale, e.scale, 1, origin.value)
    );
  });


  const animatedMat = useDerivedValue(() => {
    // Update the matrix with decaying values. https://github.com/wcandillon/can-it-be-done-in-react-native/issues/174
    return multiply4(translate(offsetX.value, offsetY.value), matrix.value);
  });

  return (  
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <Canvas style={{ flex: 1, backgroundColor: 'gray' }}> 
          <Group matrix={animatedMat}>
          {tiles.map((tile) => (
            <Image key={tile.id} x={tile.x} y={tile.y} width={tile.width} height={tile.height} image={tile.tileData[0] as SkImage} />
          ))}
          </Group>
        </Canvas>
        <GestureDetector gesture={Gesture.Race(pinchGesture, panGesture)}>
          <Animated.View style={[StyleSheet.absoluteFill]} />
        </GestureDetector>
      </View>
    </GestureHandlerRootView>);
  
};

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#b58df1',
  },
});
export default App;