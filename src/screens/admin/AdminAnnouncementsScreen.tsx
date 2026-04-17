import { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { Button, Card, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { createAnnouncement } from "../../utils/announcements";

type Announcement = {
  id: string;
  title: string;
  body: string;
  status?: "active" | "archived";
  isPinned?: boolean;
  createdAt?: any;
};

export default function AdminAnnouncementsScreen() {
  const { isDesktop } = useResponsive();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [creating, setCreating] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [filter, setFilter] = useState<"active" | "archived">("active");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "announcements"), (snapshot) => {
      const list = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }) as Announcement)
        .filter((item) => (item.status || "active") === filter)
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        });
      setAnnouncements(list);
    });
    return unsubscribe;
  }, [filter]);

  const publishAnnouncement = async () => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) {
      Alert.alert("Error", "You must be logged in as admin.");
      return;
    }

    setCreating(true);
    try {
      await createAnnouncement({
        createdBy: adminId,
        title,
        body,
        isPinned,
      });
      setTitle("");
      setBody("");
      setIsPinned(false);
      Alert.alert("Published", "Announcement was sent to users and notification has been created.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to publish announcement.");
    } finally {
      setCreating(false);
    }
  };

  const updateAnnouncementStatus = async (announcementId: string, status: "active" | "archived") => {
    try {
      await updateDoc(doc(db, "announcements", announcementId), {
        status,
        updatedAt: new Date(),
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update announcement.");
    }
  };

  const renderItem = ({ item }: { item: Announcement }) => (
    <Card style={styles.announcementCard} mode="elevated">
      <Card.Content>
        <View style={styles.rowBetween}>
          <Text style={styles.announcementTitle}>{item.title}</Text>
          {item.isPinned ? <Text style={styles.pinnedBadge}>PINNED</Text> : null}
        </View>
        <Text style={styles.announcementBody}>{item.body}</Text>
        <Text style={styles.announcementMeta}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : "Unknown date"}
        </Text>
      </Card.Content>
      <Card.Actions>
        {item.status === "active" ? (
          <Button mode="text" onPress={() => updateAnnouncementStatus(item.id, "archived")}>
            Archive
          </Button>
        ) : (
          <Button mode="text" onPress={() => updateAnnouncementStatus(item.id, "active")}>
            Reactivate
          </Button>
        )}
      </Card.Actions>
    </Card>
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.headerCard} mode="elevated">
        <Card.Title title="Announcements" subtitle="Post updates for all users with notifications." />
        <Card.Content>
          <TextInput
            mode="outlined"
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Example: New blood drive schedule"
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Announcement message"
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Write details for all users..."
            style={styles.input}
          />
          <View style={styles.pinRow}>
            <Text style={styles.pinLabel}>Pin this announcement on top</Text>
            <Switch value={isPinned} onValueChange={setIsPinned} />
          </View>
          <Button mode="contained" onPress={publishAnnouncement} loading={creating} disabled={creating}>
            {creating ? "Publishing..." : "Publish Announcement"}
          </Button>
        </Card.Content>
      </Card>

      <SegmentedButtons
        value={filter}
        onValueChange={(value) => setFilter(value as "active" | "archived")}
        buttons={[
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
        ]}
        style={styles.segmented}
      />

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No announcements found.</Text>}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
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
  input: {
    marginBottom: 10,
  },
  pinRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pinLabel: {
    color: "#374151",
    fontWeight: "600",
  },
  segmented: {
    marginBottom: 10,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  announcementCard: {
    borderRadius: 12,
    marginBottom: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  announcementTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },
  pinnedBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400e",
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  announcementBody: {
    color: "#374151",
    lineHeight: 20,
  },
  announcementMeta: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 12,
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    color: "#6b7280",
  },
});

