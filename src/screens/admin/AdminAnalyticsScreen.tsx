import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Divider, Text } from "react-native-paper";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getRequestSlaState } from "../../utils/requestSla";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { logAdminAction } from "../../utils/adminAuditLog";

type AnalyticsMetrics = {
  totalUsers: number;
  adminUsers: number;
  requesterAccounts: number;
  donorProfiles: number;
  pendingDonors: number;
  verifiedDonors: number;
  rejectedDonors: number;
  availableDonors: number;
  unavailableDonors: number;
  totalRequests: number;
  pendingRequests: number;
  acceptedRequests: number;
  completedRequests: number;
  highUrgencyRequests: number;
  slaBreachedPendingRequests: number;
  uniqueRequesters: number;
  uniqueAcceptedDonors: number;
  totalRatings: number;
  averageRating: number;
  anonymousRatings: number;
  totalFeedbackPosts: number;
  anonymousFeedbackPosts: number;
  totalFeedbackReplies: number;
  feedbackWithReplies: number;
  averageRepliesPerFeedback: number;
  totalSupportMessages: number;
  fulfillmentRatePercent: number;
  avgResponseTimeMinutes: number;
  donorRetentionPercent: number;
};

const EMPTY_METRICS: AnalyticsMetrics = {
  totalUsers: 0,
  adminUsers: 0,
  requesterAccounts: 0,
  donorProfiles: 0,
  pendingDonors: 0,
  verifiedDonors: 0,
  rejectedDonors: 0,
  availableDonors: 0,
  unavailableDonors: 0,
  totalRequests: 0,
  pendingRequests: 0,
  acceptedRequests: 0,
  completedRequests: 0,
  highUrgencyRequests: 0,
  slaBreachedPendingRequests: 0,
  uniqueRequesters: 0,
  uniqueAcceptedDonors: 0,
  totalRatings: 0,
  averageRating: 0,
  anonymousRatings: 0,
  totalFeedbackPosts: 0,
  anonymousFeedbackPosts: 0,
  totalFeedbackReplies: 0,
  feedbackWithReplies: 0,
  averageRepliesPerFeedback: 0,
  totalSupportMessages: 0,
  fulfillmentRatePercent: 0,
  avgResponseTimeMinutes: 0,
  donorRetentionPercent: 0,
};

type ChartBarItem = {
  label: string;
  value: number;
};

type ExportSnapshot = {
  users: any[];
  requests: any[];
  ratings: any[];
  feedback: any[];
  supportMessages: any[];
  donationHistory: any[];
};

type ExportHistoryItem = {
  id: string;
  action?: string;
  adminId?: string;
  summary?: string;
  createdAt?: any;
  metadata?: Record<string, any>;
};

const EMPTY_EXPORT_SNAPSHOT: ExportSnapshot = {
  users: [],
  requests: [],
  ratings: [],
  feedback: [],
  supportMessages: [],
  donationHistory: [],
};

type MetricItemProps = {
  label: string;
  value: number | string;
  tone?: "red" | "blue" | "green";
};

