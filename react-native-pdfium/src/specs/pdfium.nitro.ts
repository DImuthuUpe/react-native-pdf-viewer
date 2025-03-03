import { type HybridObject } from 'react-native-nitro-modules'

export interface PdfiumUtil extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    add(a: number, b: number): number
    openPdf(filePath: string): void
    closePdf(): void
    getTile(pageNumber: number, row: number, column: number, displayWidth: number, tileWidth: number, tileHeight: number, scale: number): ArrayBuffer
    getTileBgr565(pageNumber: number, row: number, column: number, displayWidth: number, tileWidth: number, tileHeight: number, scale: number): ArrayBuffer
    getPageCount(): number
    getAllPageDimensions(): [number, number, number][]
}