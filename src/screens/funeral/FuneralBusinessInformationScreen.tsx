import { useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Button as PaperButton } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, uploadCertificate } from "@/services";

const VAT_OPTIONS = ["VAT Registered", "Non Registered"];

export default function FuneralBusinessInformationScreen({ navigation, route }: any) {
  const draft = route.params?.draft || {};
  const [individualRegisteredName, setIndividualRegisteredName] = useState(draft.individualRegisteredName || "");
  const [businessName, setBusinessName] = useState(draft.businessName || draft.shopName || "");
  const [generalLocation, setGeneralLocation] = useState(draft.generalLocation || "");
  const [registeredAddress, setRegisteredAddress] = useState(draft.registeredAddress || "");
  const [zipCode, setZipCode] = useState(draft.zipCode || "");
  const [tin, setTin] = useState(draft.tin || "");
  const [vatRegistrationStatus, setVatRegistrationStatus] = useState(draft.vatRegistrationStatus || VAT_OPTIONS[0]);
  const [birCertificateUrl, setBirCertificateUrl] = useState<string | null>(draft.birCertificateUrl || null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickBirCertificate = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const uploadedUrl = await uploadCertificate(result.assets[0].uri);
      setBirCertificateUrl(uploadedUrl);
      Alert.alert("Uploaded", "BIR certificate uploaded successfully.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Failed to upload BIR certificate.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (
      !draft.shopName?.trim() ||
      !draft.shopAddress?.trim() ||
      !draft.shopPhoneNumber?.trim() ||
      !individualRegisteredName.trim() ||
      !businessName.trim() ||
      !generalLocation.trim() ||
      !registeredAddress.trim() ||
      !zipCode.trim() ||
      !tin.trim() ||
      !birCertificateUrl
    ) {
      Alert.alert("Missing fields", "Please complete all required business information and upload the BIR certificate.");
      return;
    }

    setSubmitting(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          funeralShopStatus: "pending",
          funeralShopRejectionReason: null,
          funeralShopSubmittedAt: serverTimestamp(),
          funeralShopInfo: {
            shopName: draft.shopName.trim(),
            shopAddress: draft.shopAddress.trim(),
            shopPhoneNumber: draft.shopPhoneNumber.trim(),
          },
          funeralBusinessInfo: {
            individualRegisteredName: individualRegisteredName.trim(),
            businessName: businessName.trim(),
            generalLocation: generalLocation.trim(),
            registeredAddress: registeredAddress.trim(),
            zipCode: zipCode.trim(),
            tin: tin.trim(),
            vatRegistrationStatus,
            birCertificateUrl,
          },
        },
        { merge: true }
      );

      Alert.alert("Submitted", "Your shop registration has been submitted.", [
        {
          text: "OK",
          onPress: () => navigation.reset({ index: 0, routes: [{ name: "ProfileMain" }] }),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Submit failed", error?.message || "Failed to submit shop registration.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.kicker}>Step 2 of 2</Text>
            <Text style={styles.title}>Business Information</Text>
            <Text style={styles.subtitle}>Complete the registered business details before submitting your shop registration.</Text>

            <Text style={styles.label}>Individual Registered Name *</Text>
            <TextInput style={styles.input} value={individualRegisteredName} onChangeText={setIndividualRegisteredName} />

            <Text style={styles.label}>Business Name *</Text>
            <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} />

            <Text style={styles.label}>General Location *</Text>
            <TextInput style={styles.input} value={generalLocation} onChangeText={setGeneralLocation} />

            <Text style={styles.label}>Registered Address *</Text>
            <TextInput style={[styles.input, styles.multilineInput]} value={registeredAddress} onChangeText={setRegisteredAddress} multiline />

            <Text style={styles.label}>Zip Code *</Text>
            <TextInput style={styles.input} value={zipCode} onChangeText={setZipCode} keyboardType="number-pad" />

            <Text style={styles.label}>Taxpayer Identification Number (TIN) *</Text>
            <TextInput style={styles.input} value={tin} onChangeText={setTin} />

            <Text style={styles.label}>Value Added Tax Registration Status *</Text>
            <View style={styles.pickerContainer}>
              <Picker selectedValue={vatRegistrationStatus} onValueChange={(value) => setVatRegistrationStatus(value)}>
                {VAT_OPTIONS.map((option) => (
                  <Picker.Item key={option} label={option} value={option} />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>BIR Certificate of Registration *</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickBirCertificate} disabled={uploading}>
              <Ionicons name="cloud-upload-outline" size={18} color="#334155" />
              <Text style={styles.uploadButtonText}>{uploading ? "Uploading..." : "Upload Certificate"}</Text>
            </TouchableOpacity>

            {birCertificateUrl ? (
              <View style={styles.previewCard}>
                <Image source={{ uri: birCertificateUrl }} style={styles.previewImage} resizeMode="cover" />
                <Text style={styles.previewText}>BIR certificate ready</Text>
              </View>
            ) : null}

            <PaperButton mode="contained" buttonColor="#334155" onPress={handleSubmit} loading={submitting} disabled={submitting || uploading} style={styles.primaryButton}>
              Submit
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: "#f8fafc",
  },
  uploadButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  previewCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
  },
  previewText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 20,
    borderRadius: 10,
  },
});
