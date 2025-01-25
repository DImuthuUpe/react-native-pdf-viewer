import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Skia, AlphaType, ColorType, Fill, Image, SkImage, Rect, SkData } from '@shopify/react-native-skia';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';
import { LRUMap } from 'lru_map';
import LRUMapWithCallback from './components/TileCache';


const tileCache = new LRUMap(20);  

function App(): React.JSX.Element {

  const tileSize = 512;
  const MAX_SCALE = 1.5;
  const scale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const [scaleEnd, setScaleEnd] = useState(1);

  const fileName = 'sample.pdf'; // Relative to assets
  const filePath = `${RNFS.MainBundlePath}/${fileName}`;

  const {width, height} = Dimensions.get('window');

  const getTileData = (tileRow: number, tileCol: number, scale: number, 
    pageNumber: number, tileZoom: number) => {
    const buf = PdfViewer.getTile(filePath, pageNumber, -tileRow, 
      -tileCol, width, tileSize * tileZoom,
      scale, 1, 100);
      
    const ints = new Uint8Array(buf);
    //console.log("Skia image ints length ", ints.length);
    const data = Skia.Data.fromBytes(ints);

    return data;
  };

  const getSkiaImageFromJsi = (tileRow: number, tileCol: number, 
      scale: number, pageNumber: number) => {

      scale = Math.ceil(scale);
      const tileZoom = 2 * scale;
      const cacheKey = `${tileRow}-${tileCol}-${scale}-${pageNumber}`;
      let data = tileCache.get(cacheKey);

      if(!data) {
        console.log("Skia image data not in cache for key ", cacheKey);
        data = getTileData(tileRow, tileCol, scale, pageNumber, tileZoom);
        tileCache.set(cacheKey, data);
      } else {
        console.log("Skia image data from cache for key ", cacheKey); 
      }

      //console.log("Skia image data ", data);
      const image = Skia.Image.MakeImage(
        {
            width: tileSize * tileZoom,
            height: tileSize * tileZoom,
            alphaType: AlphaType.Opaque,
            colorType: ColorType.RGBA_8888,
        },
        data,
        tileSize * tileZoom * 4);

      return image;
    }


  const panGesture = Gesture.Pan().onChange((e) => {
    translationX.value += e.changeX;
    translationY.value += e.changeY;
  });
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
  const scaleGesture = Gesture.Pinch().onChange((e) => {
    scale.value +=  e.scaleChange - 1;
    if (scale.value > MAX_SCALE) {
      scale.value = MAX_SCALE;
    }
  }).onEnd(() => { 
    runOnJS(() => {
      setScaleEnd(scale.value);
    })();
  }).runOnJS(true);

  return (
    <GestureHandlerRootView>
      <View style={{ flex: 1 }}>
        <Canvas style={{ flex: 1 }}>
          <Fill color="pink" />
          <Image x={translationX} y={translationY} image={getSkiaImageFromJsi(0, 0, scale.value, 1)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />
          <Image x={useDerivedValue(() => translationX.value + tileSize * scale.value)} y={translationY} image={getSkiaImageFromJsi(0, 1, scale.value, 1)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />
          <Image x={useDerivedValue(() => translationX.value + tileSize * scale.value)} y={useDerivedValue(() => translationY.value + tileSize * scale.value)} image={getSkiaImageFromJsi(1, 1, scale.value, 1)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />
          <Image x={useDerivedValue(() => translationX.value)} y={useDerivedValue(() => translationY.value + tileSize * scale.value)} image={getSkiaImageFromJsi(1, 0, scale.value, 1)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />

          <Image 
          x={useDerivedValue(() => translationX.value)} 
          y={useDerivedValue(() => translationY.value + height * scale.value)} 
          image={getSkiaImageFromJsi(0, 0, scale.value, 2)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />
          <Image 
          x={useDerivedValue(() => translationX.value + tileSize * scale.value)} 
          y={useDerivedValue(() => translationY.value + height * scale.value)}  
          image={getSkiaImageFromJsi(0, 1, scale.value, 2)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />
          <Image 
          x={useDerivedValue(() => translationX.value + tileSize * scale.value)} 
          y={useDerivedValue(() => translationY.value + tileSize * scale.value + height * scale.value)} 
          image={getSkiaImageFromJsi(1, 1, scale.value, 2)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />
          <Image 
          x={useDerivedValue(() => translationX.value)} 
          y={useDerivedValue(() => translationY.value + tileSize * scale.value + height * scale.value)} 
          image={getSkiaImageFromJsi(1, 0, scale.value, 2)} width={useDerivedValue(() => tileSize * scale.value)} height={useDerivedValue(() => tileSize * scale.value)} />

        </Canvas>
        <GestureDetector gesture={Gesture.Race(panGesture, scaleGesture)}>
          <Animated.View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "pink",
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  canvas: {
    flex: 1,
  },
  animatedCanvas: {
    flex: 1,
  },
});

export default App;