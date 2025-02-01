import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Skia, AlphaType, ColorType, Fill, Image, SkImage, Rect, SkData } from '@shopify/react-native-skia';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { PdfiumModule } from 'react-native-pdfium';
import RNFS from 'react-native-fs';
import TileCache from './components/TileCache';
const tileSize = 128;

const tileCache = new TileCache(100,  tileSize);
const thumbnailCache = new Map<string, [SkData, SkImage]>();

const fileName = 'sample.pdf'; // Relative to assets
const filePath = `${RNFS.MainBundlePath}/${fileName}`;

const {width, height} = Dimensions.get('window');

const getTileData = (tileRow: number, tileCol: number, scale: number, 
  pageNumber: number, tileZoom: number) => {
  const buf = PdfiumModule.getTile(pageNumber, -tileRow, -tileCol, width, tileSize * tileZoom, scale);
  const ints = new Uint8Array(buf);
  const data = Skia.Data.fromBytes(ints);
  return data;
};

const getTileImage = (data: SkData, scale: number) => {

  const tileZoom = 2 * scale;
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

PdfiumModule.openPdf(filePath);
const totalPages = PdfiumModule.getPageCount(filePath);
const totalRows = 8;
const totalCols = 7;
const images = [];
for (let i = 0; i < totalPages; i++) {
  for (let j = 0; j < totalRows; j++) {
    for (let k = 0; k < totalCols; k++) {
      images.push({ page: i + 1, row: j, col: k });
      const cacheKey = `${i + 1}-${0.5}-${j}-${k}`;
      const previewImageData = getTileData(j, k, 0.5, i + 1, 1);
      const previewImage = getTileImage(previewImageData, 0.5);
      if (previewImage !== null) {
        console.log("Setting preview image in cache for key ", cacheKey);
        thumbnailCache.set(cacheKey, [previewImageData, previewImage]);
      }
    }
  }
}

function App(): React.JSX.Element {

  const MAX_SCALE = 1.5;
  const scale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const [scaleEnd, setScaleEnd] = useState(1);
  const [translationXEnd, setTranslationXEnd] = useState(0);
  const [translationYEnd, setTranslationYEnd] = useState(0);
  const [tileVersion, setTileVersion] = useState(0);

  const doesTileVisible = (page: number, tileRow: number, tileCol: number, scale: number) => {  
    const viewPortX = -translationX.value;
    const viewPortY = -translationY.value;
    const viewPortWidth = width;
    const viewPortHeight = height;
    const x1_min = viewPortX
    const x1_max = viewPortX + viewPortWidth
    const y1_min = viewPortY
    const y1_max = viewPortY + viewPortHeight

    const tileX = tileCol * tileSize * scale;
    const tileY = tileRow * tileSize * scale + (page - 1) * height * scale;
    const tileWidth = tileSize * scale;
    const tileHeight = tileSize * scale;

    const x2_min = tileX
    const x2_max = tileX + tileWidth
    const y2_min = tileY  
    const y2_max = tileY + tileHeight

    if (x1_max <= x2_min || x1_min >= x2_max) {
      return false;
    }

    if (y1_max <= y2_min || y1_min >= y2_max) {
      return false;
    }


    return true;
  }

  const getSkiaImageFromJsi = (tileRow: number, tileCol: number, 
      scale: number, pageNumber: number) => {

      scale = Math.ceil(scale);

      let tileZoom = 2 * scale;
      const cacheKey = `${pageNumber}-${scale}-${tileRow}-${tileCol}`;
      const tumbnailCacheKey = `${pageNumber}-0.5-${tileRow}-${tileCol}`;
      
      const cachedTile = tileCache.get(cacheKey);
      let data: SkData | undefined;
      let image: SkImage | undefined;

      if (cachedTile) {
        [data, image] = cachedTile;
      } else {
        console.log("Skia image data not in cache for key ", cacheKey);
        tileZoom = 1;
        const thumbnailCacheEntry = thumbnailCache.get(tumbnailCacheKey);
        if (thumbnailCacheEntry) {
          [data, image] = thumbnailCacheEntry;
        }
      }

      return image;
    }

  const panGesture = Gesture.Pan().onChange((e) => {
    translationX.value += e.changeX;
    translationY.value += e.changeY;
  }).onEnd((success) =>{
    runOnJS(() => {
      setTranslationXEnd(translationX.value);
      setTranslationYEnd(translationY.value);
    })();
  }).runOnJS(true);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   
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

  useEffect(() => { 
    return () => {
      console.log("Closing pdf");
      PdfiumModule.closePdf();
    }
  }, []);

  useEffect(() => {
    console.log("Scale end ", scaleEnd);
    if (scaleEnd < 1) {
      return
    }

    images.map(({ page, row, col }, index) => {

      if (doesTileVisible(page, row, col, scaleEnd)) {
        const scaleCeil = Math.ceil(scaleEnd);
        const tileZoom = 2 * scaleCeil
        const cacheKey = `${page}-${scaleCeil}-${row}-${col}`;
        if (!tileCache.get(cacheKey)) {
          const previewImageData = getTileData(row, col, scaleCeil, page, tileZoom);
          const previewImage = getTileImage(previewImageData, scaleCeil);
          if (previewImage !== null) {
            tileCache.set(cacheKey, [previewImageData, previewImage]);
          }
        }
      }
    });
    setTileVersion(tileVersion + 1);
  }, [scaleEnd, translationXEnd, translationYEnd]);

  return (
    <GestureHandlerRootView>
      <View style={{ flex: 1 }}>
        <Canvas style={{ flex: 1 }}>
          <Fill color="pink" />

          {images.map(({ page, row, col }, index) => (
            <Image
              key={index}
              x={useDerivedValue(() => translationX.value + col * tileSize * scale.value)}
              y={useDerivedValue(() => translationY.value + row * tileSize * scale.value + (page -1) * height * scale.value)}
              //image={getSkiaImageFromJsi(row, col, useDerivedValue(() => scale.value).value, page)}
              image={ tileCache.get(`${page}-${Math.ceil(scale.value)}-${row}-${col}`)? tileCache.get(`${page}-${Math.ceil(scale.value)}-${row}-${col}`)[1]: thumbnailCache.get(`${page}-${0.5}-${row}-${col}`)[1]  }
              width={useDerivedValue(() => tileSize * scale.value)}
              height={useDerivedValue(() => tileSize * scale.value)}
            />
          ))}
          
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