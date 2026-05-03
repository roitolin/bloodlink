import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Card, Button as PaperButton, Chip } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { uploadProfilePicture } from "../../services/cloudinary";
import { useResponsive } from "../../utils/responsive";

const maleDefault = require("../../../assets/Male_Default_Profile.png");
const femaleDefault = require("../../../assets/Female_Default_Profile.png");
const otherDefault = require("../../../assets/Male_Default_Profile.png");

type DonorStatus = "none" | "pending" | "verified" | "rejected";
type AvailabilityStatus = "available" | "unavailable";

const calculateAge = (dob: Date | null): number | null => {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

export default function ProfileScreen({ navigation }: any) {
  const { isDesktop } = useResponsive();

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const [bloodType, setBloodType] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [donorStatus, setDonorStatus] = useState<DonorStatus>("none");
  const [donorAvailability, setDonorAvailability] = useState<AvailabilityStatus>("unavailable");
  const [donationCooldownUntil, setDonationCooldownUntil] = useState<Date | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const age = calculateAge(dateOfBirth);

  const getDefaultImage = () => {
    if (gender === "male") return maleDefault;
    if (gender === "female") return femaleDefault;
    return otherDefault;
  };

  const loadProfile = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      setFullName(data.fullName || "");
      setContactNumber(data.contactNumber || "");
      setGender(data.gender || null);
      setDateOfBirth(data.dateOfBirth ? new Date(data.dateOfBirth) : null);
      setPhotoURL(data.photoURL || null);
      setBloodType(data.bloodType || "");
      setCity(data.city || "");
      setStreet(data.street || "");
      setDonorStatus((data.donorStatus || "none") as DonorStatus);
      setDonorAvailability((data.availabilityStatus || "unavailable") as AvailabilityStatus);
      setRejectionReason(data.donorVerificationRejectionReason || null);

      const cooldownDate = data?.donationCooldownUntil?.toDate
        ? data.donationCooldownUntil.toDate()
        : data?.donationCooldownUntil
        ? new Date(data.donationCooldownUntil)
        : null;
      setDonationCooldownUntil(cooldownDate && !Number.isNaN(cooldownDate.getTime()) ? cooldownDate : null);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load profile.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const saveBasicProfile = async () => {
    if (!fullName.trim() || !contactNumber.trim() || !gender || !dateOfBirth) {
      Alert.alert("Missing fields", "Please complete Full Name, Contact Number, Gender, and Date of Birth.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSavingProfile(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: fullName.trim(),
          contactNumber: contactNumber.trim(),
          gender,
          dateOfBirth: dateOfBirth.toISOString(),
        },
        { merge: true }
      );
      Alert.alert("Saved", "Your profile details were updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadProfilePic = async (uri: string) => {
    setUploading(true);
    try {
      const downloadURL = await uploadProfilePicture(uri);
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      await setDoc(doc(db, "users", user.uid), { photoURL: downloadURL }, { merge: true });
      setPhotoURL(downloadURL);
      Alert.alert("Success", "Profile picture updated.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Failed to upload profile photo.");
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePic(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePic(result.assets[0].uri);
    }
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDateOfBirth(selectedDate);
  };

  const donorStatusColor =
    donorStatus === "verified"
      ? "#15803d"
      : donorStatus === "pending"
      ? "#b45309"
      : donorStatus === "rejected"
      ? "#b91c1c"
      : "#6b7280";

  const donorActionLabel =
    donorStatus === "verified"
      ? "Manage Donor Profile"
      : donorStatus === "pending"
      ? "View Donor Application"
      : donorStatus === "rejected"
      ? "Apply Again as Donor"
      : "Apply to Be a Donor";

  const donorLocationLabel = [street, city].filter(Boolean).join(", ");

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.pageHeader}>
        <Card.Content>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal details and keep your donor application in its own space.</Text>
          <View style={styles.uidPill}>
            <Text style={styles.uidPillLabel}>Your UID</Text>
            <Text selectable style={styles.uidPillValue}>{auth.currentUser?.uid || "Unknown"}</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.photoSection}>
            <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.photoContainer}>
              {uploading ? (
                <ActivityIndicator size="large" color="#d32f2f" />
              ) : photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.photo} resizeMode="cover" />
              ) : (
                <Image source={getDefaultImage()} style={styles.photo} resizeMode="cover" />
              )}
            </TouchableOpacity>
            <View style={styles.photoActions}>
              <PaperButton mode="outlined" onPress={pickImage} disabled={uploading}>Gallery</PaperButton>
              <PaperButton mode="outlined" onPress={takePhoto} disabled={uploading}>Camera</PaperButton>
            </View>
          </View>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

          <Text style={styles.label}>Contact Number *</Text>
          <TextInput style={styles.input} value={contactNumber} onChangeText={setContactNumber} keyboardType="phone-pad" />

          <Text style={styles.label}>Gender *</Text>
          <View style={styles.pickerContainer}>
            <Picker selectedValue={gender} onValueChange={(value) => setGender(value)}>
              <Picker.Item label="Select gender..." value={null} />
              <Picker.Item label="Male" value="male" />
              <Picker.Item label="Female" value="female" />
              <Picker.Item label="Other" value="other" />
            </Picker>
          </View>

          <Text style={styles.label}>Date of Birth *</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateButton}>
            <Text>{dateOfBirth ? dateOfBirth.toLocaleDateString() : "Select date"}</Text>
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={dateOfBirth || new Date()}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          ) : null}

          <Text style={styles.label}>Age</Text>
          <View style={styles.ageDisplay}>
            <Text style={styles.ageText}>{age !== null ? `${age} years old` : "Not available"}</Text>
          </View>

          <PaperButton mode="contained" onPress={saveBasicProfile} loading={savingProfile} disabled={savingProfile}>
            Save Profile Details
          </PaperButton>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.statusRow}>
            <Text style={styles.sectionTitle}>Donor Status</Text>
            <Chip textStyle={{ color: donorStatusColor }} style={{ backgroundColor: "#f3f4f6" }}>
              {donorStatus.toUpperCase()}
            </Chip>
          </View>

          {donorStatus === "verified" ? (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#15803d" />
                <Text style={styles.infoBannerText}>
                  Your donor account is verified. Manage donor details, location pin, certificate, and availability from the dedicated donor page.
                </Text>
              </View>
              {donationCooldownUntil && donationCooldownUntil.getTime() > Date.now() ? (
                <View style={styles.cooldownBanner}>
                  <Ionicons name="time-outline" size={18} color="#92400e" />
                  <Text style={styles.cooldownBannerText}>
                    Cooldown active until {donationCooldownUntil.toLocaleString()}.
                  </Text>
                </View>
              ) : null}
              <Text style={styles.value}>Availability: {donorAvailability === "available" ? "ON - Available to Donate" : "OFF - Unavailable"}</Text>
              {bloodType ? <Text style={styles.value}>Blood Type: {bloodType}</Text> : null}
              {donorLocationLabel ? <Text style={styles.value}>Location: {donorLocationLabel}</Text> : null}
            </>
          ) : null}

          {donorStatus === "pending" ? (
            <View style={styles.infoBanner}>
              <Ionicons name="hourglass-outline" size={20} color="#b45309" />
              <Text style={styles.infoBannerText}>
                Your donor verification request is under review. You can open the donor page to check the details you submitted.
              </Text>
            </View>
          ) : null}

          {donorStatus === "rejected" ? (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="close-circle-outline" size={20} color="#b91c1c" />
                <Text style={styles.infoBannerText}>
                  Your last donor application was rejected. Open the donor page to review the reason and apply again.
                </Text>
              </View>
              {rejectionReason ? <Text style={styles.reason}>Reason: {rejectionReason}</Text> : null}
            </>
          ) : null}

          {donorStatus === "none" ? (
            <Text style={styles.infoText}>
              Ready to become a donor? Your donor application now lives on its own page so this profile screen stays simple.
            </Text>
          ) : null}

          <PaperButton mode="contained" onPress={() => navigation.navigate("DonorApplication")} style={styles.primaryButton}>
            {donorActionLabel}
          </PaperButton>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <PaperButton mode="outlined" onPress={() => navigation.navigate("Contact")} style={styles.utilityButton}>
            Contact Support
          </PaperButton>
          <PaperButton mode="outlined" onPress={() => navigation.navigate("AboutUs")} style={styles.utilityButton}>
            About Us
          </PaperButton>
          <PaperButton mode="outlined" onPress={() => navigation.navigate("AppFeedback")} style={styles.utilityButton}>
            Rate & Feedback
          </PaperButton>
          <PaperButton mode="outlined" onPress={() => navigation.navigate("DonationHistory")} style={styles.utilityButton}>
            Donation History & Certificates
          </PaperButton>
          <PaperButton
            mode="contained"
            buttonColor="#b91c1c"
            onPress={() => navigation.getParent?.()?.getParent?.()?.navigate("ServiceHub")}
          >
            Exit
          </PaperButton>
        </Card.Content>
      </Card>

      <Modal visible={previewVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPreviewVisible(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity activeOpacity={1}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.previewImage} resizeMode="contain" />
              ) : (
                <Image source={getDefaultImage()} style={styles.previewImage} resizeMode="contain" />
              )}
              <PaperButton mode="contained-tonal" onPress={() => setPreviewVisible(false)}>
                Close
              </PaperButton>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 36,
    backgroundColor: "#f3f4f6",
    gap: 10,
  },
  containerDesktop: {
    maxWidth: 980,
    alignSelf: "center",
    width: "100%",
  },
  pageHeader: {
    borderRadius: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#b91c1c",
  },
  pageSubtitle: {
    marginTop: 3,
    color: "#4b5563",
    fontSize: 14,
  },
  uidPill: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 999,
    backgroundColor: "#f5f3ff",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  uidPillLabel: {
    color: "#5b21b6",
    fontSize: 11,
    fontWeight: "700",
  },
  uidPillValue: {
    color: "#312e81",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1,
  },
  sectionCard: {
    borderRadius: 12,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  photoContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#d32f2f",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
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
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  ageDisplay: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
    marginBottom: 10,
  },
  ageText: {
    fontSize: 15,
    color: "#374151",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#b91c1c",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fafafa",
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
    borderRadius: 8,
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
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 10,
  },
  utilityButton: {
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  modalContent: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  previewImage: {
    width: 300,
    height: 300,
    borderRadius: 10,
    marginBottom: 10,
  },
});
