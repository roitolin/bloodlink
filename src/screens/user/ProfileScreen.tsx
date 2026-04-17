import { useEffect, useState } from "react";
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
import { Card, Button as PaperButton, Chip } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { uploadProfilePicture, uploadCertificate } from "../../services/cloudinary";
import { useResponsive } from "../../utils/responsive";
import { createAdminNotification } from "../../utils/createAdminNotification";
import { syncPublicCityAvailability } from "../../utils/publicCityAvailability";
import { useAppDialog } from "../../hooks/useAppDialog";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const maleDefault = require("../../../assets/Male_Default_Profile.png");
const femaleDefault = require("../../../assets/Female_Default_Profile.png");
const otherDefault = require("../../../assets/Male_Default_Profile.png");

type DonorStatus = "none" | "pending" | "verified" | "rejected";
type AvailabilityStatus = "available" | "unavailable";

const calculateAge = (dob: Date | null): number | null => {
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

export default function ProfileScreen({ navigation, route }: any) {
  const { logout } = useAuth();

  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [certificateURL, setCertificateURL] = useState<string | null>(null);

  const [donorStatus, setDonorStatus] = useState<DonorStatus>("none");
  const [donorAvailability, setDonorAvailability] = useState<AvailabilityStatus>("unavailable");
  const [donationCooldownUntil, setDonationCooldownUntil] = useState<Date | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [editingVerifiedDonor, setEditingVerifiedDonor] = useState(false);

  const [bloodType, setBloodType] = useState(BLOOD_TYPES[0]);
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDonor, setSavingDonor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [certificatePreviewVisible, setCertificatePreviewVisible] = useState(false);

  const age = calculateAge(dateOfBirth);
  const { isDesktop } = useResponsive();
  const { showDialog, dialog } = useAppDialog();

  const getDefaultImage = () => {
    if (gender === "male") return maleDefault;
    if (gender === "female") return femaleDefault;
    return otherDefault;
  };

  useEffect(() => {
    const loadProfile = async () => {
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
        setCertificateURL(data.medicalCertificateURL || null);
        setDonorStatus((data.donorStatus || "none") as DonorStatus);
        setRejectionReason(data.donorVerificationRejectionReason || null);
        setBloodType(data.bloodType || BLOOD_TYPES[0]);
        setCity(data.city || "");
        setStreet(data.street || "");
        if (typeof data.location?.latitude === "number" && typeof data.location?.longitude === "number") {
          setSelectedLocation({
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          });
        }
        setDonorAvailability((data.availabilityStatus || "unavailable") as AvailabilityStatus);
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
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const locationFromMap = route.params?.selectedLocation;
    const selectedAddress = route.params?.selectedAddress;

    if (locationFromMap) {
      setSelectedLocation(locationFromMap);
    }

    if (selectedAddress) {
      const autoCity = selectedAddress.city || selectedAddress.subregion || "";
      const autoStreet = [selectedAddress.streetNumber, selectedAddress.street].filter(Boolean).join(" ").trim();

      if (autoCity) setCity(autoCity);
      if (autoStreet) setStreet(autoStreet);
    }
  }, [route.params?.fromMapPicker, route.params?.selectedLocation, route.params?.selectedAddress]);

  useEffect(() => {
    const persistLocationFromMap = async () => {
      const user = auth.currentUser;
      const locationFromMap = route.params?.selectedLocation;
      const selectedAddress = route.params?.selectedAddress;

      if (!user || !locationFromMap || !route.params?.fromMapPicker) return;

      const payload: Record<string, any> = {
        location: locationFromMap,
      };

      const autoCity = selectedAddress?.city || selectedAddress?.subregion || "";
      const autoStreet = [selectedAddress?.streetNumber, selectedAddress?.street].filter(Boolean).join(" ").trim();

      if (autoCity) payload.city = autoCity;
      if (autoStreet) payload.street = autoStreet;

      try {
        await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      } catch (error) {
        console.error("Failed to persist map location:", error);
      }
    };

    persistLocationFromMap();
  }, [route.params?.fromMapPicker, route.params?.selectedLocation, route.params?.selectedAddress]);

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
      Alert.alert("Error", error?.message || "Failed to update donor status.");
    } finally {
      setSavingDonor(false);
    }
  };

  const saveVerifiedDonorDetails = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!bloodType || !city.trim() || !selectedLocation) {
      Alert.alert("Missing fields", "Please complete blood type, city, and map pin.");
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
          location: selectedLocation,
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadProfilePic(result.assets[0].uri);
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

  const pickCertificate = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadCert(result.assets[0].uri);
    }
  };

  const uploadCert = async (uri: string) => {
    setUploadingCert(true);
    try {
      const downloadURL = await uploadCertificate(uri);
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      await setDoc(doc(db, "users", user.uid), { medicalCertificateURL: downloadURL }, { merge: true });
      setCertificateURL(downloadURL);
      Alert.alert("Success", "Medical certificate uploaded.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Failed to upload certificate.");
    } finally {
      setUploadingCert(false);
    }
  };

  const submitVerificationRequest = async () => {
    if (!certificateURL) {
      Alert.alert("Error", "Please upload a medical certificate.");
      return;
    }

    if (!bloodType || !city.trim() || !selectedLocation) {
      Alert.alert("Error", "Please complete blood type, city, and map pin.");
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
          location: selectedLocation,
          medicalCertificateURL: certificateURL,
          donorStatus: "pending",
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
      Alert.alert("Submitted", "Your donor verification request has been sent to admin.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to submit verification request.");
    } finally {
      setSavingDonor(false);
    }
  };

  const handleLogout = () => {
    showDialog({
      title: "Log Out of BloodLink?",
      message: "You’ll be signed out of your account on this device.",
      tone: "warning",
      actions: [
        { label: "Cancel", mode: "text" },
        {
          label: "Log Out",
          mode: "contained",
          onPress: async () => {
            try {
              await logout();
            } catch (error: any) {
              showDialog({
                title: "Logout Failed",
                message: error?.message || "Failed to log out.",
                tone: "danger",
              });
            }
          },
        },
      ],
    });
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDateOfBirth(selectedDate);
  };

  const donorStatusColor =
    donorStatus === "verified" ? "#15803d" : donorStatus === "pending" ? "#b45309" : donorStatus === "rejected" ? "#b91c1c" : "#6b7280";

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.pageHeader}>
        <Card.Content>
          <Text style={styles.pageTitle}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal details and donor status in one place.</Text>
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
          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth || new Date()}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

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
            <Chip textStyle={{ color: donorStatusColor }} style={{ backgroundColor: "#f3f4f6" }}>{donorStatus.toUpperCase()}</Chip>
          </View>

          {donorStatus === "verified" && (
            <>
              {donationCooldownUntil && donationCooldownUntil.getTime() > Date.now() && (
                <View style={styles.cooldownBanner}>
                  <Ionicons name="time-outline" size={18} color="#92400e" />
                  <Text style={styles.cooldownBannerText}>
                    Cooldown active until {donationCooldownUntil.toLocaleString()}.
                    You will be hidden from donor search until safe to donate again.
                  </Text>
                </View>
              )}
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
                  <Text style={styles.value}>Blood Type: {bloodType}</Text>
                  <Text style={styles.value}>Location: {city}{street ? `, ${street}` : ""}</Text>
                  {selectedLocation && (
                    <Text style={styles.value}>
                      Coordinates: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                    </Text>
                  )}
                  <PaperButton mode="contained-tonal" onPress={() => setEditingVerifiedDonor(true)}>
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

                  <Text style={styles.label}>City</Text>
                  <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Manila" />

                  <Text style={styles.label}>Street / Landmark</Text>
                  <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Optional" />

                  <Text style={styles.label}>Location</Text>
                  <View style={styles.locationCard}>
                    <Text style={styles.locationText}>
                      {selectedLocation
                        ? `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                        : "No map pin selected yet."}
                    </Text>
                    <PaperButton
                      mode="outlined"
                      onPress={() =>
                        navigation.navigate("MapLocationPicker", {
                          returnScreen: "ProfileMain",
                          initialLocation: selectedLocation,
                        })
                      }
                    >
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
            </>
          )}

          {donorStatus === "pending" && (
            <View style={styles.infoBanner}>
              <Ionicons name="hourglass-outline" size={20} color="#b45309" />
              <Text style={styles.infoBannerText}>Your donor verification is under review by admin.</Text>
            </View>
          )}

          {donorStatus === "rejected" && (
            <>
              <View style={styles.infoBanner}>
                <Ionicons name="close-circle-outline" size={20} color="#b91c1c" />
                <Text style={styles.infoBannerText}>Verification rejected. You can update details and re-apply.</Text>
              </View>
              {rejectionReason ? <Text style={styles.reason}>Reason: {rejectionReason}</Text> : null}
              <PaperButton mode="contained-tonal" onPress={() => setDonorStatus("none")}>Re-apply</PaperButton>
            </>
          )}

          {(donorStatus === "none" || donorStatus === "rejected") && (
            <>
              <Text style={styles.infoText}>Fill your donor details and upload a medical certificate to apply.</Text>

              <Text style={styles.label}>Blood Type *</Text>
              <View style={styles.pickerContainer}>
                <Picker selectedValue={bloodType} onValueChange={setBloodType}>
                  {BLOOD_TYPES.map((type) => (
                    <Picker.Item key={type} label={type} value={type} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Manila" />

              <Text style={styles.label}>Street / Landmark</Text>
              <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Optional" />

              <Text style={styles.label}>Location *</Text>
              <View style={styles.locationCard}>
                <Text style={styles.locationText}>
                  {selectedLocation
                    ? `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`
                    : "No map pin selected yet."}
                </Text>
                <PaperButton
                  mode="outlined"
                  onPress={() =>
                    navigation.navigate("MapLocationPicker", {
                      returnScreen: "ProfileMain",
                      initialLocation: selectedLocation,
                    })
                  }
                >
                  {selectedLocation ? "Update Pin on Map" : "Set Location on Map"}
                </PaperButton>
              </View>

              <Text style={styles.label}>Medical Certificate *</Text>
              <View style={styles.certificateSection}>
                {certificateURL ? (
                  <>
                    <TouchableOpacity onPress={() => setCertificatePreviewVisible(true)} style={styles.certificateThumbnail}>
                      <Image source={{ uri: certificateURL }} style={styles.certificateImage} resizeMode="contain" />
                    </TouchableOpacity>
                    <PaperButton mode="outlined" onPress={pickCertificate} disabled={uploadingCert}>
                      Replace Certificate
                    </PaperButton>
                  </>
                ) : (
                  <PaperButton mode="outlined" onPress={pickCertificate} disabled={uploadingCert} loading={uploadingCert}>
                    Upload Certificate
                  </PaperButton>
                )}
              </View>

              <PaperButton
                mode="contained"
                onPress={submitVerificationRequest}
                loading={savingDonor}
                disabled={savingDonor || !certificateURL || !bloodType || !city || !selectedLocation}
              >
                Submit for Verification
              </PaperButton>
            </>
          )}
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
          <PaperButton mode="outlined" onPress={() => navigation.navigate("ReportCenter")} style={styles.utilityButton}>
            Report Center
          </PaperButton>
          <PaperButton mode="contained" buttonColor="#b91c1c" onPress={handleLogout}>
            Logout
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
              <PaperButton mode="contained-tonal" onPress={() => setPreviewVisible(false)}>Close</PaperButton>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={certificatePreviewVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCertificatePreviewVisible(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity activeOpacity={1}>
              {certificateURL ? <Image source={{ uri: certificateURL }} style={styles.certificatePreviewImage} resizeMode="contain" /> : null}
              <PaperButton mode="contained-tonal" onPress={() => setCertificatePreviewVisible(false)}>Close</PaperButton>
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
  availabilityToggle: {
    borderRadius: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 12,
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
  locationCard: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 10,
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
  },
  certificateSection: {
    marginTop: 4,
    marginBottom: 12,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    gap: 8,
  },
  certificateThumbnail: {
    width: "100%",
    height: 150,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    overflow: "hidden",
  },
  certificateImage: {
    width: "100%",
    height: "100%",
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
  certificatePreviewImage: {
    width: 300,
    height: 420,
    marginBottom: 10,
  },
});



