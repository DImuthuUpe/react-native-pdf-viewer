import { type HybridObject } from 'react-native-nitro-modules'

export interface PdfViewer extends HybridObject<{ ios: 'c++', android: 'c++' }> {
  sum(num1: number, num2: number): number
  getBitmap(filePath: string, width: number, height: number, x: number, y: number): ArrayBuffer
  getTile(filePath: string, pageNumber: number, row: number, column: number, 
    displayWidth: number, tileSize: number, scale: number, version: number, tiles: number): ArrayBuffer
  getPageCount(filePath: string): number
  getAllPageDimensions(filePath: string): [number, number][]
}