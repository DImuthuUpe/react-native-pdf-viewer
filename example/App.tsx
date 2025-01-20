import React, { useState } from 'react';
import { Text, View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Canvas, Circle, Group, Skia, AlphaType, ColorType, Image, Rect, Fill } from "@shopify/react-native-skia";
import { PdfViewer } from 'react-native-pdf-viewer';
import RNFS from 'react-native-fs';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
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
import { identity4 } from 'react-native-redash';

function App(): React.JSX.Element {
  
  const { width, height } = Dimensions.get("window");

  const radius = 30;
  const x = useSharedValue(100);
  const y = useSharedValue(100);
  const scale = useSharedValue(1);
  const pinchZooming = useSharedValue(false);
  // This style will be applied to the "invisible" animated view
  // that overlays the ball
  const style = useAnimatedStyle(() => ({
    position: "absolute",
    top: 0,
    left: 0,
    width: width,
    height: height,
    //transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  // The gesture handler for the ball
  const panGesture = Gesture.Pan().onChange((e) => {
    x.value += e.changeX;
    y.value += e.changeY;
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshTrigger = useSharedValue(0);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
  const scaleGesture = Gesture.Pinch().onChange((e) => {
    scale.value = e.scale;
    pinchZooming.value = true;
  }).onEnd(() => { 
    refreshTrigger.value += 1;
    pinchZooming.value = false;
  });

  useAnimatedReaction(
    () => refreshTrigger.value,
    (triggerValue) => {
      if (triggerValue > 0) {
        runOnJS(setRefreshKey)(triggerValue); // Synchronize React state
      }
    }
  );

  return (
    <GestureHandlerRootView>
      <View style={{ flex: 1 }}>
        <Canvas style={{ flex: 1 }}>
          <Fill color="pink" />
          <PdfPage pageWidth={width} pageHeight={height} pageNumber={1} translateX={x} translateY={y} scale={scale} refreshKey={refreshKey} pinchZooming={pinchZooming} />

          <Circle cx={x} cy={y} r={radius} color="cyan" />
        </Canvas>
        <GestureDetector gesture={Gesture.Race(panGesture, scaleGesture)}>
          <Animated.View style={style} />
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