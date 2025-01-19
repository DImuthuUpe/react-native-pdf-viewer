import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';
import { Text, View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Skia, AlphaType, ColorType, Image, Rect, SkImage } from "@shopify/react-native-skia";
import { useAnimatedProps } from 'react-native-reanimated';


interface PdfPageProps {
    pageWidth: number;
    pageHeight: number;
    pageNumber: number;
    animatedProps?: {
        scale?: number;
    };
}

export default function PdfPage({ pageWidth, pageHeight, pageNumber, animatedProps }: PdfPageProps) {
    const fileName = 'sample.pdf'; // Relative to assets
      const filePath = `${RNFS.MainBundlePath}/${fileName}`;
      const tileSize = 512
      const { width, height } = Dimensions.get("window");
    
      const tiles :  SkImage[] = [];

      for (let i = 0; i < Math.ceil(pageWidth / tileSize) + 1; i++) {
        for (let j = 0; j < Math.ceil(pageHeight / tileSize); j++) {
            console.log("Tile index pair: ", i, j);
          const buf = PdfViewer.getTile(filePath, pageNumber, -j, -i, tileSize, tileSize, 1);
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
            tiles.push(image);
          }
        }
      }

      const animatedStyle = useAnimatedProps(() => ({
        scale: animatedProps?.scale || 1, // Default scale is 1
      }));

      const shrinkTileSize = tileSize / 2;
      console.log("Animated props: ", animatedProps);

      const scale = animatedStyle.scale;
      console.log("Scale: ", scale);
    return (
        <Canvas style={{ width, height }}>
            {
                tiles.map((tile, index) => {
                    //console.log("Tile index: ", index);
                    const numColumns = Math.ceil(pageWidth / tileSize);
                    const numRows = Math.ceil(pageHeight / tileSize);
                    //console.log("Num columns: ", numColumns, " Num rows: ", numRows);
                    const rowInPage = index % numRows;
                    const columnInPage = Math.floor(index / numRows);
                    //console.log("Row in page: ", rowInPage, " Column in page: ", columnInPage);
                    return <Image key={index} image={tile} x={columnInPage * shrinkTileSize} y={rowInPage * shrinkTileSize} width={shrinkTileSize * scale} height={shrinkTileSize * scale} />;
                })
            }
                      
        </Canvas>
    );
}

