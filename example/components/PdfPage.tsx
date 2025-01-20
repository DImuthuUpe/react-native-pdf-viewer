import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';
import { Text, View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Skia, AlphaType, ColorType, Image, Rect, SkImage } from "@shopify/react-native-skia";
import { useAnimatedProps, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import PageTile from './PageTile';
import { useEffect, useState } from 'react';


interface PdfPageProps {
    pageWidth: number;
    pageHeight: number;
    pageNumber: number;
}

export default function PdfPage({ pageWidth, 
  pageHeight, pageNumber, translateX, translateY, scale, 
  refreshKey, pinchZooming }: PdfPageProps) {
      
  const [images, setImages] = useState<SkImage[]>([]);

  const tileSize = 512
  const shrinkTileSize = tileSize / 2;
  const fileName = 'sample.pdf'; // Relative to assets
  const filePath = `${RNFS.MainBundlePath}/${fileName}`;
  const columns = Math.ceil(pageWidth / tileSize) * 2;
  const rows = Math.ceil(pageHeight / tileSize) * 2;
  const [prevScale, setPrevScale] = useState(1);

  useEffect(() => { 
      console.log("Refresh key: ", refreshKey);
      console.log('Component is mounted');
      
      for (let i = 0; i < images.length; i++) {
        images[i].dispose();
      }
      images.length = 0;
      
      const startTime = performance.now();
      for (let i = 0; i < columns; i++) {
        for (let j = 0; j < rows; j++) {
          const buf = PdfViewer.getTile(filePath, pageNumber, -j, -i, tileSize, tileSize, prevScale * scale.value);
          setPrevScale(prevScale * scale.value)
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
          tileSize * 4
          );
          if (image) {
            setImages((prevImages) => [...prevImages, image]);
          }
        }
      }  
      const endTime = performance.now(); // End time
    //console.log(`Execution Time: ${(endTime - startTime).toFixed(2)} ms`);
      return () => {
        //console.log('Component is being destroyed');
      };
  }, [refreshKey]);
  return (
      <Group>
          {images.map((tile, index) => {
              //console.log("Tile index: ", index);
            
              const rowInPage = index % rows;
              const columnInPage = Math.floor(index / rows);                

              return <PageTile  key={index} 
                                tile={tile} 
                                x={columnInPage * shrinkTileSize} 
                                y={rowInPage * shrinkTileSize} 
                                tileSize={shrinkTileSize} 
                                translateX={translateX} 
                                translateY={translateY} 
                                scale={scale} pinchZooming={pinchZooming}/>;
          })}
      </Group>
  );
}

