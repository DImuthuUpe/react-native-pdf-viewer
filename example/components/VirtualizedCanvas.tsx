import React, { useState, useCallback } from "react";
import { ScrollView, View, Dimensions, StyleSheet } from "react-native";
import { Canvas, Paint, Path } from "@shopify/react-native-skia";

const { width } = Dimensions.get("window");
const ITEM_HEIGHT = 100; // Height of each drawable item
const TOTAL_ITEMS = 1000; // Total number of items
const VISIBLE_ITEMS = 10; // Items visible at any given time

export default function VirtualizedCanvas() {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: VISIBLE_ITEMS });

  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const start = Math.floor(offsetY / ITEM_HEIGHT);
    const end = start + VISIBLE_ITEMS;
    console.log("Offset: ", offsetY, "Start: ", start, "End: ", end);
    setVisibleRange({ start, end });
  }, []);

  const renderItems = () => {
    const items = [];
    for (let i = visibleRange.start; i <= visibleRange.end && i < TOTAL_ITEMS; i++) {
      const yPosition = i * ITEM_HEIGHT;
      items.push(
        <Path
          key={i}
          path={`M 0 ${yPosition} L ${width} ${yPosition + ITEM_HEIGHT}`}
          style="stroke"
          strokeWidth={2}
          color="blue"
        />
      );
    }
    return items;
  };

  return (
    <ScrollView
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ height: TOTAL_ITEMS * ITEM_HEIGHT }}
    >
      <Canvas style={{ width, height: VISIBLE_ITEMS * ITEM_HEIGHT }}>
        {renderItems()}
      </Canvas>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