function MetricItem({ label, value, tone = "red" }: MetricItemProps) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, tone === "blue" && styles.metricValueBlue, tone === "green" && styles.metricValueGreen]}>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SimpleBarChart({
  title,
  items,
  color = "#d32f2f",
  emptyText,
}: {
  title: string;
  items: ChartBarItem[];
  color?: string;
  emptyText: string;
}) {
  const max = Math.max(0, ...items.map((item) => item.value));

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.chartEmpty}>{emptyText}</Text>
      ) : (
        items.map((item) => {
          const widthPercent = max > 0 ? Math.max(6, (item.value / max) * 100) : 0;
          return (
            <View key={item.label} style={styles.chartRow}>
              <Text style={styles.chartRowLabel}>{item.label}</Text>
              <View style={styles.chartBarTrack}>
                <View style={[styles.chartBarFill, { width: `${widthPercent}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.chartRowValue}>{item.value}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

export default function AdminAnalyticsScreen() {
  const { isDesktop } = useResponsive();
  const [metrics, setMetrics] = useState<AnalyticsMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [topCities, setTopCities] = useState<ChartBarItem[]>([]);
  const [exportSnapshot, setExportSnapshot] = useState<ExportSnapshot>(EMPTY_EXPORT_SNAPSHOT);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [exporting, setExporting] = useState<"weekly_csv" | "monthly_csv" | "weekly_pdf" | "monthly_pdf" | null>(null);

  const loadAnalytics = useCallback(async () => {
    setErrorText(null);
    setLoading(true);
    try {
      const [usersSnap, requestsSnap, ratingsSnap, feedbackSnap, supportSnap, donationHistorySnap, exportHistorySnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "requests")),
        getDocs(collection(db, "app_ratings")),
        getDocs(collection(db, "app_feedback")),
        getDocs(collection(db, "supportMessages")),
        getDocs(collection(db, "donation_history")),
        getDocs(query(collection(db, "admin_audit_logs"), orderBy("createdAt", "desc"), limit(40))),
      ]);

      const users = usersSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) }));
      const requests = requestsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) }));
      const ratings = ratingsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) }));
      const feedbackDocs = feedbackSnap.docs;
      const feedback = feedbackDocs.map((item) => ({ id: item.id, ...(item.data() as any) }));
      const donationHistory = donationHistorySnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) }));
      setExportSnapshot({
        users,
        requests,
        ratings,
        feedback,
        supportMessages: supportSnap.docs.map((item) => item.data() as any),
        donationHistory,
      });
      setExportHistory(
        exportHistorySnap.docs
          .map((item) => ({ id: item.id, ...(item.data() as any) }) as ExportHistoryItem)
          .filter((item) => String(item.action || "").startsWith("analytics_export_"))
          .slice(0, 10)
      );

      const replySnaps = await Promise.all(
        feedbackDocs.map((item) => getDocs(collection(db, "app_feedback", item.id, "replies")))
      );
      const totalFeedbackReplies = replySnaps.reduce((sum, snap) => sum + snap.size, 0);
      const feedbackWithReplies = replySnaps.filter((snap) => snap.size > 0).length;

      const pendingRequests = requests.filter((item) => item?.status === "pending").length;
      const acceptedRequests = requests.filter((item) => item?.status === "accepted").length;
      const completedRequests = requests.filter((item) => item?.status === "completed").length;
      const highUrgencyRequests = requests.filter((item) => {
        const urgency = String(item?.urgency || "").toLowerCase();
        return urgency === "critical" || urgency === "urgent";
      }).length;
      const slaBreachedPendingRequests = requests.filter((item) => {
        if (String(item?.status || "").toLowerCase() !== "pending") return false;
        return getRequestSlaState(item).isBreached;
      }).length;
      const uniqueRequesters = new Set(requests.map((item) => item?.requesterId).filter(Boolean)).size;
      const uniqueAcceptedDonors = new Set(requests.map((item) => item?.acceptedBy).filter(Boolean)).size;
      const completedDonorIds = donationHistory.map((item) => item?.donorId).filter(Boolean);
      const uniqueCompletedDonors = new Set(completedDonorIds);
      const repeatDonorIds = new Set<string>();
      const donorDonationCount = new Map<string, number>();
      completedDonorIds.forEach((id) => {
        const current = donorDonationCount.get(id) || 0;
        const next = current + 1;
        donorDonationCount.set(id, next);
        if (next >= 2) repeatDonorIds.add(id);
      });

      const donorRetentionPercent =
        uniqueCompletedDonors.size > 0 ? (repeatDonorIds.size / uniqueCompletedDonors.size) * 100 : 0;

      const responseTimesMinutes = requests
        .map((item) => {
          const created = item?.createdAt?.toDate?.();
          const accepted = item?.acceptedAt?.toDate?.();
          if (!(created instanceof Date) || Number.isNaN(created.getTime())) return null;
          if (!(accepted instanceof Date) || Number.isNaN(accepted.getTime())) return null;
          const diffMinutes = (accepted.getTime() - created.getTime()) / 60000;
          return diffMinutes >= 0 ? diffMinutes : null;
        })
        .filter((item) => typeof item === "number") as number[];
      const avgResponseTimeMinutes =
        responseTimesMinutes.length > 0
          ? responseTimesMinutes.reduce((sum, item) => sum + item, 0) / responseTimesMinutes.length
          : 0;

      const fulfillmentRatePercent = requests.length > 0 ? (completedRequests / requests.length) * 100 : 0;

      const cityCounts = new Map<string, number>();
      requests.forEach((item) => {
        const city = String(item?.city || "").trim();
        if (city) cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      });

      const topCitiesNext = Array.from(cityCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value]) => ({ label, value }));
      setTopCities(topCitiesNext);

      const donorProfiles = users.filter((item) => Boolean(item?.bloodType)).length;
      const pendingDonors = users.filter((item) => item?.donorStatus === "pending").length;
      const verifiedDonors = users.filter((item) => item?.donorStatus === "verified").length;
      const rejectedDonors = users.filter((item) => item?.donorStatus === "rejected").length;
      const availableDonors = users.filter(
        (item) => item?.donorStatus === "verified" && item?.availabilityStatus === "available"
      ).length;
      const unavailableDonors = users.filter(
        (item) => item?.donorStatus === "verified" && item?.availabilityStatus !== "available"
      ).length;

      const totalRatings = ratings.length;
      const averageRating = totalRatings > 0 ? ratings.reduce((sum, item) => sum + (Number(item?.rating) || 0), 0) / totalRatings : 0;
      const anonymousRatings = ratings.filter((item) => Boolean(item?.isAnonymous)).length;

      const totalFeedbackPosts = feedback.length;
      const anonymousFeedbackPosts = feedback.filter((item) => Boolean(item?.isAnonymous)).length;
      const averageRepliesPerFeedback = totalFeedbackPosts > 0 ? totalFeedbackReplies / totalFeedbackPosts : 0;

      setMetrics({
        totalUsers: users.length,
        adminUsers: users.filter((item) => item?.role === "admin").length,
        requesterAccounts: users.filter((item) => item?.role === "requester").length,
        donorProfiles,
        pendingDonors,
        verifiedDonors,
        rejectedDonors,
        availableDonors,
        unavailableDonors,
        totalRequests: requests.length,
        pendingRequests,
        acceptedRequests,
        completedRequests,
        highUrgencyRequests,
        slaBreachedPendingRequests,
        uniqueRequesters,
        uniqueAcceptedDonors,
        totalRatings,
        averageRating,
        anonymousRatings,
        totalFeedbackPosts,
        anonymousFeedbackPosts,
        totalFeedbackReplies,
        feedbackWithReplies,
        averageRepliesPerFeedback,
        totalSupportMessages: supportSnap.size,
        fulfillmentRatePercent,
        avgResponseTimeMinutes,
        donorRetentionPercent,
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load analytics:", error);
      setErrorText("Could not load analytics right now. Please try refreshing.");
      setMetrics(EMPTY_METRICS);
      setExportSnapshot(EMPTY_EXPORT_SNAPSHOT);
      setExportHistory([]);
      setTopCities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value?.toDate === "function") {
      const converted = value.toDate();
      return Number.isNaN(converted.getTime()) ? null : converted;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const escapeCsv = (value: unknown) => {
    const stringified = String(value ?? "");
    if (stringified.includes(",") || stringified.includes('"') || stringified.includes("\n")) {
      return `"${stringified.replace(/"/g, '""')}"`;
    }
    return stringified;
  };

  const buildExportRecords = (days: number) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const requests = exportSnapshot.requests.filter((item) => {
      const createdAt = toDate(item?.createdAt);
      return createdAt ? createdAt.getTime() >= start.getTime() : false;
    });

    const completed = requests.filter((item) => String(item?.status || "").toLowerCase() === "completed");
    const accepted = requests.filter((item) => String(item?.status || "").toLowerCase() === "accepted");
    const pending = requests.filter((item) => String(item?.status || "").toLowerCase() === "pending");
    const critical = requests.filter((item) => String(item?.urgency || "").toLowerCase() === "critical");
    const uniqueRequesters = new Set(requests.map((item) => item?.requesterId).filter(Boolean)).size;
    const uniqueDonors = new Set(requests.map((item) => item?.acceptedBy).filter(Boolean)).size;
    const fulfillmentRate = requests.length > 0 ? (completed.length / requests.length) * 100 : 0;

    return {
      start,
      requests,
      summary: {
        totalRequests: requests.length,
        pendingRequests: pending.length,
        acceptedRequests: accepted.length,
        completedRequests: completed.length,
        criticalRequests: critical.length,
        uniqueRequesters,
        uniqueDonors,
        fulfillmentRate,
      },
    };
  };

  const upsertExportHistory = (entry: ExportHistoryItem) => {
    setExportHistory((prev) => [entry, ...prev].slice(0, 10));
  };

  const recordExport = async (format: "csv" | "pdf", days: number, requestCount: number) => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) return;

    const periodLabel = days === 7 ? "weekly" : days === 30 ? "monthly" : `${days}-day`;
    const summary = `Exported ${periodLabel.toUpperCase()} ${format.toUpperCase()} analytics report`;

    await logAdminAction({
      adminId,
      action: `analytics_export_${format}`,
      targetType: "system",
      targetId: null,
      summary,
      metadata: {
        format,
        days,
        requestCount,
      },
    });

    upsertExportHistory({
      id: `local-${Date.now()}`,
      action: `analytics_export_${format}`,
      adminId,
      summary,
      createdAt: new Date(),
      metadata: {
        format,
        days,
        requestCount,
      },
    });
  };

  const getHistoryLabel = (item: ExportHistoryItem) => {
    const format = String(item?.metadata?.format || "").toUpperCase() || "REPORT";
    const days = Number(item?.metadata?.days);
    const period = days === 7 ? "Weekly" : days === 30 ? "Monthly" : Number.isFinite(days) ? `${days}-Day` : "Custom";
    return `${period} ${format} export`;
  };

  const getHistoryMeta = (item: ExportHistoryItem) => {
    const by = item.adminId ? `By ${item.adminId}` : "By unknown";
    const createdAt = toDate(item.createdAt)?.toLocaleString() || "Unknown time";
    return `${by} | ${createdAt}`;
  };

  const exportCsv = async (days: number) => {
    const key = days === 7 ? "weekly_csv" : "monthly_csv";
    setExporting(key);
    try {
      const { start, requests, summary } = buildExportRecords(days);
      const lines = [
        "BloodLink Analytics Export",
        `Period,${escapeCsv(`${start.toLocaleDateString()} to ${new Date().toLocaleDateString()}`)}`,
        `Generated At,${escapeCsv(new Date().toLocaleString())}`,
        "",
        "Summary,Value",
        `Total Requests,${summary.totalRequests}`,
        `Pending Requests,${summary.pendingRequests}`,
        `Accepted Requests,${summary.acceptedRequests}`,
        `Completed Requests,${summary.completedRequests}`,
        `Critical Requests,${summary.criticalRequests}`,
        `Unique Requesters,${summary.uniqueRequesters}`,
        `Unique Accepted Donors,${summary.uniqueDonors}`,
        `Fulfillment Rate (%),${summary.fulfillmentRate.toFixed(1)}`,
        "",
        "Request ID,Created At,Patient Name,Hospital,City,Blood Type,Urgency,Status,Accepted By",
      ];

      requests.forEach((item: any) => {
        lines.push(
          [
            escapeCsv(item?.id || ""),
            escapeCsv(toDate(item?.createdAt)?.toLocaleString() || ""),
            escapeCsv(item?.patientName || ""),
            escapeCsv(item?.hospital || ""),
            escapeCsv(item?.city || ""),
            escapeCsv(item?.bloodTypeNeeded || ""),
            escapeCsv(item?.urgency || ""),
            escapeCsv(item?.status || ""),
            escapeCsv(item?.acceptedBy || ""),
          ].join(",")
        );
      });

      const file = new File(Paths.cache, `analytics_${days === 7 ? "weekly" : "monthly"}_${Date.now()}.csv`);
      file.create({ overwrite: true });
      file.write(lines.join("\n"));

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error("File sharing is unavailable on this device.");
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        dialogTitle: days === 7 ? "Export Weekly CSV" : "Export Monthly CSV",
      });
      await recordExport("csv", days, requests.length);
    } catch (error: any) {
      Alert.alert("Export Failed", error?.message || "Could not export CSV report.");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async (days: number) => {
    const key = days === 7 ? "weekly_pdf" : "monthly_pdf";
    setExporting(key);
    try {
      const { start, requests, summary } = buildExportRecords(days);
      const topRows = requests.slice(0, 60);
      const rows = topRows
        .map((item: any) => {
          const createdAt = toDate(item?.createdAt)?.toLocaleString() || "";
          return `<tr>
            <td>${String(item?.id || "")}</td>
            <td>${String(createdAt)}</td>
            <td>${String(item?.patientName || "")}</td>
            <td>${String(item?.city || "")}</td>
            <td>${String(item?.bloodTypeNeeded || "")}</td>
            <td>${String(item?.urgency || "")}</td>
            <td>${String(item?.status || "")}</td>
          </tr>`;
        })
        .join("");

      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
              h1 { color: #b91c1c; margin: 0 0 8px 0; }
              .meta { margin-bottom: 10px; color: #4b5563; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 11px; text-align: left; }
              th { background: #f3f4f6; font-weight: 700; }
              .summary td:first-child { font-weight: 700; width: 45%; }
            </style>
          </head>
          <body>
            <h1>BloodLink Analytics (${days === 7 ? "Weekly" : "Monthly"})</h1>
            <div class="meta">Period: ${start.toLocaleDateString()} to ${new Date().toLocaleDateString()}</div>
            <div class="meta">Generated: ${new Date().toLocaleString()}</div>

            <table class="summary">
              <tr><td>Total Requests</td><td>${summary.totalRequests}</td></tr>
              <tr><td>Pending Requests</td><td>${summary.pendingRequests}</td></tr>
              <tr><td>Accepted Requests</td><td>${summary.acceptedRequests}</td></tr>
              <tr><td>Completed Requests</td><td>${summary.completedRequests}</td></tr>
              <tr><td>Critical Requests</td><td>${summary.criticalRequests}</td></tr>
              <tr><td>Unique Requesters</td><td>${summary.uniqueRequesters}</td></tr>
              <tr><td>Unique Accepted Donors</td><td>${summary.uniqueDonors}</td></tr>
              <tr><td>Fulfillment Rate</td><td>${summary.fulfillmentRate.toFixed(1)}%</td></tr>
            </table>

            <h3>Recent Requests (${topRows.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Created At</th>
                  <th>Patient</th>
                  <th>City</th>
                  <th>Blood</th>
                  <th>Urgency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;

      const file = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) throw new Error("File sharing is unavailable on this device.");
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: days === 7 ? "Export Weekly PDF" : "Export Monthly PDF",
      });
      await recordExport("pdf", days, requests.length);
    } catch (error: any) {
      Alert.alert("Export Failed", error?.message || "Could not export PDF report.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Live records of users, donors, requests, ratings, and feedback activity.</Text>
          {lastUpdated && <Text style={styles.lastUpdated}>Updated: {lastUpdated.toLocaleString()}</Text>}
        </View>
        <Button mode="outlined" icon="refresh" onPress={loadAnalytics} compact>
          Refresh
        </Button>
      </View>

      <Card style={styles.exportCard} mode="elevated">
        <Card.Title title="Analytics Export" subtitle="Download weekly/monthly reports as CSV or PDF." />
        <Card.Content>
          <View style={styles.exportButtonRow}>
            <Button mode="contained" onPress={() => exportCsv(7)} loading={exporting === "weekly_csv"} disabled={!!exporting}>
              Weekly CSV
            </Button>
            <Button mode="contained-tonal" onPress={() => exportPdf(7)} loading={exporting === "weekly_pdf"} disabled={!!exporting}>
              Weekly PDF
            </Button>
          </View>
          <View style={styles.exportButtonRow}>
            <Button mode="contained" onPress={() => exportCsv(30)} loading={exporting === "monthly_csv"} disabled={!!exporting}>
              Monthly CSV
            </Button>
            <Button mode="contained-tonal" onPress={() => exportPdf(30)} loading={exporting === "monthly_pdf"} disabled={!!exporting}>
              Monthly PDF
            </Button>
          </View>
          <Divider style={styles.sectionDivider} />
          <Text style={styles.exportHistoryTitle}>Export History</Text>
          {exportHistory.length === 0 ? (
            <Text style={styles.exportHistoryEmpty}>No exports logged yet.</Text>
          ) : (
            exportHistory.map((item) => (
              <View key={item.id} style={styles.exportHistoryItem}>
                <Text style={styles.exportHistoryLabel}>{getHistoryLabel(item)}</Text>
                <Text style={styles.exportHistoryMeta}>{getHistoryMeta(item)}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading analytics data...</Text>
        </View>
      ) : null}

      {errorText ? (
        <Card style={styles.errorCard} mode="elevated">
          <Card.Content>
            <Text style={styles.errorText}>{errorText}</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.sectionCard} mode="elevated">
        <Card.Title title="User Records" />
        <Card.Content>
          <View style={styles.metricGrid}>
            <MetricItem label="Total Users" value={metrics.totalUsers} />
            <MetricItem label="Admin Accounts" value={metrics.adminUsers} tone="blue" />
            <MetricItem label="Requester Accounts" value={metrics.requesterAccounts} tone="blue" />
            <MetricItem label="Donor Profiles" value={metrics.donorProfiles} tone="green" />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard} mode="elevated">
        <Card.Title title="Donor Verification & Availability" />
        <Card.Content>
          <View style={styles.metricGrid}>
            <MetricItem label="Pending Verification" value={metrics.pendingDonors} />
            <MetricItem label="Verified Donors" value={metrics.verifiedDonors} tone="green" />
            <MetricItem label="Rejected Donors" value={metrics.rejectedDonors} />
            <MetricItem label="Available Now" value={metrics.availableDonors} tone="green" />
            <MetricItem label="Unavailable" value={metrics.unavailableDonors} tone="blue" />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard} mode="elevated">
        <Card.Title title="Request Records" />
        <Card.Content>
          <View style={styles.metricGrid}>
            <MetricItem label="Total Requests" value={metrics.totalRequests} />
            <MetricItem label="Pending" value={metrics.pendingRequests} />
            <MetricItem label="Accepted" value={metrics.acceptedRequests} tone="green" />
            <MetricItem label="Completed" value={metrics.completedRequests} tone="green" />
            <MetricItem label="High Urgency" value={metrics.highUrgencyRequests} />
            <MetricItem label="Over Target Time (Pending)" value={metrics.slaBreachedPendingRequests} />
            <MetricItem label="Unique Requesters" value={metrics.uniqueRequesters} tone="blue" />
            <MetricItem label="Unique Accepted Donors" value={metrics.uniqueAcceptedDonors} tone="blue" />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard} mode="elevated">
        <Card.Title title="Operational Performance Charts" />
        <Card.Content>
          <View style={styles.metricGrid}>
            <MetricItem label="Avg Response Time" value={`${metrics.avgResponseTimeMinutes.toFixed(1)} min`} tone="blue" />
            <MetricItem label="Fulfillment Rate" value={`${metrics.fulfillmentRatePercent.toFixed(1)}%`} tone="green" />
            <MetricItem label="Donor Retention" value={`${metrics.donorRetentionPercent.toFixed(1)}%`} tone="green" />
          </View>
          <Divider style={styles.sectionDivider} />
          <SimpleBarChart
            title="Top Active Cities (by requests)"
            items={topCities}
            color="#dc2626"
            emptyText="No city request records yet."
          />
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard} mode="elevated">
        <Card.Title title="Ratings, Feedback & Support" />
        <Card.Content>
          <View style={styles.metricGrid}>
            <MetricItem label="Ratings Submitted" value={metrics.totalRatings} />
            <MetricItem label="Average Rating" value={`${metrics.averageRating.toFixed(1)}/5`} tone="green" />
            <MetricItem label="Anonymous Ratings" value={metrics.anonymousRatings} tone="blue" />
            <MetricItem label="Feedback Posts" value={metrics.totalFeedbackPosts} />
            <MetricItem label="Anonymous Feedback" value={metrics.anonymousFeedbackPosts} tone="blue" />
            <MetricItem label="Feedback Replies" value={metrics.totalFeedbackReplies} tone="green" />
            <MetricItem label="Posts With Replies" value={metrics.feedbackWithReplies} tone="green" />
            <MetricItem label="Avg Replies/Post" value={metrics.averageRepliesPerFeedback.toFixed(1)} tone="blue" />
            <MetricItem label="Support Messages" value={metrics.totalSupportMessages} />
          </View>
          <Divider style={styles.sectionDivider} />
          <Text style={styles.sectionHint}>
            This dashboard helps monitor engagement and operations. Use it to detect slow response areas and improve donor-response workflows.
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "#f3f4f6",
    gap: 10,
  },
  containerDesktop: {
    maxWidth: 980,
    width: "100%",
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#b91c1c",
  },
  subtitle: {
    marginTop: 4,
    color: "#4b5563",
    lineHeight: 20,
  },
  lastUpdated: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  exportCard: {
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  exportButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  exportHistoryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  exportHistoryEmpty: {
    color: "#6b7280",
    fontStyle: "italic",
  },
  exportHistoryItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  exportHistoryLabel: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 13,
  },
  exportHistoryMeta: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: 12,
  },
  loadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  loadingText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  errorCard: {
    borderRadius: 12,
    backgroundColor: "#fff1f2",
  },
  errorText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricItem: {
    width: "48%",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#b91c1c",
  },
  metricValueBlue: {
    color: "#1d4ed8",
  },
  metricValueGreen: {
    color: "#15803d",
  },
  metricLabel: {
    marginTop: 2,
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionDivider: {
    marginVertical: 12,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#f8fafc",
  },
  chartTitle: {
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 8,
  },
  chartEmpty: {
    color: "#6b7280",
    fontStyle: "italic",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  chartRowLabel: {
    width: 95,
    color: "#374151",
    fontSize: 12,
    fontWeight: "600",
  },
  chartBarTrack: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  chartBarFill: {
    height: "100%",
    borderRadius: 999,
  },
  chartRowValue: {
    width: 24,
    textAlign: "right",
    fontWeight: "800",
    color: "#111827",
    fontSize: 12,
  },
  sectionHint: {
    color: "#4b5563",
    lineHeight: 19,
  },
});


