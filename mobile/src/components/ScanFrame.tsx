import { StyleSheet, Text, View } from "react-native";

const FRAME_SIZE = 260;
const CORNER_SIZE = 34;
const MASK_COLOR = "rgba(15, 23, 42, 0.55)";

export default function ScanFrame() {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.mask} />
      <View style={styles.centerRow}>
        <View style={styles.mask} />
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
        <View style={styles.mask} />
      </View>
      <View style={[styles.mask, styles.bottomMask]}>
        <Text style={styles.hint}>Placez le QR code dans le cadre</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  mask: {
    flex: 1,
    backgroundColor: MASK_COLOR,
  },
  centerRow: {
    height: FRAME_SIZE,
    flexDirection: "row",
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  bottomMask: {
    alignItems: "center",
    paddingTop: 28,
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#FFFFFF",
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  hint: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
