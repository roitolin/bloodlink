import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Card, Button as PaperButton, Chip } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { uploadCertificate } from "../../services/cloudinary";
import { createAdminNotification } from "../../utils/createAdminNotification";
import { syncPublicCityAvailability } from "../../utils/publicCityAvailability";
import { useResponsive } from "../../utils/responsive";
import { getAddressLocalityLabel } from "../../utils/locationAddress";
import { useAppDialog } from "../../hooks/useAppDialog";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

type DonorStatus = "none" | "pending" | "verified" | "rejected";
type AvailabilityStatus = "available" | "unavailable";
type SelectedLocation = { latitude: number; longitude: number } | null;
type PreviewDocument = { url: string; title: string } | null;
type LocationDraft = {
  bloodType?: string;
  city?: string;
  contactNumber?: string;
  street?: string;
  selectedLocation?: SelectedLocation;
  selectedLocationLabel?: string;
};

const buildStreetLine = (address: any) =>
  [address?.streetNumber, address?.street]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .trim();

export default function DonorProfileScreen({ navigation, route }: any) {
  const pendingMapAutofillRef = useRef(false);
  const applyReturnedMapSelectionRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(true);
  const [savingDonor, setSavingDonor] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingValidId, setUploadingValidId] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<PreviewDocument>(null);
  const [editingVerifiedDonor, setEditingVerifiedDonor] = useState(false);

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [bloodType, setBloodType] = useState(BLOOD_TYPES[0]);
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState("");
  const [certificateURL, setCertificateURL] = useState<string | null>(null);
  const [validIdURL, setValidIdURL] = useState<string | null>(null);
  const [donorStatus, setDonorStatus] = useState<DonorStatus>("none");
  const [donorAvailability, setDonorAvailability] = useState<AvailabilityStatus>("unavailable");
  const [donationCooldownUntil, setDonationCooldownUntil] = useState<Date | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const { isDesktop } = useResponsive();
  const { showDialog, dialog } = useAppDialog();

  const applyReturnedMapSelection = useCallback(() => {
    const draft = route.params?.draft as LocationDraft | undefined;
    const locationFromMap = route.params?.selectedLocation as SelectedLocation | undefined;
    const selectedAddress = route.params?.selectedAddress;
    const selectedCity = route.params?.selectedCity;

    if (draft) {
      if (draft.bloodType) setBloodType(draft.bloodType);
      if (typeof draft.city === "string") setCity(draft.city);
      if (typeof draft.street === "string") setStreet(draft.street);
      if (draft.selectedLocation) setSelectedLocation(draft.selectedLocation);
      if (typeof draft.selectedLocationLabel === "string") setSelectedLocationLabel(draft.selectedLocationLabel);
    }

    if (locationFromMap) {
      setSelectedLocation(locationFromMap);
      setSelectedLocationLabel(route.params?.selectedLocationLabel || "");
      if (!selectedAddress) setStreet("");
    }

    if (typeof selectedCity === "string" && selectedCity.trim()) {
      setCity(selectedCity);
    }

    if (selectedAddress) {
      setStreet(buildStreetLine(selectedAddress));
      const autoCity = getAddressLocalityLabel(selectedAddress);

      if (autoCity) setCity(autoCity);
    }
  }, [
    route.params?.draft,
    route.params?.selectedAddress,
    route.params?.selectedCity,
    route.params?.selectedLocation,
    route.params?.selectedLocationLabel,
  ]);

  applyReturnedMapSelectionRef.current = applyReturnedMapSelection;

  const loadProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      const data = snapshot.data();
      if (!data) return;

      setFullName(data.fullName || "");
      setContactNumber(data.contactNumber || "");
      setBloodType(data.bloodType || BLOOD_TYPES[0]);
      setCity(data.city || "");
      setStreet(data.street || "");
      setCertificateURL(data.medicalCertificateURL || null);
      setValidIdURL(data.validIdURL || null);
      setDonorStatus((data.donorStatus || "none") as DonorStatus);
      setDonorAvailability((data.availabilityStatus || "unavailable") as AvailabilityStatus);
      setRejectionReason(data.donorVerificationRejectionReason || null);

      if (typeof data.location?.latitude === "number" && typeof data.location?.longitude === "number") {
        setSelectedLocation({
          latitude: data.location.latitude,
          longitude: data.location.longitude,
        });
        setSelectedLocationLabel(data.locationLabel || [data.street, data.city].filter(Boolean).join(", "));
      } else {
        setSelectedLocation(null);
        setSelectedLocationLabel("");
      }

      const cooldownDate = data?.donationCooldownUntil?.toDate
        ? data.donationCooldownUntil.toDate()
        : data?.donationCooldownUntil
        ? new Date(data.donationCooldownUntil)
        : null;
      setDonationCooldownUntil(cooldownDate && !Number.isNaN(cooldownDate.getTime()) ? cooldownDate : null);

      if (pendingMapAutofillRef.current) {
        applyReturnedMapSelectionRef.current();
        pendingMapAutofillRef.current = false;
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load donor application.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!route.params?.fromMapPicker && !route.params?.draft) return;

    pendingMapAutofillRef.current = loading && Boolean(route.params?.fromMapPicker);
    applyReturnedMapSelection();
  }, [
    applyReturnedMapSelection,
    loading,
    route.params?.fromMapPicker,
    route.params?.draft,
  ]);

  const buildLocationDraft = (): LocationDraft => ({
    bloodType,
    city,
    street,
    contactNumber,
    selectedLocation,
    selectedLocationLabel,
  });

  const openMapPicker = () => {
    navigation.navigate("MapLocationPicker", {
      returnScreen: route.name,
      returnRouteKey: route.key,
      initialLocation: selectedLocation,
      draft: buildLocationDraft(),
    });
  };

  const openPreview = (url: string | null, title: string) => {
    if (!url) return;
    setPreviewDocument({ url, title });
  };

  const toggleDonorAvailability = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const nextStatus: AvailabilityStatus = donorAvailability === "available" ? "unavailable" : "available";
    if (
      nextStatus === "available" &&
      donationCooldownUntil &&
      donationCooldownUntil.getTime() > Date.now()
    ) {
      Alert.alert(
        "Donation cooldown active",
        `You can become available again after ${donationCooldownUntil.toLocaleDateString()} ${donationCooldownUntil.toLocaleTimeString()}.`
      );
      return;
    }

    setSavingDonor(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          availabilityStatus: nextStatus,
          availableSince: nextStatus === "available" ? new Date() : null,
        },
        { merge: true }
      );
      await syncPublicCityAvailability(db);
      setDonorAvailability(nextStatus);
      Alert.alert("Saved", `Donor availability is now ${nextStatus === "available" ? "ON" : "OFF"}.`);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update donor availability.");
    } finally {
      setSavingDonor(false);
    }
  };

  const saveVerifiedDonorDetails = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!bloodType || !city.trim() || !contactNumber.trim()) {
      Alert.alert("Missing fields", "Please complete blood type, city or municipality, and contact number.");
      return;
    }

    setSavingDonor(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          bloodType,
          city: city.trim(),
          street: street.trim() || null,
          contactNumber: contactNumber.trim(),
          location: selectedLocation || null,
          locationLabel: selectedLocation ? selectedLocationLabel || [street, city].filter(Boolean).join(", ") : null,
        },
        { merge: true }
      );
      await syncPublicCityAvailability(db);
      setEditingVerifiedDonor(false);
      Alert.alert("Saved", "Donor details updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update donor details.");
    } finally {
      setSavingDonor(false);
    }
  };

  const uploadVerificationAsset = async ({
    uri,
    field,
    label,
    onUploaded,
    setLoadingState,
  }: {
    uri: string;
    field: "medicalCertificateURL" | "validIdURL";
    label: string;
    onUploaded: (url: string) => void;
    setLoadingState: (value: boolean) => void;
  }) => {
    setLoadingState(true);
    try {
      const downloadURL = await uploadCertificate(uri);
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      await setDoc(doc(db, "users", user.uid), { [field]: downloadURL }, { merge: true });
      onUploaded(downloadURL);
      Alert.alert("Success", `${label} uploaded.`);
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || `Failed to upload ${label.toLowerCase()}.`);
    } finally {
      setLoadingState(false);
    }
  };

  const pickDocument = async (kind: "certificate" | "validId") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      if (kind === "certificate") {
        await uploadVerificationAsset({
          uri: result.assets[0].uri,
          field: "medicalCertificateURL",
          label: "Medical certificate",
          onUploaded: setCertificateURL,
          setLoadingState: setUploadingCert,
        });
        return;
      }

      await uploadVerificationAsset({
        uri: result.assets[0].uri,
        field: "validIdURL",
        label: "Valid ID",
        onUploaded: setValidIdURL,
        setLoadingState: setUploadingValidId,
      });
    }
  };

  const submitVerificationRequest = async () => {
    if (!certificateURL) {
      Alert.alert("Error", "Please upload a medical certificate.");
      return;
    }

    if (!validIdURL) {
      Alert.alert("Error", "Please upload 1 valid ID.");
      return;
    }

    if (!bloodType || !city.trim() || !contactNumber.trim()) {
      Alert.alert("Error", "Please complete blood type, city or municipality, and contact number.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSavingDonor(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          bloodType,
          city: city.trim(),
          street: street.trim() || null,
          contactNumber: contactNumber.trim(),
          location: selectedLocation || null,
          locationLabel: selectedLocation ? selectedLocationLabel || [street, city].filter(Boolean).join(", ") : null,
          medicalCertificateURL: certificateURL,
          validIdURL,
          donorStatus: "pending",
          donorVerificationRejectionReason: null,
          availabilityStatus: "unavailable",
          donorVerificationRequestedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await syncPublicCityAvailability(db);

      await createAdminNotification(
        "donor_pending",
        "New Donor Verification Request",
        `${fullName || "A user"} submitted donor verification (${bloodType}).`,
        {
          userId: user.uid,
          fullName: fullName || null,
          bloodType,
          city: city.trim(),
        }
      );

      setDonorStatus("pending");
      setDonorAvailability("unavailable");
      setRejectionReason(null);
      Alert.alert("Submitted", "Your donor verification request has been sent to admin.", [
        {
          text: "OK",
          onPress: () => navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] }),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to submit verification request.");
    } finally {
      setSavingDonor(false);
    }
  };

  const confirmSubmitVerification = () => {
    if (!certificateURL) {
      Alert.alert("Error", "Please upload a medical certificate.");
      return;
    }

    if (!validIdURL) {
      Alert.alert("Error", "Please upload 1 valid ID.");
      return;
    }

    if (!bloodType || !city.trim() || !contactNumber.trim()) {
      Alert.alert("Error", "Please complete blood type, city or municipality, and contact number.");
      return;
    }

    showDialog({
      title: "Submit Donor Verification?",
      message: `Your donor profile will be sent to admin for review.\n\nBlood Type: ${bloodType}\nCity: ${city.trim()}\nContact Number: ${contactNumber.trim()}`,
      tone: "warning",
      actions: [
        { label: "Cancel", mode: "text" },
        {
          label: "Submit Now",
          mode: "contained",
          onPress: () => submitVerificationRequest(),
        },
      ],
    });
  };

  const donorStatusColor =
    donorStatus === "verified"
      ? "#15803d"
      : donorStatus === "pending"
      ? "#b45309"
      : donorStatus === "rejected"
      ? "#b91c1c"
      : "#6b7280";

  const donorStatusTitle =
    donorStatus === "verified"
      ? "Verified donor account"
      : donorStatus === "pending"
      ? "Application under review"
      : donorStatus === "rejected"
      ? "Application needs updates"
      : "Start your donor verification";

  const donorStatusMessage =
    donorStatus === "verified"
      ? "Keep your availability, location, and verification files ready so requesters can find you faster."
      : donorStatus === "pending"
      ? "Your details are already submitted. Admin just needs to finish the review."
      : donorStatus === "rejected"
      ? "Update the documents or donor details below, then send a fresh application."
      : "Submit your donor details, medical certificate, and 1 valid ID in one clean flow.";

  const requirements = [
    {
      label: "Medical Certificate",
      ready: Boolean(certificateURL),
      optional: false,
      icon: certificateURL ? "checkmark-circle" : "document-text-outline",
    },
    {
      label: "1 Valid ID",
      ready: Boolean(validIdURL),
      optional: false,
      icon: validIdURL ? "checkmark-circle" : "card-outline",
    },
    {
      label: "Map Pin",
      ready: Boolean(selectedLocation),
      optional: true,
      icon: selectedLocation ? "location" : "location-outline",
    },
  ];

  const renderUploadPanel = ({
    title,
    helper,
    url,
    uploading,
    onUpload,
  }: {
    title: string;
    helper: string;
    url: string | null;
    uploading: boolean;
    onUpload: () => void;
  }) => (
    <View style={styles.documentPanel}>
      <View style={styles.documentHeader}>
        <View>
          <Text style={styles.documentTitle}>{title}</Text>
          <Text style={styles.documentHelper}>{helper}</Text>
        </View>
        <View style={[styles.documentStatusBadge, url ? styles.documentStatusBadgeReady : styles.documentStatusBadgePending]}>
          <Ionicons name={url ? "checkmark-circle" : "time-outline"} size={14} color={url ? "#166534" : "#92400e"} />
          <Text style={[styles.documentStatusText, url ? styles.documentStatusTextReady : styles.documentStatusTextPending]}>
            {url ? "Uploaded" : "Required"}
          </Text>
        </View>
      </View>

      {url ? (
        <TouchableOpacity onPress={() => openPreview(url, title)} style={styles.documentThumbnail}>
          <Image source={{ uri: url }} style={styles.documentImage} resizeMode="contain" />
        </TouchableOpacity>
      ) : (
        <View style={styles.documentPlaceholder}>
          <Ionicons name="cloud-upload-outline" size={22} color="#9ca3af" />
          <Text style={styles.documentPlaceholderText}>Upload a clear image</Text>
        </View>
      )}

      <PaperButton mode="outlined" onPress={onUpload} loading={uploading} disabled={uploading}>
        {url ? `Replace ${title}` : `Upload ${title}`}
      </PaperButton>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#d32f2f" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.backgroundOrbTop} pointerEvents="none" />
      <View style={styles.backgroundOrbBottom} pointerEvents="none" />
      <Card style={[styles.sectionCard, styles.heroCard]}>
        <Card.Content>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>Donor Verification</Text>
              <Text style={styles.heroTitle}>{donorStatusTitle}</Text>
              <Text style={styles.heroText}>{donorStatusMessage}</Text>
            </View>
            <Chip textStyle={{ color: donorStatusColor }} style={styles.statusChip}>
              {donorStatus.toUpperCase()}
            </Chip>
          </View>

          <View style={styles.requirementRow}>
            {requirements.map((item) => (
              <View
                key={item.label}
                style={[
                  styles.requirementPill,
                  item.ready ? styles.requirementPillReady : styles.requirementPillPending,
                  item.optional && styles.requirementPillOptional,
                ]}
              >
                <Ionicons name={item.icon as any} size={14} color={item.ready ? "#166534" : item.optional ? "#1d4ed8" : "#92400e"} />
                <Text
                  style={[
                    styles.requirementPillText,
                    item.ready ? styles.requirementPillTextReady : item.optional ? styles.requirementPillTextOptional : styles.requirementPillTextPending,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {donorStatus === "verified" ? (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#15803d" />
                <Text style={styles.infoBannerText}>
                  Your account is already verified. You can still refresh your donor details or replace uploaded files here.
                </Text>
              </View>
              {donationCooldownUntil && donationCooldownUntil.getTime() > Date.now() ? (
                <View style={styles.cooldownBanner}>
                  <Ionicons name="time-outline" size={18} color="#92400e" />
                  <Text style={styles.cooldownBannerText}>
                    Cooldown active until {donationCooldownUntil.toLocaleString()}.
                    You will stay hidden from donor search until it ends.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {donorStatus === "pending" ? (
            <View style={styles.infoBanner}>
              <Ionicons name="hourglass-outline" size={20} color="#b45309" />
              <Text style={styles.infoBannerText}>Your donor verification is under review by admin.</Text>
            </View>
          ) : null}

          {donorStatus === "rejected" ? (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="close-circle-outline" size={20} color="#b91c1c" />
                <Text style={styles.infoBannerText}>
                  Your previous donor application was rejected. Review the reason, update your documents, then submit again.
                </Text>
              </View>
              {rejectionReason ? <Text style={styles.reason}>Reason: {rejectionReason}</Text> : null}
            </>
          ) : null}
        </Card.Content>
      </Card>

      {(donorStatus === "none" || donorStatus === "rejected") ? (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Before You Submit</Text>
            <View style={styles.checklistWrap}>
              <View style={styles.checklistItem}>
                <Ionicons name="document-attach-outline" size={18} color="#b91c1c" />
                <Text style={styles.checklistText}>Upload a readable medical certificate image.</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons name="card-outline" size={18} color="#b91c1c" />
                <Text style={styles.checklistText}>Upload 1 valid ID for identity confirmation.</Text>
              </View>
              <View style={styles.checklistItem}>
                <Ionicons name="pin-outline" size={18} color="#b91c1c" />
                <Text style={styles.checklistText}>Set your location on the map so the nearest city or municipality fills in automatically.</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ) : null}

      {donorStatus === "verified" ? (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Verified Donor Tools</Text>

            <Text style={styles.label}>Donor Availability</Text>
            <PaperButton
              mode={donorAvailability === "available" ? "contained" : "outlined"}
              onPress={toggleDonorAvailability}
              loading={savingDonor}
              disabled={savingDonor}
              icon={donorAvailability === "available" ? "toggle-switch" : "toggle-switch-off-outline"}
              style={styles.availabilityToggle}
            >
              {donorAvailability === "available" ? "ON - Available to Donate" : "OFF - Unavailable"}
            </PaperButton>

            <View style={styles.divider} />

            {!editingVerifiedDonor ? (
              <>
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Blood Type</Text>
                    <Text style={styles.summaryValue}>{bloodType || "Not set"}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Availability</Text>
                    <Text style={styles.summaryValue}>
                      {donorAvailability === "available" ? "Available" : "Unavailable"}
                    </Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>City</Text>
                    <Text style={styles.summaryValue}>{city || "Not set"}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Contact Number</Text>
                    <Text style={styles.summaryValue}>{contactNumber || "Not set"}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Map Pin</Text>
                    <Text style={styles.summaryValue}>{selectedLocation ? "Set" : "Not set"}</Text>
                  </View>
                </View>

                {selectedLocation ? (
                  <>
                    <Text style={styles.coordinatesText}>
                      {selectedLocationLabel || `Coordinates: ${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
                    </Text>
                    {selectedLocationLabel ? (
                      <Text style={styles.coordinatesText}>
                        Coordinates: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                      </Text>
                    ) : null}
                  </>
                ) : null}

                <View style={styles.documentStack}>
                  {renderUploadPanel({
                    title: "Medical Certificate",
                    helper: "Replace the file if you need to refresh your verification documents.",
                    url: certificateURL,
                    uploading: uploadingCert,
                    onUpload: () => {
                      void pickDocument("certificate");
                    },
                  })}
                  {renderUploadPanel({
                    title: "1 Valid ID",
                    helper: "Upload one updated ID if your previous file needs replacement.",
                    url: validIdURL,
                    uploading: uploadingValidId,
                    onUpload: () => {
                      void pickDocument("validId");
                    },
                  })}
                </View>

                <PaperButton mode="contained-tonal" onPress={() => setEditingVerifiedDonor(true)} style={styles.editButton}>
                  Edit Donor Details
                </PaperButton>
              </>
            ) : (
              <>
                <Text style={styles.label}>Blood Type</Text>
                <View style={styles.pickerContainer}>
                  <Picker selectedValue={bloodType} onValueChange={setBloodType}>
                    {BLOOD_TYPES.map((type) => (
                      <Picker.Item key={type} label={type} value={type} />
                    ))}
                  </Picker>
                </View>

                <Text style={styles.label}>City / Municipality</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Auto-filled from map or enter manually" />

                <Text style={styles.label}>Contact Number</Text>
                <TextInput style={styles.input} value={contactNumber} onChangeText={setContactNumber} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />

                <Text style={styles.label}>Location</Text>
                <View style={styles.locationCard}>
                  <Text style={styles.locationText}>
                    {selectedLocation
                      ? selectedLocationLabel || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                      : "No map pin selected yet. You can still save using the city or municipality only."}
                  </Text>
                  <PaperButton mode="outlined" onPress={openMapPicker}>
                    {selectedLocation ? "Update Pin on Map" : "Set Location on Map"}
                  </PaperButton>
                </View>

                <View style={styles.inlineActions}>
                  <PaperButton mode="contained" onPress={saveVerifiedDonorDetails} loading={savingDonor} disabled={savingDonor}>
                    Save Donor Details
                  </PaperButton>
                  <PaperButton mode="text" onPress={() => setEditingVerifiedDonor(false)}>
                    Cancel
                  </PaperButton>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      ) : null}

      {(donorStatus === "none" || donorStatus === "rejected") ? (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Apply for Verification</Text>

            <Text style={styles.label}>Blood Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={bloodType} onValueChange={setBloodType}>
                {BLOOD_TYPES.map((type) => (
                  <Picker.Item key={type} label={type} value={type} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>City / Municipality *</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Auto-filled from map or enter manually" />

            <Text style={styles.label}>Contact Number *</Text>
            <TextInput style={styles.input} value={contactNumber} onChangeText={setContactNumber} placeholder="09XXXXXXXXX" keyboardType="phone-pad" />

            <Text style={styles.label}>Location (Map Pin Optional)</Text>
            <View style={styles.locationCard}>
              <Text style={styles.locationText}>
                {selectedLocation
                  ? selectedLocationLabel || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                  : "No map pin selected yet. Optional if the city or municipality is already correct."}
              </Text>
              <PaperButton mode="outlined" onPress={openMapPicker}>
                {selectedLocation ? "Update Pin on Map" : "Set Location on Map"}
              </PaperButton>
            </View>

            <Text style={styles.label}>Required Uploads</Text>
            <View style={styles.documentStack}>
              {renderUploadPanel({
                title: "Medical Certificate",
                helper: "Use a clear, readable image of your certificate.",
                url: certificateURL,
                uploading: uploadingCert,
                onUpload: () => {
                  void pickDocument("certificate");
                },
              })}
              {renderUploadPanel({
                title: "1 Valid ID",
                helper: "Upload one government or school ID image.",
                url: validIdURL,
                uploading: uploadingValidId,
                onUpload: () => {
                  void pickDocument("validId");
                },
              })}
            </View>

            <PaperButton
              mode="contained"
              onPress={confirmSubmitVerification}
              loading={savingDonor}
              disabled={savingDonor || !certificateURL || !validIdURL || !bloodType || !city.trim() || !contactNumber.trim()}
              style={styles.submitButton}
            >
              Submit for Verification
            </PaperButton>
          </Card.Content>
        </Card>
      ) : null}

      {(donorStatus === "pending" || donorStatus === "verified") ? (
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Verification Documents</Text>
            <View style={styles.documentStack}>
              {renderUploadPanel({
                title: "Medical Certificate",
                helper: "Tap the preview to inspect the uploaded file.",
                url: certificateURL,
                uploading: uploadingCert,
                onUpload: () => {
                  void pickDocument("certificate");
                },
              })}
              {renderUploadPanel({
                title: "1 Valid ID",
                helper: "Tap the preview to inspect the uploaded file.",
                url: validIdURL,
                uploading: uploadingValidId,
                onUpload: () => {
                  void pickDocument("validId");
                },
              })}
            </View>
          </Card.Content>
        </Card>
      ) : null}

      <Modal visible={Boolean(previewDocument)} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPreviewDocument(null)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity activeOpacity={1}>
              <Text style={styles.previewTitle}>{previewDocument?.title || "Document Preview"}</Text>
              {previewDocument?.url ? (
                <Image source={{ uri: previewDocument.url }} style={styles.certificatePreviewImage} resizeMode="contain" />
              ) : null}
              <PaperButton mode="contained-tonal" onPress={() => setPreviewDocument(null)}>
                Close
              </PaperButton>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {dialog}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 36,
    backgroundColor: "#f6f2ec",
    gap: 10,
  },
  containerDesktop: {
    maxWidth: 980,
    alignSelf: "center",
    width: "100%",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f6f2ec",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: 20,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(251, 146, 60, 0.08)",
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eadfd5",
    backgroundColor: "#fffdf9",
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#7f1d1d",
  },
  heroHeader: {
    gap: 14,
  },
  heroCopy: {
    gap: 6,
  },
  heroEyebrow: {
    color: "#fecdd3",
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontSize: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fffaf5",
  },
  heroText: {
    color: "#ffe4e6",
    fontSize: 14,
    lineHeight: 21,
  },
  statusChip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  requirementRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
    marginBottom: 12,
  },
  requirementPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requirementPillReady: {
    backgroundColor: "#dcfce7",
  },
  requirementPillPending: {
    backgroundColor: "#fef3c7",
  },
  requirementPillOptional: {
    backgroundColor: "#dbeafe",
  },
  requirementPillText: {
    fontWeight: "700",
    fontSize: 12,
  },
  requirementPillTextReady: {
    color: "#166534",
  },
  requirementPillTextPending: {
    color: "#92400e",
  },
  requirementPillTextOptional: {
    color: "#1d4ed8",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 5,
    color: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5d9ce",
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#e5d9ce",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  value: {
    fontSize: 16,
    color: "#1f2937",
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 10,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eadfd5",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  infoBannerText: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
  },
  cooldownBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 14,
    padding: 10,
  },
  cooldownBannerText: {
    flex: 1,
    color: "#92400e",
    fontSize: 13,
    fontWeight: "600",
  },
  reason: {
    color: "#b91c1c",
    marginBottom: 10,
    fontStyle: "italic",
    fontWeight: "600",
  },
  checklistWrap: {
    marginTop: 12,
    gap: 10,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#fff8f8",
    borderWidth: 1,
    borderColor: "#f3d1d1",
    borderRadius: 12,
    padding: 12,
  },
  checklistText: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  availabilityToggle: {
    borderRadius: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 14,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: 14,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#ececec",
    padding: 12,
  },
  summaryLabel: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    marginTop: 6,
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  coordinatesText: {
    marginTop: 10,
    color: "#4b5563",
    fontSize: 13,
  },
  editButton: {
    marginTop: 14,
  },
  locationCard: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  locationText: {
    color: "#374151",
    fontSize: 14,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  documentStack: {
    marginTop: 6,
    gap: 12,
  },
  documentPanel: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 12,
    gap: 10,
  },
  documentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  documentTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  documentHelper: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
  },
  documentStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  documentStatusBadgeReady: {
    backgroundColor: "#dcfce7",
  },
  documentStatusBadgePending: {
    backgroundColor: "#fef3c7",
  },
  documentStatusText: {
    fontWeight: "800",
    fontSize: 12,
  },
  documentStatusTextReady: {
    color: "#166534",
  },
  documentStatusTextPending: {
    color: "#92400e",
  },
  documentThumbnail: {
    width: "100%",
    height: 180,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  certificateThumbnail: {
    width: "100%",
    height: 170,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  documentPlaceholder: {
    height: 118,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  documentPlaceholderText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  documentImage: {
    width: "100%",
    height: "100%",
  },
  certificateImage: {
    width: "100%",
    height: "100%",
  },
  submitButton: {
    marginTop: 14,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  certificatePreviewImage: {
    width: 300,
    height: 420,
    marginBottom: 10,
  },
});
