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
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Card, Button as PaperButton } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebaseConfig";
import { uploadProfilePicture } from "@/services/cloudinary";

const maleDefault = require("../../../assets/Male_Default_Profile.png");
const femaleDefault = require("../../../assets/Female_Default_Profile.png");
const otherDefault = require("../../../assets/Male_Default_Profile.png");

export default function AccountSettingsScreen({ navigation }: any) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const getDefaultImage = () => {
    if (gender === "male") return maleDefault;
    if (gender === "female") return femaleDefault;
    return otherDefault;
  };

  const loadAccount = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snapshot = await getDoc(doc(db, "users", user.uid));
      if (!snapshot.exists()) return;

      const data = snapshot.data();
      setFullName(String(data.fullName || ""));
      setEmail(String(data.email || user.email || ""));
      setGender((data.gender as "male" | "female" | "other" | null) || null);
      setDateOfBirth(data.dateOfBirth ? new Date(data.dateOfBirth) : null);
      setPhotoURL(data.photoURL || null);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load account information.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAccount();
    }, [loadAccount])
  );

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!fullName.trim() || !gender || !dateOfBirth) {
      Alert.alert("Missing Fields", "Please complete full name, gender, and date of birth.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: fullName.trim(),
          gender,
          dateOfBirth: dateOfBirth.toISOString(),
          photoURL: photoURL || null,
        },
        { merge: true }
      );
      Alert.alert("Saved", "Your account information was updated.");
    } catch (error: any) {
      Alert.alert("Save Failed", error?.message || "Unable to save your account information.");
    } finally {
      setSaving(false);
    }
  };

  const uploadProfilePic = async (uri: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setUploading(true);
    try {
      const downloadURL = await uploadProfilePicture(uri);
      await setDoc(doc(db, "users", user.uid), { photoURL: downloadURL }, { merge: true });
      setPhotoURL(downloadURL);
      Alert.alert("Success", "Profile picture updated.");
    } catch (error: any) {
      Alert.alert("Upload Failed", error?.message || "Failed to upload profile photo.");
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
      Alert.alert("Permission Needed", "Camera permission is required.");
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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.headerCard}>
          <Card.Content>
            <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color="#92400e" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.kicker}>Account Settings</Text>
            <Text style={styles.title}>Account Information</Text>
            <Text style={styles.subtitle}>Update the information from your registration and manage your profile photo.</Text>
          </Card.Content>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.photoSection}>
              <TouchableOpacity onPress={() => setPreviewVisible(true)} style={styles.photoContainer}>
                {uploading ? (
                  <ActivityIndicator size="large" color="#d97706" />
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

            <Text style={styles.label}>Email</Text>
            <TextInput style={[styles.input, styles.readOnlyInput]} value={email} editable={false} />

            <Text style={styles.label}>Full Name *</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

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
              <Text style={styles.dateText}>{dateOfBirth ? dateOfBirth.toLocaleDateString() : "Select date"}</Text>
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

            <PaperButton
              mode="contained"
              buttonColor="#d97706"
              onPress={handleSave}
              loading={saving}
              disabled={saving || uploading}
              style={styles.saveButton}
            >
              Save Account Details
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fffaf7",
  },
  content: {
    padding: 20,
    paddingBottom: 28,
    gap: 14,
  },
  headerCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  backText: {
    color: "#92400e",
    fontWeight: "700",
  },
  kicker: {
    color: "#c2410c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#111827",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 22,
  },
  sectionCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  photoSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  photoContainer: {
    width: 118,
    height: 118,
    borderRadius: 59,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#d97706",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff7ed",
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
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  readOnlyInput: {
    backgroundColor: "#f9fafb",
    color: "#6b7280",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  dateText: {
    color: "#111827",
    fontSize: 15,
  },
  saveButton: {
    marginTop: 18,
    borderRadius: 999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    width: "100%",
    maxWidth: 420,
  },
  previewImage: {
    width: 300,
    height: 300,
    borderRadius: 12,
    marginBottom: 10,
  },
});
