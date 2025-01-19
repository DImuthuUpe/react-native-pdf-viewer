import React from 'react';
import { Text, View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Skia, AlphaType, ColorType, Image, Rect } from "@shopify/react-native-skia";
import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import PdfPage from './components/PdfPage';

function App(): React.JSX.Element {
  
  const fileName = 'sample.pdf'; // Relative to assets
  const filePath = `${RNFS.MainBundlePath}/${fileName}`;
  const tileSize = 512
  const { width, height } = Dimensions.get("window");

  //const buf = PdfViewer.getBitmap(filePath, tileSize, tileSize, 0, 0);
  const buf = PdfViewer.getTile(filePath, 1, 0, 0, width, height, 1);
  const ints = new Uint8Array(buf);

  //console.log("Ints: ", ints);

  const data = Skia.Data.fromBytes(ints);
  const image = Skia.Image.MakeImage(
  {
      width: tileSize,
      height: tileSize,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.RGBA_8888,
  },
  data,
  tileSize * 4
  );

  
  const pageDims = PdfViewer.getAllPageDimensions(filePath);
  console.log("Page dimensions: ", pageDims);

  console.log("Image: is ", buf.byteLength);
  //console.log("Window width: ", width, " height ", height , " scale ", scale); 


  const pressed = useSharedValue<boolean>(false);
  const offsetX = useSharedValue<number>(0);
  const offsetY = useSharedValue<number>(0);
  
  const scale = useSharedValue<number>(1);

  const scaleGesture = Gesture.Pinch()
  .onChange((event) => {
    scale.value = event.scale;
  }
  );

  const pan = Gesture.Pan()
    .onBegin(() => {
    })
    .onChange((event) => {
      offsetX.value += event.changeX;
      offsetY.value += event.changeY;
    })
    .onFinalize(() => {
      //offsetY.value = withSpring(0);
    });

  const animatedStyles = useAnimatedStyle(() => ({
    backgroundColor: pressed.value ? 'blue' : 'green',
    transform: [
      {scale: scale.value},
      { translateX: offsetX.value },
      { translateY: offsetY.value },],
  }));

  const animatedProps = useAnimatedProps(() => {
    return {
      scale: scale.value,
    };
  });

  const derivedOffsetY = useDerivedValue(() => offsetY.value + 400);

  const calculatedWidth = useDerivedValue(() => width * scale.value);
  return (
    //<VirtualizedCanvas />
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <GestureDetector gesture={Gesture.Race(pan, scaleGesture)}>
          <Animated.View style={{backgroundColor: 'pink'}}>
            <PdfPage pageWidth={width} pageHeight={height} pageNumber={1} animatedProps={animatedProps} />
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

/*
<Canvas style={{ width, height }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Image
                  key={index}
                  image={image}
                  x={offsetX}
                  y={useDerivedValue(() => offsetY.value + index * 400 * scale.value)}
                  width={calculatedWidth}
                  height={height}
                />
              ))}
              
            </Canvas>
*/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  circle: {
    height: 120,
    width: 120,
    borderRadius: 500,
  },
});

export default App;