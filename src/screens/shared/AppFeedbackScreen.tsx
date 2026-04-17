import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  Divider,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from "react-native-paper";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { useAuth } from "../../context/AuthContext";
import { createAdminNotification } from "../../utils/createAdminNotification";

const RATING_VALUES = [1, 2, 3, 4, 5];
const LIKE = "Like";

type RatingDoc = {
  id: string;
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  rating: number;
  createdAt?: any;
  updatedAt?: any;
};

type FeedbackReply = {
  id: string;
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  text: string;
  createdAt?: any;
  updatedAt?: any;
  reactions?: Record<string, string>;
};

type FeedbackPost = {
  id: string;
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  isAnonymous?: boolean;
  feedback: string;
  createdAt?: any;
  updatedAt?: any;
  reactions?: Record<string, string>;
  replies: FeedbackReply[];
};

type EditState = {
  type: "feedback" | "reply";
  feedbackId: string;
  replyId?: string;
  initialText: string;
} | null;

const formatDateTime = (timestamp: any) => {
  if (!timestamp) return "Just now";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString();
};

export default function AppFeedbackScreen() {
  const { isDesktop } = useResponsive();
  const { role } = useAuth();
  const currentUser = auth.currentUser;
  const isSuperAdmin = String(role ?? "").toLowerCase() === "superadmin";
  const canModerate = role === "admin" || isSuperAdmin;

  const [rating, setRating] = useState(0);
  const [ratingAnonymous, setRatingAnonymous] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [showRatingsList, setShowRatingsList] = useState(true);

  const [feedbackText, setFeedbackText] = useState("");
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [postingFeedback, setPostingFeedback] = useState(false);

  const [ratings, setRatings] = useState<RatingDoc[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyInputByPost, setReplyInputByPost] = useState<Record<string, string>>({});
  const [replyAnonymousByPost, setReplyAnonymousByPost] = useState<Record<string, boolean>>({});
  const [replySubmittingPostId, setReplySubmittingPostId] = useState<string | null>(null);

  const [editState, setEditState] = useState<EditState>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [snackbarText, setSnackbarText] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const canManage = useCallback(
    (ownerUserId: string) => !!currentUser?.uid && (ownerUserId === currentUser.uid || canModerate),
    [currentUser?.uid, canModerate]
  );

  const getIdentity = useCallback(async () => {
    if (!currentUser) return null;
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const data = userDoc.data();
    return {
      userId: currentUser.uid,
      userEmail: currentUser.email || null,
      displayName: data?.fullName || currentUser.email || "User",
    };
  }, [currentUser]);

  const loadBoard = useCallback(async () => {
    if (!currentUser) {
      setRatings([]);
      setFeedbacks([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const ratingsQuery = query(collection(db, "app_ratings"), orderBy("updatedAt", "desc"));
      const ratingsSnap = await getDocs(ratingsQuery);
      const ratingsList = ratingsSnap.docs.map((ratingDoc) => ({
        id: ratingDoc.id,
        ...ratingDoc.data(),
      })) as RatingDoc[];
      setRatings(ratingsList);

      const mine = ratingsList.find((item) => item.userId === currentUser.uid);
      if (mine) {
        setRating(mine.rating || 0);
        setRatingAnonymous(Boolean(mine.isAnonymous));
      } else {
        setRating(0);
        setRatingAnonymous(false);
      }

      const feedbackQuery = query(collection(db, "app_feedback"), orderBy("createdAt", "desc"));
      const feedbackSnap = await getDocs(feedbackQuery);
      const feedbackList = await Promise.all(
        feedbackSnap.docs.map(async (feedbackDoc) => {
          const feedbackData = feedbackDoc.data();
          const repliesQuery = query(collection(db, "app_feedback", feedbackDoc.id, "replies"), orderBy("createdAt", "asc"));
          const repliesSnap = await getDocs(repliesQuery);
          const replies = repliesSnap.docs.map((replyDoc) => ({
            id: replyDoc.id,
            ...replyDoc.data(),
          })) as FeedbackReply[];

          return {
            id: feedbackDoc.id,
            ...feedbackData,
            replies,
          } as FeedbackPost;
        })
      );
      setFeedbacks(feedbackList);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load ratings and feedback.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const showSnackbar = (message: string) => {
    setSnackbarText(message);
    setSnackbarVisible(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBoard();
  };

  const saveMyRating = async () => {
    if (isSuperAdmin) {
      Alert.alert("Not Allowed", "Superadmin accounts cannot submit ratings.");
      return;
    }

    const identity = await getIdentity();
    if (!identity) {
      Alert.alert("Error", "You need to be logged in.");
      return;
    }

    setSavingRating(true);
    try {
      if (rating < 1) {
        await deleteDoc(doc(db, "app_ratings", identity.userId));
        await createAdminNotification(
          "rating_update",
          "App Rating Updated",
          `${identity.displayName || "A user"} removed their app rating.`,
          { userId: identity.userId }
        );
        showSnackbar("Rating removed.");
        loadBoard();
        return;
      }

      await setDoc(
        doc(db, "app_ratings", identity.userId),
        {
          userId: identity.userId,
          userEmail: identity.userEmail,
          displayName: identity.displayName,
          isAnonymous: ratingAnonymous,
          rating,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await createAdminNotification(
        "rating_update",
        "New/Updated App Rating",
        `${identity.displayName || "A user"} rated the app ${rating}/5.`,
        { rating, userId: identity.userId }
      );

      showSnackbar("Rating saved.");
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save rating.");
    } finally {
      setSavingRating(false);
    }
  };

  const removeMyRating = async () => {
    const identity = await getIdentity();
    if (!identity) return;

    try {
      await deleteDoc(doc(db, "app_ratings", identity.userId));
      await createAdminNotification(
        "rating_update",
        "App Rating Updated",
        `${identity.displayName || "A user"} removed their app rating.`,
        { userId: identity.userId }
      );
      setRating(0);
      setRatingAnonymous(false);
      showSnackbar("Rating removed.");
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to remove rating.");
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert("Feedback Required", "Please write your feedback before submitting.");
      return;
    }

    const identity = await getIdentity();
    if (!identity) {
      Alert.alert("Error", "You need to be logged in.");
      return;
    }

    setPostingFeedback(true);
    try {
      await addDoc(collection(db, "app_feedback"), {
        userId: identity.userId,
        userEmail: identity.userEmail,
        displayName: identity.displayName,
        isAnonymous: postAnonymous,
        feedback: feedbackText.trim(),
        reactions: {},
        createdAt: serverTimestamp(),
        updatedAt: null,
      });

      await createAdminNotification(
        "feedback_new",
        "New App Feedback",
        `${identity.displayName || "A user"} posted new feedback.`,
        { userId: identity.userId }
      );

      setFeedbackText("");
      setPostAnonymous(false);
      showSnackbar("Feedback posted.");
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Could not submit feedback.");
    } finally {
      setPostingFeedback(false);
    }
  };

  const toggleFeedbackReaction = async (feedbackItem: FeedbackPost) => {
    if (!currentUser?.uid) return;
    try {
      const currentReactions = feedbackItem.reactions || {};
      const nextReactions = { ...currentReactions };
      if (nextReactions[currentUser.uid]) {
        delete nextReactions[currentUser.uid];
      } else {
        nextReactions[currentUser.uid] = "like";
      }

      await updateDoc(doc(db, "app_feedback", feedbackItem.id), {
        reactions: nextReactions,
      });
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to react.");
    }
  };

  const toggleReplyReaction = async (feedbackId: string, reply: FeedbackReply) => {
    if (!currentUser?.uid) return;
    try {
      const currentReactions = reply.reactions || {};
      const nextReactions = { ...currentReactions };
      if (nextReactions[currentUser.uid]) {
        delete nextReactions[currentUser.uid];
      } else {
        nextReactions[currentUser.uid] = "like";
      }

      await updateDoc(doc(db, "app_feedback", feedbackId, "replies", reply.id), {
        reactions: nextReactions,
      });
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to react.");
    }
  };

  const submitReply = async (feedbackId: string) => {
    const replyText = (replyInputByPost[feedbackId] || "").trim();
    if (!replyText) return;

    const identity = await getIdentity();
    if (!identity) return;

    setReplySubmittingPostId(feedbackId);
    try {
      await addDoc(collection(db, "app_feedback", feedbackId, "replies"), {
        userId: identity.userId,
        userEmail: identity.userEmail,
        displayName: identity.displayName,
        isAnonymous: Boolean(replyAnonymousByPost[feedbackId]),
        text: replyText,
        reactions: {},
        createdAt: serverTimestamp(),
        updatedAt: null,
      });

      setReplyInputByPost((prev) => ({ ...prev, [feedbackId]: "" }));
      setReplyAnonymousByPost((prev) => ({ ...prev, [feedbackId]: false }));
      setExpandedReplies((prev) => ({ ...prev, [feedbackId]: true }));
      showSnackbar("Reply posted.");
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to post reply.");
    } finally {
      setReplySubmittingPostId(null);
    }
  };

  const promptDeleteFeedback = (feedbackId: string) => {
    Alert.alert("Delete Feedback", "Delete this feedback and all replies?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const repliesSnap = await getDocs(collection(db, "app_feedback", feedbackId, "replies"));
            await Promise.all(repliesSnap.docs.map((item) => deleteDoc(item.ref)));
            await deleteDoc(doc(db, "app_feedback", feedbackId));
            showSnackbar("Feedback deleted.");
            loadBoard();
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to delete feedback.");
          }
        },
      },
    ]);
  };

  const promptDeleteReply = (feedbackId: string, replyId: string) => {
    Alert.alert("Delete Reply", "Are you sure you want to delete this reply?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "app_feedback", feedbackId, "replies", replyId));
            showSnackbar("Reply deleted.");
            loadBoard();
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to delete reply.");
          }
        },
      },
    ]);
  };

  const openEditDialog = (state: EditState) => {
    setEditState(state);
    setEditText(state?.initialText || "");
  };

  const saveEdit = async () => {
    if (!editState || !editText.trim()) return;
    setSavingEdit(true);
    try {
      if (editState.type === "feedback") {
        await updateDoc(doc(db, "app_feedback", editState.feedbackId), {
          feedback: editText.trim(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, "app_feedback", editState.feedbackId, "replies", editState.replyId || ""), {
          text: editText.trim(),
          updatedAt: serverTimestamp(),
        });
      }

      setEditState(null);
      setEditText("");
      showSnackbar("Changes saved.");
      loadBoard();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return 0;
    const total = ratings.reduce((sum, entry) => sum + (entry.rating || 0), 0);
    return total / ratings.length;
  }, [ratings]);

  const ratingByUserId = useMemo(() => {
    const entries: Record<string, number> = {};
    ratings.forEach((entry) => {
      if (entry.userId) {
        entries[entry.userId] = Number(entry.rating) || 0;
      }
    });
    return entries;
  }, [ratings]);

  const renderRatingItem = (item: RatingDoc) => {
    const ratingName = item.isAnonymous ? "Anonymous" : item.displayName || item.userEmail || "User";
    const safeRating = Math.max(1, Math.min(5, Number(item.rating) || 0));
    return (
      <View key={item.id} style={styles.ratingListItem}>
        <View style={styles.ratingListHead}>
          <Text style={styles.ratingListName}>{ratingName}</Text>
          <Text style={styles.ratingListTime}>{formatDateTime(item.updatedAt || item.createdAt)}</Text>
        </View>
        <Text style={styles.ratingListStars}>{`${"\u2605".repeat(safeRating)}${"\u2606".repeat(5 - safeRating)} (${safeRating}/5)`}</Text>
      </View>
    );
  };

  const renderReply = (feedbackId: string, reply: FeedbackReply) => {
    const reactionsCount = Object.keys(reply.reactions || {}).length;
    const editable = canManage(reply.userId);
    const replyName = reply.isAnonymous ? "Anonymous" : reply.displayName || reply.userEmail || "User";

    return (
      <View key={reply.id} style={styles.replyItem}>
        <View style={styles.replyHead}>
          <Text style={styles.replyAuthor}>{replyName}</Text>
          <Text style={styles.replyTime}>{formatDateTime(reply.createdAt)}</Text>
        </View>
        <Text style={styles.replyBody}>{reply.text}</Text>
        <View style={styles.replyActions}>
          <Button compact mode="text" onPress={() => toggleReplyReaction(feedbackId, reply)}>
            {`${LIKE} (${reactionsCount})`}
          </Button>
          {editable && (
            <Button
              compact
              mode="text"
              onPress={() =>
                openEditDialog({
                  type: "reply",
                  feedbackId,
                  replyId: reply.id,
                  initialText: reply.text,
                })
              }
            >
              Edit
            </Button>
          )}
          {editable && (
            <Button compact mode="text" textColor="#b91c1c" onPress={() => promptDeleteReply(feedbackId, reply.id)}>
              Delete
            </Button>
          )}
        </View>
      </View>
    );
  };

  const renderFeedbackItem = ({ item }: { item: FeedbackPost }) => {
    const feedbackName = item.isAnonymous ? "Anonymous" : item.displayName || item.userEmail || "User";
    const userRating = ratingByUserId[item.userId];
    const reactionCount = Object.keys(item.reactions || {}).length;
    const isExpanded = Boolean(expandedReplies[item.id]);
    const editable = canManage(item.userId);
    const replyText = replyInputByPost[item.id] || "";
    const replyAnonymous = Boolean(replyAnonymousByPost[item.id]);

    return (
      <Card style={styles.feedbackCard} mode="elevated">
        <Card.Content>
          <View style={styles.feedbackHeader}>
            <Text style={styles.feedbackAuthor}>{feedbackName}</Text>
            <Text style={styles.feedbackDate}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.feedbackRatingMeta}>
            {userRating > 0 ? `App Rating: ${userRating}/5` : "App Rating: No rating yet"}
          </Text>

          <Text style={styles.feedbackText}>{item.feedback}</Text>
          {item.updatedAt && <Text style={styles.editedTag}>Edited</Text>}

          <View style={styles.feedbackActions}>
            <Button compact mode="text" onPress={() => toggleFeedbackReaction(item)}>
              {`${LIKE} (${reactionCount})`}
            </Button>
            <Button compact mode="text" onPress={() => setExpandedReplies((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}>
              {isExpanded ? `Hide Replies (${item.replies.length})` : `Replies (${item.replies.length})`}
            </Button>
            {editable && (
              <Button
                compact
                mode="text"
                onPress={() =>
                  openEditDialog({
                    type: "feedback",
                    feedbackId: item.id,
                    initialText: item.feedback,
                  })
                }
              >
                Edit
              </Button>
            )}
            {editable && (
              <Button compact mode="text" textColor="#b91c1c" onPress={() => promptDeleteFeedback(item.id)}>
                Delete
              </Button>
            )}
          </View>

          {isExpanded && (
            <View style={styles.repliesWrap}>
              {item.replies.length === 0 && <Text style={styles.noReplies}>No replies yet.</Text>}
              {item.replies.map((reply) => renderReply(item.id, reply))}

              <Divider style={styles.replyDivider} />
              <TextInput
                mode="outlined"
                placeholder="Write a reply..."
                value={replyText}
                onChangeText={(text) => setReplyInputByPost((prev) => ({ ...prev, [item.id]: text }))}
                multiline
                style={styles.replyInput}
              />
              <TouchableOpacity
                style={styles.replyAnonRow}
                onPress={() => setReplyAnonymousByPost((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                activeOpacity={0.8}
              >
                <Checkbox status={replyAnonymous ? "checked" : "unchecked"} />
                <Text style={styles.replyAnonText}>Reply anonymously</Text>
              </TouchableOpacity>
              <Button
                mode="contained-tonal"
                onPress={() => submitReply(item.id)}
                loading={replySubmittingPostId === item.id}
                disabled={replySubmittingPostId === item.id || !replyText.trim()}
              >
                Reply
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.screen, isDesktop && styles.screenDesktop]}>
      <FlatList
        data={feedbacks}
        keyExtractor={(item) => item.id}
        renderItem={renderFeedbackItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <ScrollView scrollEnabled={false}>
            <Card style={styles.composerCard}>
              <Card.Content>
                <Text style={styles.title}>Rate & Feedback</Text>
                <Text style={styles.subtitle}>
                  One rating per user. You can post as many feedback comments as you want.
                </Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>Feedback Posts: {feedbacks.length}</Text>
                  <Text style={styles.summaryText}>Ratings: {ratings.length}</Text>
                  <Text style={styles.summaryText}>Average Rating: {averageRating.toFixed(1)}/5</Text>
                </View>

                <Text style={styles.label}>Your App Rating (1 rating per account)</Text>
                {isSuperAdmin ? (
                  <Text style={styles.superAdminNotice}>Superadmin accounts can read ratings but cannot submit one.</Text>
                ) : (
                  <>
                    <Text style={styles.ratingHint}>Tap the same star again to clear your rating.</Text>
                    <View style={styles.ratingPickerRow}>
                      {RATING_VALUES.map((value) => (
                        <TouchableOpacity
                          key={value}
                          onPress={() => {
                            if (rating === value) {
                              if (!isSuperAdmin) {
                                removeMyRating();
                              }
                              return;
                            }
                            setRating(value);
                          }}
                          style={styles.ratingButton}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.ratingIcon, value <= rating && styles.ratingIconActive]}>{"\u2605"}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.anonRow} onPress={() => setRatingAnonymous((prev) => !prev)} activeOpacity={0.8}>
                      <Checkbox status={ratingAnonymous ? "checked" : "unchecked"} />
                      <Text style={styles.anonText}>Show this rating as anonymous</Text>
                    </TouchableOpacity>
                    <Button mode="contained" onPress={saveMyRating} loading={savingRating} disabled={savingRating} buttonColor="#b91c1c">
                      Save My Rating
                    </Button>
                  </>
                )}

                <Divider style={styles.sectionDivider} />

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.label}>Community Ratings</Text>
                  <Button compact mode="text" onPress={() => setShowRatingsList((prev) => !prev)}>
                    {showRatingsList ? "Hide" : "Show"}
                  </Button>
                </View>
                {!showRatingsList ? (
                  <Text style={styles.noRatingsText}>Ratings are hidden. Tap Show to view.</Text>
                ) : ratings.length === 0 ? (
                  <Text style={styles.noRatingsText}>No ratings yet. Be the first to rate the app.</Text>
                ) : (
                  <View style={styles.ratingListWrap}>{ratings.map((item) => renderRatingItem(item))}</View>
                )}

                <Divider style={styles.sectionDivider} />

                <Text style={styles.label}>Post Feedback (unlimited)</Text>
                <TextInput
                  mode="outlined"
                  label="Write your feedback"
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  multiline
                  style={styles.feedbackInput}
                />
                <TouchableOpacity style={styles.anonRow} onPress={() => setPostAnonymous((prev) => !prev)} activeOpacity={0.8}>
                  <Checkbox status={postAnonymous ? "checked" : "unchecked"} />
                  <Text style={styles.anonText}>Post feedback anonymously</Text>
                </TouchableOpacity>
                <Button
                  mode="contained"
                  onPress={submitFeedback}
                  loading={postingFeedback}
                  disabled={postingFeedback}
                  buttonColor="#7f1d1d"
                >
                  {postingFeedback ? "Posting..." : "Post Feedback"}
                </Button>
              </Card.Content>
            </Card>
          </ScrollView>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>No feedback yet</Text>
              <Text style={styles.emptyHint}>Be the first to share your experience.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      <Portal>
        <Dialog visible={!!editState} onDismiss={() => setEditState(null)}>
          <Dialog.Title>Edit</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" multiline value={editText} onChangeText={setEditText} placeholder="Update your text" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditState(null)}>Cancel</Button>
            <Button onPress={saveEdit} loading={savingEdit} disabled={savingEdit || !editText.trim()}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={2200}>
        {snackbarText}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  screenDesktop: {
    maxWidth: 980,
    width: "100%",
    alignSelf: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 34,
  },
  composerCard: {
    borderRadius: 14,
    marginBottom: 10,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: "#b91c1c",
  },
  subtitle: {
    marginTop: 4,
    color: "#4b5563",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  summaryText: {
    color: "#6b7280",
    fontWeight: "700",
    fontSize: 12,
  },
  label: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  superAdminNotice: {
    color: "#6b7280",
    fontStyle: "italic",
    marginBottom: 8,
  },
  ratingPickerRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  ratingHint: {
    color: "#6b7280",
    marginBottom: 4,
    fontSize: 12,
  },
  ratingButton: {
    marginRight: 6,
  },
  ratingIcon: {
    fontSize: 34,
    color: "#d1d5db",
  },
  ratingIconActive: {
    color: "#dc2626",
  },
  sectionDivider: {
    marginVertical: 14,
  },
  noRatingsText: {
    color: "#6b7280",
    fontStyle: "italic",
    marginBottom: 2,
  },
  ratingListWrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    maxHeight: 210,
  },
  ratingListItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  ratingListHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  ratingListName: {
    flex: 1,
    color: "#111827",
    fontWeight: "700",
  },
  ratingListTime: {
    color: "#6b7280",
    fontSize: 11,
  },
  ratingListStars: {
    marginTop: 4,
    color: "#b91c1c",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  feedbackInput: {
    marginBottom: 4,
    backgroundColor: "#fff",
  },
  anonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  anonText: {
    color: "#374151",
    fontWeight: "600",
  },
  feedbackCard: {
    borderRadius: 12,
    marginTop: 10,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  feedbackAuthor: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
  },
  feedbackDate: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 2,
  },
  feedbackRatingMeta: {
    marginTop: 5,
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  feedbackText: {
    marginTop: 8,
    color: "#1f2937",
    fontSize: 15,
    lineHeight: 21,
  },
  editedTag: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 11,
    fontStyle: "italic",
  },
  feedbackActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  repliesWrap: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  noReplies: {
    color: "#6b7280",
    marginBottom: 6,
  },
  replyItem: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 8,
  },
  replyHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  replyAuthor: {
    fontWeight: "700",
    color: "#111827",
  },
  replyTime: {
    fontSize: 11,
    color: "#6b7280",
  },
  replyBody: {
    marginTop: 6,
    color: "#1f2937",
  },
  replyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  replyDivider: {
    marginVertical: 8,
  },
  replyInput: {
    backgroundColor: "#fff",
  },
  replyAnonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 2,
  },
  replyAnonText: {
    color: "#374151",
    fontWeight: "600",
  },
  emptyWrap: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    alignItems: "center",
  },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 17,
    color: "#111827",
  },
  emptyHint: {
    marginTop: 4,
    color: "#6b7280",
  },
});

