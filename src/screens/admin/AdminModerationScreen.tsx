import { useEffect, useState } from "react";
import { Alert, FlatList, Image, Linking, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Button, Card, SegmentedButtons, Text } from "react-native-paper";
import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { buildRiskProfiles, RiskProfile } from "../../utils/riskScoring";
import { logAdminAction } from "../../utils/adminAuditLog";

type ModerationMode = "reports" | "blocks" | "risk";

type AbuseReport = {
  id: string;
  reporterId: string;
  targetUserId: string;
  reporterName?: string | null;
  targetName?: string | null;
  requestId?: string | null;
  conversationId?: string | null;
  reason: string;
  details?: string;
  evidenceURL?: string | null;
  source?: string;
  status?: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt?: any;
};

type BlockRecord = {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  active?: boolean;
  createdAt?: any;
};

export default function AdminModerationScreen() {
  const navigation = useNavigation<any>();
  const { isDesktop } = useResponsive();
  const [mode, setMode] = useState<ModerationMode>("reports");
  const [reports, setReports] = useState<AbuseReport[]>([]);
  const [blocks, setBlocks] = useState<BlockRecord[]>([]);
  const [riskProfiles, setRiskProfiles] = useState<RiskProfile[]>([]);
  const [userLookup, setUserLookup] = useState<Record<string, { fullName?: string; email?: string; role?: string }>>({});
  const [latestRequestIdsByUser, setLatestRequestIdsByUser] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [reportsSnap, blocksSnap] = await Promise.all([
        getDocs(query(collection(db, "abuse_reports"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "user_blocks"), orderBy("createdAt", "desc"))),
      ]);
      const [requestsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "requests")),
        getDocs(collection(db, "users")),
      ]);
      const userMap = usersSnap.docs.reduce((acc, item) => {
        const data = item.data() as any;
        acc[item.id] = {
          fullName: data?.fullName || "",
          email: data?.email || "",
          role: data?.role || "user",
        };
        return acc;
      }, {} as Record<string, { fullName?: string; email?: string; role?: string }>);
      const requestRecords = requestsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) }));
      const sortedRequests = requestRecords.sort((a, b) => {
        const aTime = a?.createdAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b?.createdAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });
      const requestMap: Record<string, string[]> = {};
      sortedRequests.forEach((item) => {
        const requesterId = String(item?.requesterId || "");
        if (!requesterId) return;
        if (!requestMap[requesterId]) {
          requestMap[requesterId] = [];
        }
        if (requestMap[requesterId].length < 3) {
          requestMap[requesterId].push(item.id);
        }
      });

      const nextReports = reportsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) } as AbuseReport));
      const nextBlocks = blocksSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) } as BlockRecord));
      setUserLookup(userMap);
      setReports(nextReports);
      setBlocks(nextBlocks);
      setLatestRequestIdsByUser(requestMap);
      setRiskProfiles(
        buildRiskProfiles({
          reports: nextReports,
          blocks: nextBlocks,
          requests: requestRecords,
          users: usersSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })),
        })
      );
    } catch (error) {
      console.error("Failed to load moderation queue:", error);
      Alert.alert("Error", "Could not load moderation queue.");
    } finally {
      setLoading(false);
    }
  };

  const setReportStatus = async (reportId: string, status: AbuseReport["status"]) => {
    try {
      await updateDoc(doc(db, "abuse_reports", reportId), {
        status,
        updatedAt: new Date(),
      });
      setReports((prev) => prev.map((item) => (item.id === reportId ? { ...item, status } : item)));
      await logAdminAction({
        adminId: auth.currentUser?.uid,
        action: "report_status_updated",
        targetType: "report",
        targetId: reportId,
        summary: `Updated abuse report ${reportId} to ${status}`,
      });
      await loadQueue();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update report.");
    }
  };

  const deactivateBlock = async (blockId: string) => {
    try {
      await updateDoc(doc(db, "user_blocks", blockId), {
        active: false,
        updatedAt: new Date(),
      });
      setBlocks((prev) => prev.map((item) => (item.id === blockId ? { ...item, active: false } : item)));
      await logAdminAction({
        adminId: auth.currentUser?.uid,
        action: "block_deactivated",
        targetType: "block",
        targetId: blockId,
        summary: `Deactivated block record ${blockId}`,
      });
      await loadQueue();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update block.");
    }
  };

  const renderReport = ({ item }: { item: AbuseReport }) => (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Reason: {item.reason}</Text>
          <Text style={styles.status}>{(item.status || "open").toUpperCase()}</Text>
        </View>
        <Text style={styles.meta}>
          Reporter: {item.reporterName || userLookup[item.reporterId]?.fullName || userLookup[item.reporterId]?.email || "Unknown"}
        </Text>
        <Text style={styles.meta}>Reporter UID: {item.reporterId}</Text>
        <Text style={styles.meta}>
          Target: {item.targetName || userLookup[item.targetUserId]?.fullName || userLookup[item.targetUserId]?.email || "Unknown"}
        </Text>
        <Text style={styles.meta}>Target UID: {item.targetUserId}</Text>
        {item.requestId ? <Text style={styles.meta}>Request ID: {item.requestId}</Text> : null}
        {item.conversationId ? <Text style={styles.meta}>Conversation ID: {item.conversationId}</Text> : null}
        <Text style={styles.meta}>Source: {item.source || "app"}</Text>
        {!!item.details && <Text style={styles.details}>Details: {item.details}</Text>}
        {item.evidenceURL ? (
          <View style={styles.evidenceWrap}>
            <Image source={{ uri: item.evidenceURL }} style={styles.evidenceImage} />
            <Button mode="outlined" compact onPress={() => Linking.openURL(item.evidenceURL || "")}>
              Open Full Evidence
            </Button>
          </View>
        ) : null}
        <Text style={styles.time}>
          Filed: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "Unknown"}
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button mode="text" onPress={() => navigation.navigate("AdminUserDetail", { userId: item.reporterId })}>Reporter</Button>
        <Button mode="text" onPress={() => navigation.navigate("AdminUserDetail", { userId: item.targetUserId })}>Target</Button>
        <Button mode="text" onPress={() => setReportStatus(item.id, "reviewing")}>Reviewing</Button>
        <Button mode="text" onPress={() => setReportStatus(item.id, "resolved")}>Resolve</Button>
        <Button mode="text" onPress={() => setReportStatus(item.id, "dismissed")}>Dismiss</Button>
      </Card.Actions>
    </Card>
  );

  const renderBlock = ({ item }: { item: BlockRecord }) => (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Block Record</Text>
          <Text style={[styles.status, !item.active && styles.statusMuted]}>
            {item.active === false ? "INACTIVE" : "ACTIVE"}
          </Text>
        </View>
        <Text style={styles.meta}>Blocker: {item.blockerId}</Text>
        <Text style={styles.meta}>Blocked: {item.blockedId}</Text>
        <Text style={styles.meta}>Reason: {item.reason || "safety"}</Text>
        <Text style={styles.time}>
          Created: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "Unknown"}
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button mode="text" disabled={item.active === false} onPress={() => deactivateBlock(item.id)}>
          Deactivate
        </Button>
      </Card.Actions>
    </Card>
  );

  const reportsOpenCount = reports.filter((item) => (item.status || "open") === "open").length;
  const activeBlocksCount = blocks.filter((item) => item.active !== false).length;
  const highRiskCount = riskProfiles.filter((item) => item.level === "high").length;

  const renderRiskItem = ({ item }: { item: RiskProfile }) => (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>User: {item.userId}</Text>
          <Text style={[styles.status, item.level === "high" && styles.riskHigh, item.level === "medium" && styles.riskMedium]}>
            {item.level.toUpperCase()} ({item.score})
          </Text>
        </View>
        <Text style={styles.meta}>Open Reports: {item.openReports}</Text>
        <Text style={styles.meta}>Active Blocks (as target): {item.activeBlocksAsTarget}</Text>
        <Text style={styles.meta}>Active Blocks (as blocker): {item.activeBlocksAsBlocker}</Text>
        <Text style={styles.meta}>Suspicious Requests: {item.suspiciousRequests}</Text>
        {item.reasons.length > 0 ? (
          <Text style={styles.details}>Signals: {item.reasons.join(" | ")}</Text>
        ) : (
          <Text style={styles.details}>Signals: none</Text>
        )}
        <View style={styles.riskActionRow}>
          <Button mode="outlined" compact onPress={() => navigation.navigate("AdminUserDetail", { userId: item.userId })}>
            User Details
          </Button>
          {!!latestRequestIdsByUser[item.userId]?.[0] && (
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate("RequestDetail", { requestId: latestRequestIdsByUser[item.userId][0] })}
            >
              Latest Request
            </Button>
          )}
        </View>
        {latestRequestIdsByUser[item.userId]?.length > 1 && (
          <View style={styles.riskRequestLinks}>
            {latestRequestIdsByUser[item.userId].slice(0, 3).map((requestId) => (
              <Button
                key={requestId}
                mode="text"
                compact
                onPress={() => navigation.navigate("RequestDetail", { requestId })}
              >
                {`Open #${requestId.slice(0, 6)}`}
              </Button>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.headerCard} mode="elevated">
        <Card.Content>
          <Text style={styles.headerTitle}>Moderation Queue</Text>
          <Text style={styles.headerSubtitle}>
            Manage abuse reports and block records to reduce spam and unsafe behavior. Reports from Report Center appear here.
          </Text>
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{reportsOpenCount}</Text>
              <Text style={styles.kpiLabel}>Open Reports</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{activeBlocksCount}</Text>
              <Text style={styles.kpiLabel}>Active Blocks</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{highRiskCount}</Text>
              <Text style={styles.kpiLabel}>High Risk Users</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <SegmentedButtons
        value={mode}
        onValueChange={(value) => setMode(value as ModerationMode)}
        buttons={[
          { value: "reports", label: "Reports" },
          { value: "blocks", label: "Blocks" },
          { value: "risk", label: "Risk Scoring" },
        ]}
        style={styles.segmented}
      />

      {mode === "reports" ? (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          refreshing={loading}
          onRefresh={loadQueue}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>No records in this moderation queue.</Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      ) : mode === "blocks" ? (
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.id}
          renderItem={renderBlock}
          refreshing={loading}
          onRefresh={loadQueue}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>No records in this moderation queue.</Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <FlatList
          data={riskProfiles}
          keyExtractor={(item) => item.userId}
          renderItem={renderRiskItem}
          refreshing={loading}
          onRefresh={loadQueue}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>No risk signals found yet.</Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
        />
      )}
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
    alignSelf: "center",
    width: "100%",
  },
  headerCard: {
    borderRadius: 12,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#b91c1c",
  },
  headerSubtitle: {
    marginTop: 4,
    color: "#4b5563",
  },
  kpiRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#b91c1c",
  },
  kpiLabel: {
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 12,
  },
  segmented: {
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  card: {
    borderRadius: 12,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontWeight: "800",
    color: "#111827",
    fontSize: 16,
  },
  status: {
    color: "#1d4ed8",
    fontWeight: "800",
    fontSize: 11,
  },
  statusMuted: {
    color: "#6b7280",
  },
  riskHigh: {
    color: "#b91c1c",
  },
  riskMedium: {
    color: "#b45309",
  },
  meta: {
    color: "#374151",
    marginTop: 2,
  },
  details: {
    marginTop: 4,
    color: "#111827",
    fontWeight: "600",
  },
  evidenceWrap: {
    marginTop: 6,
    gap: 6,
  },
  evidenceImage: {
    width: "100%",
    height: 170,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  riskActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  riskRequestLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  time: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 28,
  },
});

