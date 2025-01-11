import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Canvas, Circle, Group, Skia, AlphaType, ColorType, Image } from "@shopify/react-native-skia";
import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';

function App(): React.JSX.Element {
  
  const fileName = 'sample.pdf'; // Relative to assets
  const filePath = `${RNFS.MainBundlePath}/${fileName}`;
  
  const buf = PdfViewer.getBitmap(filePath, 1024, 1024, 0, 0);
  const ints = new Uint8Array(buf);

  const data = Skia.Data.fromBytes(ints);
  const image = Skia.Image.MakeImage(
  {
      width: 1024,
      height: 1024,
      alphaType: AlphaType.Opaque,
      colorType: ColorType.RGBA_8888,
  },
  data,
  1024 * 4
  );
  
  console.log("Image: is ", buf.byteLength); 
  return (
    <Canvas style={{flex: 1}}>
      <Image image={image} fit="contain" x={0} y={0} width={1024} height={1024} />
    </Canvas>
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