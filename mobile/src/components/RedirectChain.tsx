import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";

interface RedirectChainProps {
  chain: string[];
}

export default function RedirectChain({ chain }: RedirectChainProps) {
  if (chain.length < 2) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Redirections ({chain.length - 1})</Text>
      {chain.map((url, index) => {
        const isLast = index === chain.length - 1;
        return (
          <Fragment key={`${index}-${url}`}>
            {index > 0 ? <Text style={styles.arrow}>↓</Text> : null}
            <Text
              style={[styles.url, isLast && styles.lastUrl]}
              numberOfLines={3}
              selectable
            >
              {url}
            </Text>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  url: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  arrow: {
    color: colors.textMuted,
    fontSize: 12,
  },
  lastUrl: {
    color: colors.text,
    fontWeight: "600",
  },
});
