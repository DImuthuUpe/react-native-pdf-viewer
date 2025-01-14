import React from 'react';
import { Text, View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Skia, AlphaType, ColorType, Image } from "@shopify/react-native-skia";
import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';
import VirtualizedCanvas from './components/VirtualizedCanvas';

function App(): React.JSX.Element {
  
  const fileName = 'sample.pdf'; // Relative to assets
  const filePath = `${RNFS.MainBundlePath}/${fileName}`;
  
  const buf = PdfViewer.getBitmap(filePath, 2048, 2048, 0, 0);
  const ints = new Uint8Array(buf);

  const data = Skia.Data.fromBytes(ints);
  const image = Skia.Image.MakeImage(
  {
      width: 2048,
      height: 2048,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.RGBA_8888,
  },
  data,
  2048 * 4
  );

  const { width, height, scale } = Dimensions.get("window");
  
  const pageDims = PdfViewer.getAllPageDimensions(filePath);
  console.log("Page dimensions: ", pageDims);

  console.log("Image: is ", buf.byteLength);
  console.log("Window width: ", width, " height ", height , " scale ", scale); 
  return (
    //<VirtualizedCanvas />
    <ScrollView 
    scrollEventThrottle={16} 
    contentContainerStyle={{ height: 2048 , width: width}}
    minimumZoomScale={1}
    maximumZoomScale={3} // Adjust the max zoom level as needed
    bouncesZoom={true}>
    <Canvas style={{ width: width, height: height }}>
      <Image image={image} fit="contain" x={0} y={0} width={width} height={width * pageDims[0][1] / pageDims[0][0]} />
      <Image image={image} fit="contain" x={0} y={792/ 2} width={width} height={width * pageDims[0][1] / pageDims[0][0]} />

    </Canvas>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 40, 
    color: 'green'
  }
});

export default App;