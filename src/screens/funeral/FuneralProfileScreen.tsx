import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Card, Button as PaperButton, Chip } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, uploadProfilePicture } from "@/services";
import { useResponsive } from "@/utils/responsive";

const maleDefault = require("../../../assets/Male_Default_Profile.png");
const femaleDefault = require("../../../assets/Female_Default_Profile.png");
const otherDefault = require("../../../assets/Male_Default_Profile.png");

type ShopStatus = "none" | "pending" | "verified" | "rejected";

const calculateAge = (dob: Date | null): number | null => {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

export default function FuneralProfileScreen({ navigation }: any) {
  const { isDesktop } = useResponsive();

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [shopStatus, setShopStatus] = useState<ShopStatus>("none");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [shopInfo, setShopInfo] = useState<{ shopName?: string; shopAddress?: string; shopPhoneNumber?: string } | null>(null);
  const [businessInfo, setBusinessInfo] = useState<{ generalLocation?: string; registeredAddress?: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [startRegistrationVisible, setStartRegistrationVisible] = useState(false);

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
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      setFullName(data.fullName || "");
      setContactNumber(data.contactNumber || "");
      setGender(data.gender || null);
      setDateOfBirth(data.dateOfBirth ? new Date(data.dateOfBirth) : null);
      setPhotoURL(data.photoURL || null);
      setShopStatus((data.funeralShopStatus || "none") as ShopStatus);
      setRejectionReason(data.funeralShopRejectionReason || null);
      setShopInfo(data.funeralShopInfo || null);
      setBusinessInfo(data.funeralBusinessInfo || null);
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

  const shopStatusColor =
    shopStatus === "verified"
      ? "#15803d"
      : shopStatus === "pending"
      ? "#b45309"
      : shopStatus === "rejected"
      ? "#b91c1c"
      : "#6b7280";

  const shopActionLabel = shopStatus === "none" || shopStatus === "rejected" ? "Register Shop" : "Shop Center";

  const handlePrimaryAction = () => {
    if (shopStatus === "none" || shopStatus === "rejected") {
      setStartRegistrationVisible(true);
      return;
    }

    navigation.navigate("ShopCenter");
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.pageHeader}>
        <Card.Content>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal details and keep your funeral shop registration in its own space.</Text>
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
                <ActivityIndicator size="large" color="#334155" />
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

          <PaperButton mode="contained" buttonColor="#334155" onPress={saveBasicProfile} loading={savingProfile} disabled={savingProfile}>
            Save Profile Details
          </PaperButton>
        </Card.Content>
      </Card>

      <Card style={styles.sectionCard}>
        <Card.Content>
          <View style={styles.statusRow}>
            <Text style={styles.sectionTitle}>Shop Status</Text>
            <Chip textStyle={{ color: shopStatusColor }} style={{ backgroundColor: "#f3f4f6" }}>
              {shopStatus.toUpperCase()}
            </Chip>
          </View>

          {shopStatus === "verified" ? (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#15803d" />
                <Text style={styles.infoBannerText}>
                  Your shop registration is verified. You can manage and review your registered shop details from the shop center.
                </Text>
              </View>
              {shopInfo?.shopName ? <Text style={styles.value}>Shop Name: {shopInfo.shopName}</Text> : null}
              {shopInfo?.shopAddress ? <Text style={styles.value}>Shop Address: {shopInfo.shopAddress}</Text> : null}
              {businessInfo?.generalLocation ? <Text style={styles.value}>General Location: {businessInfo.generalLocation}</Text> : null}
            </>
          ) : null}

          {shopStatus === "pending" ? (
            <View style={styles.infoBanner}>
              <Ionicons name="hourglass-outline" size={20} color="#b45309" />
              <Text style={styles.infoBannerText}>
                Your shop registration is under review. Open the shop center to review the details you submitted.
              </Text>
            </View>
          ) : null}

          {shopStatus === "rejected" ? (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="close-circle-outline" size={20} color="#b91c1c" />
                <Text style={styles.infoBannerText}>
                  Your last shop registration was rejected. Start the registration again to submit updated business details.
                </Text>
              </View>
              {rejectionReason ? <Text style={styles.reason}>Reason: {rejectionReason}</Text> : null}
            </>
          ) : null}

          {shopStatus === "none" ? (
            <Text style={styles.infoText}>
              Ready to open a funeral shop? Start registration to enter shop details and business information.
            </Text>
          ) : null}

          <PaperButton mode="contained" buttonColor="#334155" onPress={handlePrimaryAction} style={styles.primaryButton}>
            {shopActionLabel}
          </PaperButton>
          <PaperButton mode="outlined" onPress={() => navigation.navigate("MyServiceRequests")} style={styles.utilityButton}>
            My Service Requests
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
          <PaperButton mode="contained" buttonColor="#334155" onPress={() => navigation.getParent?.()?.getParent?.()?.navigate("ServiceHub")}>
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

      <Modal visible={startRegistrationVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setStartRegistrationVisible(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity activeOpacity={1} style={styles.startRegistrationCard}>
              <Text style={styles.startRegistrationTitle}>Start Registration</Text>
              <Text style={styles.startRegistrationText}>
                Begin the funeral shop registration flow and complete your shop and business information.
              </Text>
              <PaperButton
                mode="contained"
                buttonColor="#334155"
                onPress={() => {
                  setStartRegistrationVisible(false);
                  navigation.navigate("ShopInformation");
                }}
                style={styles.primaryButton}
              >
                Start Registration
              </PaperButton>
              <PaperButton mode="text" onPress={() => setStartRegistrationVisible(false)}>
                Cancel
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
    color: "#334155",
  },
  pageSubtitle: {
    marginTop: 3,
    color: "#4b5563",
    fontSize: 14,
  },
  uidPill: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  uidPillLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
  },
  uidPillValue: {
    color: "#0f172a",
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
    borderColor: "#334155",
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
    color: "#334155",
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
  startRegistrationCard: {
    width: "100%",
    alignItems: "center",
  },
  startRegistrationTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  startRegistrationText: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 8,
  },
});
