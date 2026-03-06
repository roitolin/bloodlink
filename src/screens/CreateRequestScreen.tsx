import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const URGENCY_LEVELS = ["Normal", "Urgent", "Critical"];

export default function CreateRequestScreen({ navigation }: any) {
  const [patientName, setPatientName] = useState("");
  const [hospital, setHospital] = useState("");
  const [bloodType, setBloodType] = useState(BLOOD_TYPES[0]);
  const [urgency, setUrgency] = useState(URGENCY_LEVELS[0]);
  const [contactNumber, setContactNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!patientName || !hospital || !contactNumber) {
      Alert.alert("Error", "Please fill all required fields.");
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in.");

      await addDoc(collection(db, "requests"), {
        requesterId: user.uid,
        patientName,
        hospital,
        bloodTypeNeeded: bloodType,
        urgency,
        contactNumber,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Alert.alert("Success", "Blood request created successfully!");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Patient Name *</Text>
      <TextInput
        style={styles.input}
        value={patientName}
        onChangeText={setPatientName}
        placeholder="Enter patient name"
      />

      <Text style={styles.label}>Hospital *</Text>
      <TextInput
        style={styles.input}
        value={hospital}
        onChangeText={setHospital}
        placeholder="Enter hospital name"
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

      <Text style={styles.label}>Contact Number *</Text>
      <TextInput
        style={styles.input}
        value={contactNumber}
        onChangeText={setContactNumber}
        placeholder="e.g. 09123456789"
        keyboardType="phone-pad"
      />

      <Button
        title={loading ? "Creating..." : "Create Request"}
        onPress={handleSubmit}
        disabled={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 16, fontWeight: "600", marginTop: 15, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    overflow: "hidden",
  },
});