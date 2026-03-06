import { useState, useEffect } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CITIES = ["Manila", "Quezon City", "Makati", "Taguig", "Pasig", "Cebu", "Davao"];
const BARANGAYS = ["Barangay 1", "Barangay 2", "Barangay 3", "Barangay 4", "Barangay 5"];

export default function ProfileScreen() {
  const [fullName, setFullName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [bloodType, setBloodType] = useState(BLOOD_TYPES[0]);
  const [city, setCity] = useState(CITIES[0]);
  const [barangay, setBarangay] = useState(BARANGAYS[0]);
  const [availability, setAvailability] = useState<"available" | "unavailable">("available");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFullName(data.fullName || "");
          setContactNumber(data.contactNumber || "");
          setBloodType(data.bloodType || BLOOD_TYPES[0]);
          setCity(data.city || CITIES[0]);
          setBarangay(data.barangay || BARANGAYS[0]);
          setAvailability(data.availabilityStatus || "available");
        }
      } catch (error) {
        console.error("Error loading profile:", error);
        Alert.alert("Error", "Failed to load profile.");
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim() || !contactNumber.trim()) {
      Alert.alert("Error", "Please fill in your name and contact number.");
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");
      await setDoc(
        doc(db, "users", user.uid),
        {
          fullName: fullName.trim(),
          contactNumber: contactNumber.trim(),
          bloodType,
          city,
          barangay,
          availabilityStatus: availability,
          updatedAt: new Date(),
        },
        { merge: true }
      );
      Alert.alert("Success", "Profile saved!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Full Name *</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

      <Text style={styles.label}>Contact Number *</Text>
      <TextInput style={styles.input} value={contactNumber} onChangeText={setContactNumber} keyboardType="phone-pad" />

      <Text style={styles.sectionTitle}>Donor Information (Optional)</Text>
      <Text style={styles.label}>Blood Type</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={bloodType} onValueChange={setBloodType}>
          {BLOOD_TYPES.map(type => <Picker.Item key={type} label={type} value={type} />)}
        </Picker>
      </View>

      <Text style={styles.label}>City</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={city} onValueChange={setCity}>
          {CITIES.map(c => <Picker.Item key={c} label={c} value={c} />)}
        </Picker>
      </View>

      <Text style={styles.label}>Barangay</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={barangay} onValueChange={setBarangay}>
          {BARANGAYS.map(b => <Picker.Item key={b} label={b} value={b} />)}
        </Picker>
      </View>

      <Text style={styles.label}>Availability as Donor</Text>
      <View style={styles.pickerContainer}>
        <Picker selectedValue={availability} onValueChange={setAvailability}>
          <Picker.Item label="Available" value="available" />
          <Picker.Item label="Not Available" value="unavailable" />
        </Picker>
      </View>

      <Button title={loading ? "Saving..." : "Save Profile"} onPress={handleSave} disabled={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: "600", marginTop: 15, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 },
  pickerContainer: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, overflow: "hidden" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginTop: 25, marginBottom: 10 },
});