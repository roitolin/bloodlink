import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

type BroadcastRecord = {
  id: string;
  message?: string;
  urgency?: "Critical" | "Urgent" | "Normal";
  status?: "active" | "resolved";
  targetCity?: string | null;
  targetBloodType?: string | null;
  createdByName?: string | null;
  createdAt?: any;
  expiresAt?: any;
};

type Props = {
  viewerCity?: string;
  viewerBloodType?: string;
  limit?: number;
  title?: string;
};

const normalize = (value: string | null | undefined) => String(value || "").trim().toLowerCase();

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getUrgencyColor = (urgency: string | undefined) => {
  switch (urgency) {
    case "Critical":
      return "#b91c1c";
    case "Urgent":
      return "#c2410c";
    default:
      return "#1d4ed8";
  }
};

export default function EmergencyBroadcastBanner({
  viewerCity = "",
  viewerBloodType = "",
  limit = 2,
  title = "Emergency Broadcasts",
}: Props) {
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);

  useEffect(() => {
    const q = query(collection(db, "emergency_broadcasts"), where("status", "==", "active"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const list = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }) as BroadcastRecord)
        .filter((item) => {
          const expiresAt = toDate(item.expiresAt);
          if (expiresAt && expiresAt.getTime() <= now.getTime()) return false;
          const cityTarget = normalize(item.targetCity || "");
          const bloodTarget = normalize(item.targetBloodType || "");
          if (cityTarget && cityTarget !== normalize(viewerCity)) return false;
          if (bloodTarget && bloodTarget !== normalize(viewerBloodType)) return false;
          return true;
        })
        .sort((a, b) => {
          const aDate = toDate(a.createdAt)?.getTime() || 0;
          const bDate = toDate(b.createdAt)?.getTime() || 0;
          return bDate - aDate;
        });

      setBroadcasts(list);
    });

    return unsubscribe;
  }, [viewerBloodType, viewerCity]);

  const activeItems = useMemo(() => broadcasts.slice(0, limit), [broadcasts, limit]);

  if (activeItems.length === 0) return null;

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Content>
        <Text style={styles.title}>{title}</Text>
        {activeItems.map((item) => {
          const urgencyColor = getUrgencyColor(item.urgency);
          const expiresAt = toDate(item.expiresAt);
          return (
            <View key={item.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: urgencyColor }]} />
              <View style={styles.rowContent}>
                <Text style={[styles.urgency, { color: urgencyColor }]}>
                  {item.urgency || "Emergency"} Alert
                </Text>
                <Text style={styles.message}>{item.message || "Emergency alert posted."}</Text>
                <Text style={styles.meta}>
                  {item.targetCity ? `City: ${item.targetCity}` : "Nationwide"}
                  {item.targetBloodType ? ` | Blood: ${item.targetBloodType}` : ""}
                  {expiresAt ? ` | Until ${expiresAt.toLocaleString()}` : ""}
                </Text>
              </View>
            </View>
          );
        })}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  title: {
    color: "#9a3412",
    fontWeight: "800",
    marginBottom: 10,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  rowContent: {
    flex: 1,
  },
  urgency: {
    fontWeight: "800",
    marginBottom: 2,
  },
  message: {
    color: "#1f2937",
    lineHeight: 20,
  },
  meta: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },
});
