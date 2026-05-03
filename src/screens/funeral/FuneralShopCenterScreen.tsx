import { useCallback, useMemo, useState, type ComponentProps } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { auth, db, uploadCertificate } from "@/services";
import { formatPhilippinePeso } from "@/utils/funeralCatalog";

type ShopStatus = "none" | "pending" | "verified" | "rejected";
type ProductTab = "live" | "soldout" | "reviewing";
type IoniconName = ComponentProps<typeof Ionicons>["name"];

type ShopInfo = {
  shopName?: string;
  shopAddress?: string;
  shopPhoneNumber?: string;
  shopImageUrl?: string | null;
};

type BusinessInfo = {
  individualRegisteredName?: string;
  businessName?: string;
  generalLocation?: string;
  registeredAddress?: string;
  zipCode?: string;
  tin?: string;
  vatRegistrationStatus?: string;
};

type ProductVariation = {
  name: string;
  imageUrl?: string | null;
};

type ShopProduct = {
  id: string;
  name: string;
  description: string;
  price: string;
  stock?: number;
  imageUrl?: string | null;
  galleryImageUrls?: string[];
  hasVariations?: boolean;
  variations?: ProductVariation[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProductCardProps = {
  item: ShopProduct;
  onPress: () => void;
  onEdit: () => void;
};

function getProductState(item: ShopProduct): ProductTab {
  if (!item.active || (item.stock ?? 0) <= 0) return "soldout";
  if (!getPrimaryProductImage(item)) return "reviewing";
  return "live";
}

function getPrimaryProductImage(item?: ShopProduct | null) {
  if (!item) return null;
  return item.imageUrl || item.galleryImageUrls?.[0] || item.variations?.find((entry) => entry.imageUrl)?.imageUrl || null;
}

function getVariationSummary(item?: ShopProduct | null) {
  if (!item?.hasVariations || !item.variations?.length) return "No variations";
  return item.variations.map((entry) => entry.name).filter(Boolean).join(", ");
}

function getShopStatusMeta(status: ShopStatus, rejectionReason: string | null) {
  if (status === "verified") {
    return {
      label: "Verified",
      title: "Storefront ready",
      message: "Your shop is approved. You can edit the storefront and manage your catalog.",
      background: "#e7f5ec",
      border: "#bfe3cc",
      text: "#1e5b3a",
      chipText: "#1e5b3a",
      chipBackground: "#f7fffa",
    };
  }

  if (status === "pending") {
    return {
      label: "Pending Review",
      title: "Waiting for approval",
      message: "Your shop profile is under review. You can still look around while you wait.",
      background: "#fff4e5",
      border: "#f2d2a2",
      text: "#9a5417",
      chipText: "#8a4a13",
      chipBackground: "#fffaf3",
    };
  }

  if (status === "rejected") {
    return {
      label: "Needs Changes",
      title: "Profile needs updates",
      message: rejectionReason || "Your last submission needs changes before it can be approved again.",
      background: "#fdecec",
      border: "#f3c2c2",
      text: "#8f2525",
      chipText: "#8f2525",
      chipBackground: "#fff8f8",
    };
  }

  return {
    label: "Setup Needed",
    title: "Finish your storefront setup",
    message: "Complete your shop registration so families can view your storefront and products.",
    background: "#f2ede6",
    border: "#dfd4c6",
    text: "#65584d",
    chipText: "#65584d",
    chipBackground: "#fffdfa",
  };
}

function formatUpdatedAt(value: string) {
  if (!value) return "Recently updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently updated";
  return `Updated ${parsed.toLocaleDateString()}`;
}

function ProductStateBadge({ state }: { state: ProductTab }) {
  const label = state === "live" ? "LIVE" : state === "soldout" ? "SOLD OUT" : "REVIEWING";
  const toneStyle = state === "live" ? styles.stateLive : state === "soldout" ? styles.stateSold : styles.stateReview;

  return (
    <View style={[styles.stateBadge, toneStyle]}>
      <Text style={styles.stateBadgeText}>{label}</Text>
    </View>
  );
}

function ProductCard({ item, onPress, onEdit }: ProductCardProps) {
  const productState = getProductState(item);
  const productImage = getPrimaryProductImage(item);

  return (
    <TouchableOpacity activeOpacity={0.92} style={styles.productCard} onPress={onPress}>
      {productImage ? (
        <Image source={{ uri: productImage }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={styles.productImageFallback}>
          <Ionicons name="image-outline" size={24} color="#a59a90" />
        </View>
      )}

      <View style={styles.productBody}>
        <View style={styles.productTopRow}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          <ProductStateBadge state={productState} />
        </View>

        <Text style={styles.productPrice}>{formatPhilippinePeso(item.price)}</Text>
        <Text style={styles.productMeta}>
          Stock {item.stock ?? 0}
          {item.hasVariations && item.variations?.length ? ` | ${item.variations.length} variations` : ""}
        </Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description || "No description yet."}
        </Text>

        <View style={styles.productActionRow}>
          <TouchableOpacity style={styles.inlineGhostButton} onPress={onPress}>
            <Text style={styles.inlineGhostButtonText}>View Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlinePrimaryButton} onPress={onEdit}>
            <Text style={styles.inlinePrimaryButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.productUpdatedText}>{formatUpdatedAt(item.updatedAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function DetailRow({ icon, label, value }: { icon: IoniconName; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIconWrap}>
        <Ionicons name={icon} size={16} color="#8c4d2f" />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function FuneralShopCenterScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [savingShop, setSavingShop] = useState(false);
  const [uploadingShopImage, setUploadingShopImage] = useState(false);

  const [shopStatus, setShopStatus] = useState<ShopStatus>("none");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);

  const [shopNameInput, setShopNameInput] = useState("");
  const [shopAddressInput, setShopAddressInput] = useState("");
  const [shopPhoneInput, setShopPhoneInput] = useState("");
  const [shopImageUrl, setShopImageUrl] = useState<string | null>(null);

  const [productTab, setProductTab] = useState<ProductTab>("live");

  const [shopDetailsVisible, setShopDetailsVisible] = useState(false);
  const [productDetailsVisible, setProductDetailsVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);

  const loadData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data() || {};
      const nextShopInfo = (data.funeralShopInfo || null) as ShopInfo | null;
      const nextBusinessInfo = (data.funeralBusinessInfo || null) as BusinessInfo | null;

      setShopStatus((data.funeralShopStatus || "none") as ShopStatus);
      setRejectionReason((data.funeralShopRejectionReason as string | null) || null);
      setShopInfo(nextShopInfo);
      setBusinessInfo(nextBusinessInfo);
      setProducts(Array.isArray(data.funeralProducts) ? (data.funeralProducts as ShopProduct[]) : []);

      setShopNameInput(String(nextShopInfo?.shopName || ""));
      setShopAddressInput(String(nextShopInfo?.shopAddress || ""));
      setShopPhoneInput(String(nextShopInfo?.shopPhoneNumber || ""));
      setShopImageUrl((nextShopInfo?.shopImageUrl as string | null) || null);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load shop center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const isVerified = shopStatus === "verified";
  const statusMeta = getShopStatusMeta(shopStatus, rejectionReason);
  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")),
    [products]
  );
  const liveProducts = useMemo(() => sortedProducts.filter((item) => getProductState(item) === "live"), [sortedProducts]);
  const soldOutProducts = useMemo(() => sortedProducts.filter((item) => getProductState(item) === "soldout"), [sortedProducts]);
  const reviewingProducts = useMemo(() => sortedProducts.filter((item) => getProductState(item) === "reviewing"), [sortedProducts]);
  const visibleProducts = productTab === "live" ? liveProducts : productTab === "soldout" ? soldOutProducts : reviewingProducts;

  const shopDisplayName = shopNameInput.trim() || shopInfo?.shopName || businessInfo?.businessName || "My Shop";
  const shopLocation = shopAddressInput.trim() || shopInfo?.shopAddress || businessInfo?.generalLocation || "Add your storefront location";
  const shopContact = shopPhoneInput.trim() || shopInfo?.shopPhoneNumber || "Add your contact number";

  const handleBack = () => {
    if (typeof navigation?.canGoBack === "function" && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("ProfileMain");
  };

  const saveShopDetails = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!shopNameInput.trim() || !shopAddressInput.trim() || !shopPhoneInput.trim()) {
      Alert.alert("Missing fields", "Shop name, address, and phone number are required.");
      return;
    }

    setSavingShop(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          funeralShopInfo: {
            ...(shopInfo || {}),
            shopName: shopNameInput.trim(),
            shopAddress: shopAddressInput.trim(),
            shopPhoneNumber: shopPhoneInput.trim(),
            shopImageUrl: shopImageUrl || null,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setShopInfo((prev) => ({
        ...(prev || {}),
        shopName: shopNameInput.trim(),
        shopAddress: shopAddressInput.trim(),
        shopPhoneNumber: shopPhoneInput.trim(),
        shopImageUrl: shopImageUrl || null,
      }));
      setShopDetailsVisible(false);
      Alert.alert("Saved", "Shop details updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save shop details.");
    } finally {
      setSavingShop(false);
    }
  };

  const pickAndUploadShopImage = async () => {
    const picker = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.75,
    });
    if (picker.canceled || !picker.assets[0]) return;

    setUploadingShopImage(true);
    try {
      const url = await uploadCertificate(picker.assets[0].uri);
      setShopImageUrl(url);
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message || "Failed to upload shop image.");
    } finally {
      setUploadingShopImage(false);
    }
  };

  const persistProducts = async (nextProducts: ShopProduct[]) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          funeralProducts: nextProducts,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setProducts(nextProducts);
    } catch (error) {
      throw error;
    }
  };

  const openAddProductPage = () => {
    navigation.navigate("ProductEditor");
  };

  const openEditProductPage = (item: ShopProduct) => {
    navigation.navigate("ProductEditor", { productId: item.id });
  };

  const openProductDetailsModal = (item: ShopProduct) => {
    setSelectedProduct(item);
    setProductDetailsVisible(true);
  };

  const removeProduct = (item: ShopProduct) => {
    Alert.alert("Delete Product", `Remove ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await persistProducts(products.filter((entry) => entry.id !== item.id));
            setSelectedProduct((current) => (current?.id === item.id ? null : current));
            Alert.alert("Deleted", "Product removed.");
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to delete product.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8c4d2f" />
          <Text style={styles.loadingText}>Loading your shop center...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.screenBody}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            {shopImageUrl ? <Image source={{ uri: shopImageUrl }} style={styles.heroImage} resizeMode="cover" /> : null}
            <View style={styles.heroOverlay} />
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons name="chevron-back" size={22} color="#171717" />
              </TouchableOpacity>

              <View style={styles.topBarText}>
                <Text style={styles.topBarLabel}>Funeral Shop Center</Text>
                <Text style={styles.topBarTitle}>Shop Center</Text>
              </View>

              <View style={[styles.statusChip, { backgroundColor: statusMeta.chipBackground }]}>
                <Text style={[styles.statusChipText, { color: statusMeta.chipText }]}>{statusMeta.label}</Text>
              </View>
            </View>

            <View style={styles.heroContent}>
              <View style={styles.heroAvatarWrap}>
                {shopImageUrl ? (
                  <Image source={{ uri: shopImageUrl }} style={styles.heroAvatarImage} resizeMode="cover" />
                ) : (
                  <View style={styles.heroAvatarFallback}>
                    <Ionicons name="storefront-outline" size={30} color="#171717" />
                  </View>
                )}
              </View>

              <View style={styles.heroTextBlock}>
                <Text style={styles.heroEyebrow}>A polished place to manage your storefront</Text>
                <Text style={styles.heroTitle}>{shopDisplayName}</Text>
                <Text style={styles.heroSubtitle}>{shopLocation}</Text>
                <View style={styles.heroMetaRow}>
                  <Ionicons name="call-outline" size={14} color="#44403c" />
                  <Text style={styles.heroMetaText}>{shopContact}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroActionRow}>
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.heroPrimaryButton, styles.heroPrimaryButtonCentered, !isVerified ? styles.heroButtonDisabled : null]}
                onPress={() => setShopDetailsVisible(true)}
                disabled={!isVerified}
              >
                <Ionicons name="create-outline" size={16} color="#ffffff" />
                <Text style={styles.heroPrimaryButtonText}>View Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.heroPrimaryButton, styles.heroSecondaryAction, !isVerified ? styles.heroButtonDisabled : null]}
                onPress={() => navigation.navigate("ServiceRequestsInbox")}
                disabled={!isVerified}
              >
                <Ionicons name="mail-open-outline" size={16} color="#ffffff" />
                <Text style={styles.heroPrimaryButtonText}>Service Requests</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.statusBanner, { backgroundColor: statusMeta.background, borderColor: statusMeta.border }]}>
            <Ionicons name={shopStatus === "verified" ? "shield-checkmark-outline" : shopStatus === "rejected" ? "alert-circle-outline" : "time-outline"} size={18} color={statusMeta.text} />
            <View style={styles.statusBannerCopy}>
              <Text style={[styles.statusBannerTitle, { color: statusMeta.text }]}>{statusMeta.title}</Text>
              <Text style={[styles.statusBannerText, { color: statusMeta.text }]}>{statusMeta.message}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeadingBlock}>
                <Text style={styles.sectionTitle}>Browse Products</Text>
                <Text style={styles.sectionSubtitle}>Manage your shop listings in one cleaner catalog view.</Text>
              </View>
              <View style={styles.catalogActions}>
                <TouchableOpacity style={styles.refreshButton} onPress={() => void loadData()}>
                  <Ionicons name="refresh-outline" size={16} color="#171717" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.92}
                  style={[styles.catalogAddButton, !isVerified ? styles.catalogAddButtonDisabled : null]}
                  onPress={openAddProductPage}
                  disabled={!isVerified}
                >
                  <Ionicons name="add" size={16} color={isVerified ? "#171717" : "#8f8a80"} />
                  <Text style={[styles.catalogAddButtonText, !isVerified ? styles.catalogAddButtonTextDisabled : null]}>Add Product</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabButton, productTab === "live" ? styles.tabButtonActive : null]}
                onPress={() => setProductTab("live")}
              >
                <Text style={[styles.tabButtonText, productTab === "live" ? styles.tabButtonTextActive : null]}>Available ({liveProducts.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, productTab === "soldout" ? styles.tabButtonActive : null]}
                onPress={() => setProductTab("soldout")}
              >
                <Text style={[styles.tabButtonText, productTab === "soldout" ? styles.tabButtonTextActive : null]}>
                  Sold Out ({soldOutProducts.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, productTab === "reviewing" ? styles.tabButtonActive : null]}
                onPress={() => setProductTab("reviewing")}
              >
                <Text style={[styles.tabButtonText, productTab === "reviewing" ? styles.tabButtonTextActive : null]}>
                  Reviewing ({reviewingProducts.length})
                </Text>
              </TouchableOpacity>
            </View>

            {visibleProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="albums-outline" size={22} color="#8b8578" />
                <Text style={styles.emptyStateTitle}>Nothing in this tab yet</Text>
                <Text style={styles.emptyStateText}>Add a product or switch tabs to review the rest of your catalog.</Text>
              </View>
            ) : (
              visibleProducts.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onPress={() => openProductDetailsModal(item)}
                  onEdit={() => openEditProductPage(item)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <Modal visible={shopDetailsVisible} transparent animationType="fade" onRequestClose={() => setShopDetailsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShopDetailsVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Shop Details</Text>
              <Text style={styles.modalCaption}>Refresh the storefront image and core business details that customers see first.</Text>

              {shopImageUrl ? <Image source={{ uri: shopImageUrl }} style={styles.previewImage} resizeMode="cover" /> : null}

              <TouchableOpacity style={styles.modalOutlineButton} onPress={pickAndUploadShopImage} disabled={uploadingShopImage}>
                {uploadingShopImage ? <ActivityIndicator size="small" color="#8c4d2f" /> : <Ionicons name="camera-outline" size={18} color="#8c4d2f" />}
                <Text style={styles.modalOutlineButtonText}>{uploadingShopImage ? "Uploading..." : "Edit Shop Picture"}</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Shop Name</Text>
              <TextInput style={styles.input} value={shopNameInput} onChangeText={setShopNameInput} placeholder="Shop name" />

              <Text style={styles.inputLabel}>Shop Address</Text>
              <TextInput style={styles.input} value={shopAddressInput} onChangeText={setShopAddressInput} placeholder="Shop address" />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={shopPhoneInput}
                onChangeText={setShopPhoneInput}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />

              <View style={styles.modalActionStack}>
                <TouchableOpacity style={styles.modalPrimaryButton} onPress={saveShopDetails} disabled={savingShop}>
                  {savingShop ? <ActivityIndicator size="small" color="#fff8f1" /> : null}
                  <Text style={styles.modalPrimaryButtonText}>Save Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalGhostButton} onPress={() => setShopDetailsVisible(false)}>
                  <Text style={styles.modalGhostButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={productDetailsVisible} transparent animationType="fade" onRequestClose={() => setProductDetailsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProductDetailsVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Product Details</Text>
              <Text style={styles.modalCaption}>A closer view of the listing so you can inspect, edit, or remove it.</Text>

              {selectedProduct?.galleryImageUrls?.length ? (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryScroll}>
                  {selectedProduct.galleryImageUrls.map((imageUrl, index) => (
                    <Image key={`${selectedProduct.id}_${index}`} source={{ uri: imageUrl }} style={styles.galleryPreviewImage} resizeMode="cover" />
                  ))}
                </ScrollView>
              ) : getPrimaryProductImage(selectedProduct) ? (
                <Image source={{ uri: getPrimaryProductImage(selectedProduct) || "" }} style={styles.previewImage} resizeMode="cover" />
              ) : null}

              <DetailRow icon="cube-outline" label="Name" value={selectedProduct?.name || "-"} />
              <DetailRow icon="cash-outline" label="Price" value={formatPhilippinePeso(selectedProduct?.price || "")} />
              <DetailRow icon="archive-outline" label="Stock" value={String(selectedProduct?.stock ?? 0)} />
              <DetailRow icon="options-outline" label="Variations" value={selectedProduct ? getVariationSummary(selectedProduct) : "-"} />
              <DetailRow icon="document-text-outline" label="Description" value={selectedProduct?.description || "-"} />

              <View style={styles.modalActionStack}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={() => {
                    if (!selectedProduct) return;
                    setProductDetailsVisible(false);
                    openEditProductPage(selectedProduct);
                  }}
                >
                  <Text style={styles.modalPrimaryButtonText}>Edit Product</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDangerButton}
                  onPress={() => {
                    if (!selectedProduct) return;
                    setProductDetailsVisible(false);
                    removeProduct(selectedProduct);
                  }}
                >
                  <Text style={styles.modalDangerButtonText}>Delete Product</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalGhostButton} onPress={() => setProductDetailsVisible(false)}>
                  <Text style={styles.modalGhostButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f7f3",
  },
  screenBody: {
    flex: 1,
    position: "relative",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  loadingText: {
    color: "#705f53",
    fontSize: 14,
    fontWeight: "700",
  },
  content: {
    paddingBottom: 32,
  },
  heroSection: {
    minHeight: 350,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    backgroundColor: "#facc15",
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    opacity: 0.34,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(250, 204, 21, 0.84)",
  },
  heroGlowTop: {
    position: "absolute",
    top: -50,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255, 255, 255, 0.24)",
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -90,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(202, 138, 4, 0.22)",
  },
  topBar: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    borderWidth: 1,
    borderColor: "rgba(23, 23, 23, 0.08)",
  },
  topBarText: {
    flex: 1,
  },
  topBarLabel: {
    color: "#7c2d12",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  topBarTitle: {
    color: "#171717",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  heroContent: {
    zIndex: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
    marginTop: 32,
  },
  heroAvatarWrap: {
    shadowColor: "#ca8a04",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroAvatarImage: {
    width: 92,
    height: 92,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.68)",
  },
  heroAvatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.34)",
    borderWidth: 1,
    borderColor: "rgba(23, 23, 23, 0.08)",
  },
  heroTextBlock: {
    flex: 1,
  },
  heroEyebrow: {
    color: "#7c2d12",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: "#171717",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  heroSubtitle: {
    color: "#44403c",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  heroMetaText: {
    color: "#292524",
    fontSize: 13,
    fontWeight: "700",
  },
  heroActionRow: {
    zIndex: 2,
    marginTop: 24,
    alignItems: "center",
  },
  heroPrimaryButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "#171717",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  heroPrimaryButtonCentered: {
    alignSelf: "center",
  },
  heroSecondaryAction: {
    marginTop: 10,
    backgroundColor: "rgba(23, 23, 23, 0.88)",
  },
  heroPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  heroButtonDisabled: {
    opacity: 0.48,
  },
  statusBanner: {
    marginHorizontal: 20,
    marginTop: -18,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    shadowColor: "#ca8a04",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  statusBannerCopy: {
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  statusBannerText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  sectionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 16,
    shadowColor: "#ca8a04",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#171717",
    fontSize: 20,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionHeadingBlock: {
    flex: 1,
  },
  catalogActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff8d8",
    borderWidth: 1,
    borderColor: "#f3e8b1",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e6da",
  },
  detailIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#fff4bf",
    alignItems: "center",
    justifyContent: "center",
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "800",
  },
  detailValue: {
    color: "#292524",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fff",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  emptyStateTitle: {
    color: "#171717",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyStateText: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  emptyStateButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#171717",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 16,
  },
  emptyStateButtonText: {
    color: "#fff8f1",
    fontSize: 13,
    fontWeight: "900",
  },
  productCard: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fff",
    marginTop: 12,
  },
  productImage: {
    width: 104,
    height: 104,
    borderRadius: 18,
  },
  productImageFallback: {
    width: 104,
    height: 104,
    borderRadius: 18,
    backgroundColor: "#fff8d8",
    alignItems: "center",
    justifyContent: "center",
  },
  productBody: {
    flex: 1,
  },
  productTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  productName: {
    flex: 1,
    color: "#171717",
    fontSize: 16,
    fontWeight: "900",
  },
  productPrice: {
    color: "#b45309",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  productMeta: {
    color: "#57534e",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  productDescription: {
    color: "#57534e",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  productActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  inlineGhostButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e7dcb2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fffdf5",
  },
  inlineGhostButtonText: {
    color: "#a16207",
    fontSize: 11,
    fontWeight: "900",
  },
  inlinePrimaryButton: {
    borderRadius: 999,
    backgroundColor: "#facc15",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlinePrimaryButtonText: {
    color: "#171717",
    fontSize: 11,
    fontWeight: "900",
  },
  productUpdatedText: {
    color: "#9a8f85",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 10,
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stateLive: {
    backgroundColor: "#fef08a",
  },
  stateSold: {
    backgroundColor: "#fde5e5",
  },
  stateReview: {
    backgroundColor: "#fde68a",
  },
  stateBadgeText: {
    color: "#171717",
    fontSize: 10,
    fontWeight: "900",
  },
  catalogAddButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "#facc15",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#eab308",
  },
  catalogAddButtonDisabled: {
    backgroundColor: "#f5f5f4",
    borderColor: "#e7e5e4",
  },
  catalogAddButtonText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "900",
  },
  catalogAddButtonTextDisabled: {
    color: "#8f8a80",
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  tabButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabButtonActive: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  tabButtonText: {
    color: "#57534e",
    fontSize: 12,
    fontWeight: "900",
  },
  tabButtonTextActive: {
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 10, 8, 0.58)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "84%",
    borderRadius: 24,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 18,
  },
  modalTitle: {
    color: "#171717",
    fontSize: 22,
    fontWeight: "900",
  },
  modalCaption: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 14,
  },
  inputLabel: {
    color: "#44403c",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ece7df",
    borderRadius: 16,
    backgroundColor: "#fffdf9",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#171717",
  },
  multilineInput: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  previewImage: {
    width: "100%",
    height: 170,
    borderRadius: 18,
    marginBottom: 12,
  },
  galleryScroll: {
    paddingBottom: 12,
  },
  galleryPreviewImage: {
    width: 280,
    height: 190,
    borderRadius: 18,
    marginRight: 10,
  },
  modalOutlineButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fffdf9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  modalOutlineButtonText: {
    color: "#a16207",
    fontSize: 13,
    fontWeight: "900",
  },
  modalActionStack: {
    gap: 10,
    marginTop: 16,
  },
  modalPrimaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#171717",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  modalDangerButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#efc4c4",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDangerButtonText: {
    color: "#912929",
    fontSize: 14,
    fontWeight: "900",
  },
  modalGhostButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
  },
  modalGhostButtonText: {
    color: "#57534e",
    fontSize: 14,
    fontWeight: "900",
  },
});
