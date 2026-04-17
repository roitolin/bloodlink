import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Button, Card, Searchbar, Text } from "react-native-paper";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";

type AuditLogItem = {
  id: string;
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  summary?: string;
  metadata?: Record<string, any>;
  createdAt?: any;
};

type FilterType = "all" | "request" | "user" | "report" | "block" | "system";

export default function AdminAuditLogsScreen() {
  const { isDesktop } = useResponsive();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [filtered, setFiltered] = useState<AuditLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: logs.length,
      request: 0,
      user: 0,
      report: 0,
      block: 0,
      system: 0,
    };
    logs.forEach((item) => {
      const key = String(item.targetType || "system");
      if (typeof counts[key] === "number") {
        counts[key] += 1;
      }
    });
    return counts;
  }, [logs]);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const next = logs.filter((item) => {
      const targetMatch = filterType === "all" || item.targetType === filterType;
      if (!targetMatch) return false;
      if (!normalized) return true;
      return [item.summary, item.action, item.targetType, item.targetId, item.adminId]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(normalized));
    });
    setFiltered(next);
  }, [filterType, logs, searchQuery]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "admin_audit_logs"), orderBy("createdAt", "desc")));
      const items = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as AuditLogItem[];
      setLogs(items);
    } catch (error) {
      console.error("Failed to load admin audit logs:", error);
      Alert.alert("Error", "Could not load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: AuditLogItem }) => {
    const createdAt =
      typeof item.createdAt?.toDate === "function" ? item.createdAt.toDate().toLocaleString() : "No timestamp";
    return (
      <Card style={styles.logCard} mode="elevated">
        <Card.Content>
          <View style={styles.rowBetween}>
            <Text style={styles.logAction}>{String(item.action || "unknown").toUpperCase()}</Text>
            <Text style={styles.logTime}>{createdAt}</Text>
          </View>
          <Text style={styles.logSummary}>{item.summary || "No summary"}</Text>
          <Text style={styles.logMeta}>Admin: {item.adminId || "N/A"}</Text>
          <Text style={styles.logMeta}>
            Target: {item.targetType || "system"} {item.targetId ? `| ${item.targetId}` : ""}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.headerCard} mode="elevated">
        <Card.Content>
          <Text style={styles.title}>Admin Audit Logs</Text>
          <Text style={styles.subtitle}>Track approve/reject/edit/ban operations for accountability.</Text>
          <View style={styles.headerActions}>
            <Button
              mode="contained"
              onPress={loadLogs}
              compact
              loading={loading}
              disabled={loading}
              style={styles.refreshButton}
              contentStyle={styles.actionButtonContent}
              labelStyle={styles.actionButtonLabel}
            >
              Refresh
            </Button>
            <Button
              mode="outlined"
              compact
              onPress={() => {
                setSearchQuery("");
                setFilterType("all");
              }}
              style={styles.resetButton}
              contentStyle={styles.actionButtonContent}
              labelStyle={styles.resetButtonLabel}
            >
              Clear Filters
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Searchbar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search summary, action, target, or admin id"
        style={styles.search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {[
          { value: "all", label: "All" },
          { value: "request", label: "Request" },
          { value: "user", label: "User" },
          { value: "report", label: "Report" },
          { value: "block", label: "Block" },
          { value: "system", label: "System" },
        ].map((item) => {
          const selected = filterType === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              onPress={() => setFilterType(item.value as FilterType)}
              style={[styles.filterChip, selected && styles.filterChipSelected]}
            >
              <View style={styles.filterChipContent}>
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{item.label}</Text>
                <View style={[styles.filterCountBubble, selected && styles.filterCountBubbleSelected]}>
                  <Text style={[styles.filterCountText, selected && styles.filterCountTextSelected]}>
                    {typeCounts[item.value] || 0}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={loadLogs}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No audit logs found.</Text> : null}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  containerDesktop: {
    maxWidth: 980,
    width: "100%",
    alignSelf: "center",
  },
  headerCard: {
    borderRadius: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#991b1b",
  },
  subtitle: {
    color: "#4b5563",
    marginTop: 4,
  },
  headerActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  refreshButton: {
    borderRadius: 999,
    backgroundColor: "#b91c1c",
  },
  resetButton: {
    borderRadius: 999,
    borderColor: "#fecaca",
    backgroundColor: "#fff",
  },
  actionButtonContent: {
    paddingHorizontal: 8,
    minHeight: 36,
  },
  actionButtonLabel: {
    fontWeight: "800",
    color: "#fff",
  },
  resetButtonLabel: {
    fontWeight: "700",
    color: "#b91c1c",
  },
  search: {
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  filterRow: {
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    backgroundColor: "#fff",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  filterChipSelected: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  filterChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterChipText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextSelected: {
    color: "#b91c1c",
  },
  filterCountBubble: {
    minWidth: 24,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountBubbleSelected: {
    backgroundColor: "#b91c1c",
  },
  filterCountText: {
    color: "#374151",
    fontWeight: "800",
    fontSize: 11,
  },
  filterCountTextSelected: {
    color: "#fff",
  },
  listContent: {
    paddingBottom: 24,
  },
  logCard: {
    borderRadius: 10,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  logAction: {
    color: "#7f1d1d",
    fontWeight: "800",
    fontSize: 12,
  },
  logTime: {
    color: "#6b7280",
    fontSize: 11,
  },
  logSummary: {
    marginTop: 4,
    color: "#111827",
    fontWeight: "700",
  },
  logMeta: {
    marginTop: 2,
    color: "#4b5563",
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 24,
  },
});

