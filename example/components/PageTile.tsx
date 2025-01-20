import { Image } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";
import { useDerivedValue } from "react-native-reanimated";

export default function PageTile ({tile, x, y, tileSize, translateX, translateY, scale, pinchZooming}) {
    
     const getScaleFactor = useDerivedValue(() => {
        return (pinchZooming.value ? scale.value :  1);
    });

    const derivedX = useDerivedValue(() => {
        //console.log("pinchZooming: ", scale.value);
        return x * getScaleFactor.value  + translateX.value; // Derived from progress
    });

    const derivedY = useDerivedValue(() => {
        return y * getScaleFactor.value + translateY.value; // Derived from progress
    });
    
    const derivedTileSize = useDerivedValue(() => {
        //console.log("Tile size ", tileSize * (pinchZooming.value ? scale.value : 1))
        //console.log("Tile version: ", tileVersion);
        return tileSize * getScaleFactor.value; // Derived from progress
    });

    return (
    <Image image={tile} x={ derivedX }   y={ derivedY } width={derivedTileSize} height={derivedTileSize} />
    );
}