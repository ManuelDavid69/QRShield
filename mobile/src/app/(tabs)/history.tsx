import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import ScanListItem from "@/components/ScanListItem";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, listScans, type Scan, type Verdict } from "@/services/api";

const PAGE_SIZE = 20;

const FILTERS: { label: string; value: Verdict | undefined }[] = [
  { label: "Tous", value: undefined },
  { label: "Dangereux", value: "dangerous" },
  { label: "Suspects", value: "suspicious" },
  { label: "Sûrs", value: "safe" },
];

export default function HistoryScreen() {
  const { token, signOut } = useAuth();
  const router = useRouter();

  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined);
  const [items, setItems] = useState<Scan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La longueur courante est lue via une ref : load reste stable entre deux pages
  const itemsRef = useRef<Scan[]>([]);
  // Empêche onEndReached de lancer deux chargements de suite
  const loadingMore = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const load = useCallback(
    async (reset: boolean) => {
      if (token === null) return;
      if (reset) setLoading(true);
      const offset = reset ? 0 : itemsRef.current.length;
      try {
        const data = await listScans(token, { limit: PAGE_SIZE, offset, verdict });
        setTotal(data.total);
        setError(null);
        setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          await signOut();
          return;
        }
        setError(cause instanceof Error ? cause.message : "Une erreur est survenue.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        loadingMore.current = false;
      }
    },
    [token, verdict, signOut],
  );

  // Recharge à chaque retour sur l'écran et à chaque changement de filtre
  useFocusEffect(
    useCallback(() => {
      if (token === null) return;
      itemsRef.current = [];
      setItems([]);
      void load(true);
    }, [token, load]),
  );

  const handleEndReached = useCallback(() => {
    if (loadingMore.current) return;
    if (itemsRef.current.length >= total) return;
    loadingMore.current = true;
    void load(false);
  }, [load, total]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {FILTERS.map((filter) => {
          const active = filter.value === verdict;
          return (
            <TouchableOpacity
              key={filter.label}
              style={[styles.chip, active && styles.chipActive]}
              activeOpacity={0.8}
              onPress={() => setVerdict(filter.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(scan) => scan.id}
        renderItem={({ item }) => (
          <ScanListItem
            scan={item}
            onPress={() => router.push({ pathname: "/scan/[id]", params: { id: item.id } })}
          />
        )}
        contentContainerStyle={styles.content}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.empty} color={colors.primary} />
          ) : (
            <Text style={styles.emptyText}>{error ?? "Aucun scan pour le moment."}</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primaryText,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  empty: {
    marginTop: 32,
  },
  emptyText: {
    marginTop: 32,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
});
