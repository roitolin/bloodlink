import { useState } from "react";
import { View, Text, FlatList, TextInput, Button, Alert, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { collection, query, where, getDocs, QueryConstraint } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

// Define the Donor type based on the fields stored in Firestore
interface Donor {
  id: string;
  fullName?: string;
  bloodType?: string;
  city?: string;
  barangay?: string;
  contactNumber?: string;
  availabilityStatus?: string;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function SearchDonorsScreen() {
  const [selectedBloodType, setSelectedBloodType] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const searchDonors = async () => {
    if (!selectedBloodType && !city) {
      Alert.alert("Info", "Select blood type or enter city.");
      return;
    }
    setLoading(true);
    try {
      const conditions: QueryConstraint[] = [
        where("bloodType", "!=", null),
        where("availabilityStatus", "==", "available")
      ];
      if (selectedBloodType) {
        conditions.push(where("bloodType", "==", selectedBloodType));
      }
      if (city) {
        conditions.push(where("city", "==", city));
      }

      const q = query(collection(db, "users"), ...conditions);
      const snapshot = await getDocs(q);
      const list: Donor[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Donor[];
      setDonors(list);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const renderDonor = ({ item }: { item: Donor }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.fullName || "Anonymous"}</Text>
      <Text>Blood Type: {item.bloodType}</Text>
      <Text>Location: {item.city}, {item.barangay}</Text>
      <Text>Contact: {item.contactNumber}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Blood Type</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedBloodType}
          onValueChange={(itemValue) => setSelectedBloodType(itemValue)}
        >
          <Picker.Item label="Any" value="" />
          {BLOOD_TYPES.map(type => <Picker.Item key={type} label={type} value={type} />)}
        </Picker>
      </View>

      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder="e.g. Manila"
      />

      <Button
        title={loading ? "Searching..." : "Search Donors"}
        onPress={searchDonors}
        disabled={loading}
      />

      <FlatList
        data={donors}
        keyExtractor={item => item.id}
        renderItem={renderDonor}
        ListEmptyComponent={<Text style={styles.empty}>No donors found</Text>}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontSize: 16, marginTop: 10 },
  pickerContainer: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 15 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 15 },
  card: { padding: 15, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, marginBottom: 10 },
  name: { fontSize: 18, fontWeight: "bold" },
  empty: { textAlign: "center", marginTop: 50, fontSize: 16 },
});