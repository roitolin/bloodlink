import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { createAdminNotification } from "../../utils/createAdminNotification";
import { buildSlaDeadlineDate, getSlaMinutes } from "../../utils/requestSla";
import OsmMapEmbed from "../../components/OsmMapEmbed";
import { ensureConversationForUsers } from "../../utils/chatHelpers";
import { syncPublicCityAvailability } from "../../utils/publicCityAvailability";
import { consumeRateLimit, isRateLimitError } from "../../utils/rateLimiter";
import { hasSuspiciousPayload, sanitizePlainText } from "../../utils/inputSecurity";
import { getAddressLocalityLabel } from "../../utils/locationAddress";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const URGENCY_LEVELS = ["Normal", "Urgent", "Critical"];

export default function CreateRequestScreen({ navigation, route }: any) {
  const initialDraft = route.params?.draft || {};
  const editRequestId = route.params?.editRequestId || null;
  const originalStatus = String(route.params?.originalStatus || "pending").toLowerCase();
  const isEditMode = Boolean(editRequestId);
  const prefilledBloodType = route.params?.prefilledBloodType || BLOOD_TYPES[0];
  const donorContext = route.params?.fromFindDonor ? route.params?.donorContext || null : null;
  const [patientName, setPatientName] = useState(initialDraft.patientName || "");
  const [hospital, setHospital] = useState(initialDraft.hospital || "");
  const [city, setCity] = useState(initialDraft.city || "");
  const [bloodType, setBloodType] = useState(initialDraft.bloodType || prefilledBloodType);
  const [urgency, setUrgency] = useState(initialDraft.urgency || URGENCY_LEVELS[0]);
  const [contactNumber, setContactNumber] = useState(initialDraft.contactNumber || "");
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(
    route.params?.selectedLocation || initialDraft.selectedLocation || null
  );
  const [selectedLocationLabel, setSelectedLocationLabel] = useState(
    route.params?.selectedLocationLabel || initialDraft.selectedLocationLabel || ""
  );
  const [loading, setLoading] = useState(false);
  const [successRequestId, setSuccessRequestId] = useState<string | null>(null);
  const [successPatientName, setSuccessPatientName] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const { isDesktop } = useResponsive();

  const resetForm = () => {
    setPatientName("");
    setHospital("");
    setCity("");
    setBloodType(prefilledBloodType);
    setUrgency(URGENCY_LEVELS[0]);
    setContactNumber("");
    setSelectedLocation(null);
    setSelectedLocationLabel("");
    setValidationMessage("");
  };

  const goToRecentRequest = (requestId: string, options?: { justCreated?: boolean; justUpdated?: boolean }) => {
    const requestParams = {
      screen: "MyRequests",
      params: {
        highlightRequestId: requestId,
        justCreated: Boolean(options?.justCreated),
        justUpdated: Boolean(options?.justUpdated),
        refreshToken: Date.now(),
      },
    };

    const tabParent = navigation.getParent?.();
    if (tabParent) {
      tabParent.navigate("Requests", requestParams);
      return;
    }

    navigation.navigate("MyRequests", requestParams.params);
  };

  useEffect(() => {
    if (route.params?.draft) {
      const returnedDraft = route.params.draft;
      setPatientName(returnedDraft.patientName || "");
      setHospital(returnedDraft.hospital || "");
      setCity(returnedDraft.city || "");
      setBloodType(returnedDraft.bloodType || prefilledBloodType);
      setUrgency(returnedDraft.urgency || URGENCY_LEVELS[0]);
      setContactNumber(returnedDraft.contactNumber || "");
    }

    if (route.params?.selectedLocation) {
      setSelectedLocation(route.params.selectedLocation);
      setSelectedLocationLabel(route.params?.selectedLocationLabel || "");
      const selectedAddress = route.params?.selectedAddress;

      const autoCity = getAddressLocalityLabel(selectedAddress);
      if (autoCity) setCity(autoCity);
    }
  }, [
    prefilledBloodType,
    route.params?.fromMapPicker,
    route.params?.selectedLocation,
    route.params?.selectedLocationLabel,
    route.params?.selectedAddress,
    route.params?.draft,
  ]);

  const handleSubmit = async () => {
    const safePatientName = sanitizePlainText(patientName, 120);
    const safeHospital = sanitizePlainText(hospital, 180);
    const safeCity = sanitizePlainText(city, 80);
    const safeContactNumber = sanitizePlainText(contactNumber, 24);

    if (!safePatientName || !safeHospital || !safeCity || !safeContactNumber) {
      setValidationMessage("Please fill all required fields before submitting your blood request.");
      return;
    }
    setValidationMessage("");
    if (
      hasSuspiciousPayload(safePatientName) ||
      hasSuspiciousPayload(safeHospital) ||
      hasSuspiciousPayload(safeCity)
    ) {
      Alert.alert("Blocked", "Request contains unsafe text patterns. Please revise and try again.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in.");

      if (isEditMode) {
        const payload: Record<string, any> = {
          patientName: safePatientName,
          hospital: safeHospital,
          city: safeCity,
          bloodTypeNeeded: bloodType,
          urgency,
          contactNumber: safeContactNumber,
          location: selectedLocation || null,
          locationLabel: selectedLocation ? selectedLocationLabel || safeCity : null,
          updatedAt: serverTimestamp(),
        };

        if (originalStatus === "pending") {
          payload.slaDeadlineAt = buildSlaDeadlineDate(urgency);
        }

        await updateDoc(doc(db, "requests", editRequestId), payload);
        await syncPublicCityAvailability(db);
        Alert.alert("Success", "Request updated successfully.");
        goToRecentRequest(editRequestId, { justUpdated: true });
      } else {
        await consumeRateLimit(db, user.uid, "create_request");

        const requestRef = await addDoc(collection(db, "requests"), {
          requesterId: user.uid,
          patientName: safePatientName,
          hospital: safeHospital,
          city: safeCity,
          bloodTypeNeeded: bloodType,
          urgency,
          contactNumber: safeContactNumber,
          location: selectedLocation || null,
          locationLabel: selectedLocation ? selectedLocationLabel || safeCity : null,
          status: "pending",
          createdAt: serverTimestamp(),
          slaDeadlineAt: buildSlaDeadlineDate(urgency),
        });

        await createAdminNotification(
          "request_pending",
          "New Blood Request",
          `${safePatientName} (${bloodType}) request submitted at ${safeHospital}.`,
          { requestId: requestRef.id, requesterId: user.uid, urgency, bloodType }
        );
        await syncPublicCityAvailability(db);

        resetForm();
        setSuccessRequestId(requestRef.id);
        setSuccessPatientName(patientName.trim());
      }
    } catch (error: any) {
      if (isRateLimitError(error)) {
        Alert.alert("Slow down", `Please wait ${error.retryAfterSeconds}s before creating another request.`);
        return;
      }
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const useDonorLocation = () => {
    if (!donorContext?.location) {
      Alert.alert("No location", "Selected donor has no pinned location.");
      return;
    }

    setSelectedLocation({
      latitude: donorContext.location.latitude,
      longitude: donorContext.location.longitude,
    });
    setSelectedLocationLabel(`Near donor: ${donorContext.fullName || "Donor"}`);
    if (donorContext.city) setCity(String(donorContext.city));
  };

  const callDonor = async () => {
    if (!donorContext?.contactNumber) {
      Alert.alert("Unavailable", "No contact number available.");
      return;
    }
    try {
      await Linking.openURL(`tel:${donorContext.contactNumber}`);
    } catch {
      Alert.alert("Error", "Unable to open phone dialer.");
    }
  };

  const smsDonor = async () => {
    if (!donorContext?.contactNumber) {
      Alert.alert("Unavailable", "No contact number available.");
      return;
    }
    try {
      await Linking.openURL(`sms:${donorContext.contactNumber}`);
    } catch {
      Alert.alert("Error", "Unable to open SMS app.");
    }
  };

  const chatDonor = async () => {
    const user = auth.currentUser;
    if (!user || !donorContext?.donorId) {
      Alert.alert("Unavailable", "Unable to open chat right now.");
      return;
    }

    try {
      const conversationId = await ensureConversationForUsers(db, user.uid, donorContext.donorId);

      const tabParent = navigation.getParent?.();
      if (tabParent) {
        tabParent.navigate("Feed", {
          screen: "Chat",
          params: { conversationId, otherUserId: donorContext.donorId },
        });
      } else {
        navigation.navigate("Feed", {
          screen: "Chat",
          params: { conversationId, otherUserId: donorContext.donorId },
        });
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Unable to open chat.");
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      {isDesktop && (
        <View style={styles.pageHeader}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
              <Text style={styles.backLinkText}>{"< Back"}</Text>
            </Pressable>
          )}
          <Text style={styles.pageTitle}>{isEditMode ? "Edit Blood Request" : "Create Blood Request"}</Text>
          <Text style={styles.pageSubtitle}>
            {isEditMode ? "Update details so donors get the latest information." : "Share accurate details so nearby donors can respond quickly."}
          </Text>
        </View>
      )}

      {validationMessage ? (
        <View style={styles.validationBanner}>
          <Text style={styles.validationTitle}>Required fields missing</Text>
          <Text style={styles.validationText}>{validationMessage}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Patient Name *</Text>
      <TextInput
        style={styles.input}
        value={patientName}
        onChangeText={(value) => {
          setPatientName(value);
          if (validationMessage) setValidationMessage("");
        }}
        placeholder="Enter patient name"
      />

      <Text style={styles.label}>Hospital *</Text>
      <TextInput
        style={styles.input}
        value={hospital}
        onChangeText={(value) => {
          setHospital(value);
          if (validationMessage) setValidationMessage("");
        }}
        placeholder="Enter hospital name"
      />

      <Text style={styles.label}>City / Municipality *</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={(value) => {
          setCity(value);
          if (validationMessage) setValidationMessage("");
        }}
        placeholder="Auto-filled from map or enter manually"
      />

      <Text style={styles.label}>Blood Type Needed *</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={bloodType} onValueChange={setBloodType}>
          {BLOOD_TYPES.map((type) => (
            <Picker.Item key={type} label={type} value={type} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Urgency</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={urgency} onValueChange={setUrgency}>
          {URGENCY_LEVELS.map((level) => (
            <Picker.Item key={level} label={level} value={level} />
          ))}
        </Picker>
      </View>
      <Text style={styles.slaHint}>
        Target response time: this request should be accepted within {getSlaMinutes(urgency)} minutes.
      </Text>

      <Text style={styles.label}>Contact Number *</Text>
      <TextInput
        style={styles.input}
        value={contactNumber}
        onChangeText={(value) => {
          setContactNumber(value);
          if (validationMessage) setValidationMessage("");
        }}
        placeholder="e.g. 09123456789"
        keyboardType="phone-pad"
      />

      {donorContext ? (
        <View style={styles.donorAssistCard}>
          <Text style={styles.donorAssistTitle}>Selected Donor</Text>
          <Text style={styles.donorAssistText}>
            {donorContext.fullName || "Donor"} • {donorContext.bloodType || "N/A"}
          </Text>
          <Text style={styles.donorAssistText}>
            {donorContext.city || "Unknown city"}
          </Text>
          <View style={styles.quickContactRow}>
            <Button mode="outlined" onPress={smsDonor}>SMS</Button>
            <Button mode="outlined" onPress={chatDonor}>Chat</Button>
            <Button mode="outlined" onPress={callDonor}>Call</Button>
          </View>
          {donorContext.location ? (
            <View style={styles.donorMapWrap}>
              <OsmMapEmbed
                latitude={donorContext.location.latitude}
                longitude={donorContext.location.longitude}
                height={220}
                markers={[
                  {
                    id: "selected-donor",
                    latitude: donorContext.location.latitude,
                    longitude: donorContext.location.longitude,
                    label: donorContext.fullName || "Selected Donor",
                    color: "#dc2626",
                  },
                ]}
              />
              <Button mode="contained-tonal" onPress={useDonorLocation} style={styles.useDonorLocationBtn}>
                Use Donor Location
              </Button>
            </View>
          ) : (
            <Text style={styles.locationPrivacyHint}>This donor has no pinned location yet.</Text>
          )}
        </View>
      ) : null}

      <Text style={styles.label}>Location on Map (Optional)</Text>
      <View style={styles.locationCard}>
        <Text style={styles.locationText}>
          {selectedLocation
            ? selectedLocationLabel || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
            : "No map pin selected. You can still create the request using your city only."}
        </Text>
        <Text style={styles.locationPrivacyHint}>
          Add a map pin for faster matching, or leave it blank and use your city only.
        </Text>
        <Button
          mode="outlined"
          icon="map-marker"
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate("MapLocationPicker", {
              returnScreen: "CreateRequest",
              returnRouteKey: route.key,
              editRequestId,
              originalStatus,
              initialLocation: selectedLocation,
              draft: {
                patientName,
                hospital,
                city,
                bloodType,
                urgency,
                contactNumber,
                selectedLocation,
                selectedLocationLabel,
              },
            })
          }
        >
          {selectedLocation ? "Update Pin on Map" : "Add Location on Map"}
        </Button>
      </View>

      <Button
        mode="contained"
        icon={isEditMode ? "content-save" : "plus-circle"}
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (isEditMode ? "Saving..." : "Creating...") : isEditMode ? "Save Changes" : "Create Request"}
      </Button>

      <Portal>
        <Dialog visible={!isEditMode && !!successRequestId} onDismiss={() => setSuccessRequestId(null)}>
          <Dialog.Title>Request Posted</Dialog.Title>
          <Dialog.Content>
            <Text>
              {`Success! ${successPatientName || "Your"} request was posted. You can view it now in Active Requests.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSuccessRequestId(null)}>Create Another</Button>
            <Button
              onPress={() => {
                const id = successRequestId;
                setSuccessRequestId(null);
                if (id) goToRecentRequest(id, { justCreated: true });
              }}
            >
              View Active Request
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: "#f5f5f5" },
  pageHeader: {
    marginBottom: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
  },
  slaHint: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 6,
    marginTop: -6,
    fontWeight: "600",
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backLinkText: {
    color: "#6b7280",
    fontWeight: "700",
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#b91c1c",
  },
  pageSubtitle: {
    marginTop: 4,
    color: "#4b5563",
    fontSize: 14,
  },
  validationBanner: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    backgroundColor: "#fff1f2",
    padding: 14,
  },
  validationTitle: {
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 15,
  },
  validationText: {
    marginTop: 4,
    color: "#7f1d1d",
    fontWeight: "600",
    lineHeight: 20,
  },
  label: { fontSize: 16, fontWeight: "600", marginTop: 15, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  locationCard: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    backgroundColor: "#fff",
    gap: 8,
  },
  donorAssistCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff7f7",
    gap: 6,
  },
  donorAssistTitle: {
    color: "#991b1b",
    fontWeight: "800",
    fontSize: 15,
  },
  donorAssistText: {
    color: "#7f1d1d",
    fontSize: 13,
    fontWeight: "600",
  },
  quickContactRow: {
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  donorMapWrap: {
    marginTop: 6,
    gap: 8,
  },
  useDonorLocationBtn: {
    borderRadius: 8,
  },
  locationText: {
    color: "#444",
    fontSize: 14,
  },
  locationPrivacyHint: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "600",
  },
  actionButton: {
    borderRadius: 8,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 10,
  },
  containerDesktop: {
    maxWidth: 760,
    alignSelf: "center",
    width: "100%",
  },
});


