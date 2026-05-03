import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, uploadCertificate } from "@/services";
import { FuneralCartItem, removeFuneralCartItem } from "@/utils/funeralCart";

type CheckoutSuccessState = {
  requestId: string;
  shopName: string;
};

const calculateAge = (dateOfBirth: Date | null): number | null => {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = today.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : 0;
};

const formatDateLabel = (value: Date | null) => {
  if (!value) return "Select date of birth";
  return value.toLocaleDateString();
};

export default function FuneralCheckoutScreen({ navigation, route }: any) {
  const cartItem = (route?.params?.cartItem || null) as FuneralCartItem | null;

  const [memorialPhotoUrl, setMemorialPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deceasedFullName, setDeceasedFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tributeMessage, setTributeMessage] = useState("");
  const [familyCoordinatorName, setFamilyCoordinatorName] = useState("");
  const [wakeAddress, setWakeAddress] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [shopContactNumber, setShopContactNumber] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState<CheckoutSuccessState | null>(null);

  const age = useMemo(() => calculateAge(dateOfBirth), [dateOfBirth]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: "Service Request",
    });
  }, [navigation]);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) return;
        const data = userSnap.data();
        setFamilyCoordinatorName(String(data.fullName || ""));
        setContactNumber(String(data.contactNumber || ""));

        if (cartItem?.shopId) {
          const shopSnap = await getDoc(doc(db, "users", cartItem.shopId));
          if (shopSnap.exists()) {
            const shopData = shopSnap.data() || {};
            const shopInfo = shopData.funeralShopInfo || {};
            setShopContactNumber(String(shopInfo.shopPhoneNumber || ""));
            setShopAddress(String(shopInfo.shopAddress || ""));
          }
        }
      } catch {
        // Ignore profile prefill failure and allow manual entry.
      }
    };

    void loadProfile();
  }, [cartItem?.shopId]);

  const uploadMemorialPhoto = useCallback(async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const url = await uploadCertificate(uri);
      setMemorialPhotoUrl(url);
      Alert.alert("Uploaded", "Memorial photo added.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Failed to upload memorial photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const pickMemorialPhoto = useCallback(async () => {
    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });

    if (!picker.canceled && picker.assets[0]) {
      await uploadMemorialPhoto(picker.assets[0].uri);
    }
  }, [uploadMemorialPhoto]);

  const onDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS !== "ios") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDateOfBirth(selectedDate);
    }
  };

  const submitRequest = useCallback(async () => {
    if (!cartItem) {
      Alert.alert("Unavailable", "Selected cart item is missing.");
      navigation.goBack();
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Login Required", "You need to be logged in to continue.");
      return;
    }

    const safeDeceasedFullName = deceasedFullName.trim();
    const safeTributeMessage = tributeMessage.trim();
    const safeFamilyCoordinatorName = familyCoordinatorName.trim();
    const safeWakeAddress = wakeAddress.trim();
    const safePickupAddress = pickupAddress.trim();
    const safeContactNumber = contactNumber.trim();

    if (
      !memorialPhotoUrl ||
      !safeDeceasedFullName ||
      !dateOfBirth ||
      !safeTributeMessage ||
      !safeFamilyCoordinatorName ||
      !safeWakeAddress ||
      !safePickupAddress ||
      !safeContactNumber
    ) {
      Alert.alert("Incomplete", "Please complete all required details before sending your request.");
      return;
    }

    setSubmitting(true);
    try {
      const requestRef = await addDoc(collection(db, "funeral_service_requests"), {
        requesterId: user.uid,
        shopId: cartItem.shopId,
        shopName: cartItem.shopName,
        shopContactNumber: shopContactNumber || null,
        shopAddress: shopAddress || null,
        cartId: cartItem.cartId,
        productId: cartItem.productId,
        productName: cartItem.name,
        productPrice: cartItem.price,
        productImageUrl: cartItem.imageUrl || null,
        variationName: cartItem.variationName || null,
        memorialPhotoUrl,
        deceasedFullName: safeDeceasedFullName,
        deceasedDateOfBirth: dateOfBirth.toISOString(),
        deceasedAge: age,
        tributeMessage: safeTributeMessage,
        familyCoordinatorName: safeFamilyCoordinatorName,
        wakeAddress: safeWakeAddress,
        pickupAddress: safePickupAddress,
        contactNumber: safeContactNumber,
        status: "pending_shop_acceptance",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "notifications"), {
        userId: cartItem.shopId,
        type: "funeral_request_pending",
        title: "New Funeral Service Request",
        body: `${safeFamilyCoordinatorName} sent a service request for ${safeDeceasedFullName}.`,
        data: {
          requestId: requestRef.id,
          requesterId: user.uid,
          shopId: cartItem.shopId,
          productId: cartItem.productId,
        },
        read: false,
        createdAt: serverTimestamp(),
      });

      await removeFuneralCartItem(cartItem.cartId);
      setSuccessState({
        requestId: requestRef.id,
        shopName: cartItem.shopName,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to send your service request.");
    } finally {
      setSubmitting(false);
    }
  }, [
    age,
    cartItem,
    contactNumber,
    dateOfBirth,
    deceasedFullName,
    familyCoordinatorName,
    memorialPhotoUrl,
    navigation,
    pickupAddress,
    shopAddress,
    shopContactNumber,
    tributeMessage,
    wakeAddress,
  ]);

  const confirmSubmitRequest = useCallback(() => {
    Alert.alert(
      "Confirm Request",
      "Are you sure you want to send this service request?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send Request", onPress: () => void submitRequest() },
      ]
    );
  }, [submitRequest]);

  if (!cartItem) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No cart item selected</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (successState) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="time-outline" size={34} color="#92400e" />
          </View>
          <Text style={styles.successTitle}>Request Sent</Text>
          <Text style={styles.successText}>
            Your service request has been forwarded to {successState.shopName}. Please wait while the shop reviews and accepts your request.
          </Text>
          <Text style={styles.condolenceText}>Our heartfelt condolences are with you and your family during this difficult time.</Text>
          <Text style={styles.successMeta}>Reference: {successState.requestId}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("FuneralTabs", { screen: "Profile", params: { screen: "MyServiceRequests" } })}
          >
            <Text style={styles.primaryButtonText}>Track My Request</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("FuneralTabs", { screen: "Carts" })}
          >
            <Text style={styles.secondaryButtonText}>Back to Cart</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          {cartItem.imageUrl ? (
            <Image source={{ uri: cartItem.imageUrl }} style={styles.summaryImage} resizeMode="cover" />
          ) : (
            <View style={styles.summaryFallback}>
              <Ionicons name="cube-outline" size={28} color="#475569" />
            </View>
          )}

          <View style={styles.summaryBody}>
            <Text style={styles.summaryName}>{cartItem.name}</Text>
            <Text style={styles.summaryShop}>{cartItem.shopName}</Text>
            {cartItem.variationName ? <Text style={styles.summaryVariation}>Option: {cartItem.variationName}</Text> : null}
            <Text style={styles.summaryNote}>Fill out the request details below so the shop can review the arrangement.</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Photo of Your Loved One for Display</Text>
          <TouchableOpacity style={styles.photoPicker} onPress={() => void pickMemorialPhoto()} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color="#171717" />
            ) : memorialPhotoUrl ? (
              <Image source={{ uri: memorialPhotoUrl }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={26} color="#78716c" />
                <Text style={styles.photoPlaceholderText}>Add photo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>Deceased Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            value={deceasedFullName}
            onChangeText={setDeceasedFullName}
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>{formatDateLabel(dateOfBirth)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#57534e" />
          </TouchableOpacity>
          {showDatePicker ? (
            <DateTimePicker
              value={dateOfBirth || new Date()}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={onDateChange}
            />
          ) : null}

          <Text style={styles.label}>Age</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyValue}>{age === null ? "Age will appear automatically" : `${age} years old`}</Text>
          </View>

          <Text style={styles.label}>Tribute Message</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Write your message for the deceased"
            value={tributeMessage}
            onChangeText={setTributeMessage}
            multiline
          />

          <Text style={styles.label}>Family Coordinator</Text>
          <TextInput
            style={styles.input}
            placeholder="Name of the family member in charge"
            value={familyCoordinatorName}
            onChangeText={setFamilyCoordinatorName}
          />

          <Text style={styles.label}>Wake Venue Address</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Enter wake area address"
            value={wakeAddress}
            onChangeText={setWakeAddress}
            multiline
          />

          <Text style={styles.label}>Pickup Address</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Enter the deceased pickup location"
            value={pickupAddress}
            onChangeText={setPickupAddress}
            multiline
          />

          <Text style={styles.label}>Contact Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter contact number"
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, submitting || uploadingPhoto ? styles.primaryButtonDisabled : null]}
          onPress={confirmSubmitRequest}
          disabled={submitting || uploadingPhoto}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Sending Request..." : "Send Service Request"}</Text>
        </TouchableOpacity>

        <Text style={styles.footerHint}>The shop will review this request first. Please wait for their acceptance after sending it.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f7f3",
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 16,
  },
  summaryCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 12,
  },
  summaryImage: {
    width: 92,
    height: 92,
    borderRadius: 16,
  },
  summaryFallback: {
    width: 92,
    height: 92,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8d8",
  },
  summaryBody: {
    flex: 1,
  },
  summaryName: {
    color: "#171717",
    fontSize: 16,
    fontWeight: "900",
  },
  summaryShop: {
    color: "#a16207",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  summaryVariation: {
    color: "#57534e",
    fontSize: 12,
    marginTop: 4,
  },
  summaryNote: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  sectionCard: {
    borderRadius: 22,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 16,
  },
  sectionTitle: {
    color: "#171717",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  photoPicker: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d6d3d1",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafaf9",
  },
  photoPreview: {
    width: "100%",
    height: 220,
  },
  photoPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoPlaceholderText: {
    color: "#57534e",
    fontSize: 13,
    fontWeight: "700",
  },
  label: {
    color: "#44403c",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    backgroundColor: "#fcfcfb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#171717",
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  dateButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    backgroundColor: "#fcfcfb",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButtonText: {
    color: "#171717",
    fontSize: 14,
  },
  readonlyField: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  readonlyValue: {
    color: "#57534e",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    width: "100%",
  },
  secondaryButtonText: {
    color: "#57534e",
    fontSize: 14,
    fontWeight: "900",
  },
  footerHint: {
    color: "#57534e",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  successWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 14,
  },
  successIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef3c7",
  },
  successTitle: {
    color: "#171717",
    fontSize: 24,
    fontWeight: "900",
  },
  successText: {
    color: "#57534e",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  successMeta: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "800",
  },
  condolenceText: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyTitle: {
    color: "#171717",
    fontSize: 20,
    fontWeight: "900",
  },
});
