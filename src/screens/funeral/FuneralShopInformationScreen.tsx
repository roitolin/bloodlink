import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Button as PaperButton } from "react-native-paper";

export default function FuneralShopInformationScreen({ navigation, route }: any) {
  const existingDraft = route.params?.draft || {};
  const [shopName, setShopName] = useState(existingDraft.shopName || "");
  const [shopAddress, setShopAddress] = useState(existingDraft.shopAddress || "");
  const [shopPhoneNumber, setShopPhoneNumber] = useState(existingDraft.shopPhoneNumber || "");

  const handleNext = () => {
    if (!shopName.trim() || !shopAddress.trim() || !shopPhoneNumber.trim()) {
      Alert.alert("Missing fields", "Please complete Shop name, Shop address, and phone number.");
      return;
    }

    navigation.navigate("BusinessInformation", {
      draft: {
        ...existingDraft,
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        shopPhoneNumber: shopPhoneNumber.trim(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.kicker}>Step 1 of 2</Text>
            <Text style={styles.title}>Shop Information</Text>
            <Text style={styles.subtitle}>Enter the basic details customers will use to identify your funeral shop.</Text>

            <Text style={styles.label}>Shop Name *</Text>
            <TextInput style={styles.input} value={shopName} onChangeText={setShopName} placeholder="Enter shop name" />

            <Text style={styles.label}>Shop Address *</Text>
            <TextInput style={[styles.input, styles.multilineInput]} value={shopAddress} onChangeText={setShopAddress} placeholder="Enter shop address" multiline />

            <Text style={styles.label}>Phone Number *</Text>
            <TextInput style={styles.input} value={shopPhoneNumber} onChangeText={setShopPhoneNumber} placeholder="Enter phone number" keyboardType="phone-pad" />

            <PaperButton mode="contained" buttonColor="#334155" onPress={handleNext} style={styles.primaryButton}>
              Next
            </PaperButton>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 14,
  },
  kicker: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: "#475569",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 10,
  },
});
