import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services";
import { formatPhilippinePeso } from "@/utils/funeralCatalog";

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
  active?: boolean;
};

function getPrimaryProductImage(item: ShopProduct) {
  return item.imageUrl || item.galleryImageUrls?.[0] || (Array.isArray(item.variations) ? item.variations.find((entry) => entry.imageUrl)?.imageUrl : null) || null;
}

export default function FuneralShopProductsScreen({ navigation, route }: any) {
  const shopId = String(route?.params?.shopId || "");
  const fallbackShopName = String(route?.params?.shopName || "Shop");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shopName, setShopName] = useState(fallbackShopName);
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhoneNumber, setShopPhoneNumber] = useState("");
  const [products, setProducts] = useState<ShopProduct[]>([]);

  const loadShop = useCallback(async () => {
    if (!shopId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const snapshot = await getDoc(doc(db, "users", shopId));
      if (!snapshot.exists()) {
        setProducts([]);
        return;
      }

      const data = snapshot.data() || {};
      const shopInfo = data.funeralShopInfo || {};
      const nextProducts = (Array.isArray(data.funeralProducts) ? data.funeralProducts : [])
        .filter((item: ShopProduct) => item?.active && (item?.stock ?? 0) > 0)
        .filter((item: ShopProduct) => Boolean(getPrimaryProductImage(item)));

      setShopName(String(shopInfo.shopName || fallbackShopName));
      setShopAddress(String(shopInfo.shopAddress || ""));
      setShopPhoneNumber(String(shopInfo.shopPhoneNumber || ""));
      setProducts(nextProducts);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load shop products.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fallbackShopName, shopId]);

  useFocusEffect(
    useCallback(() => {
      void loadShop();
    }, [loadShop])
  );

  const subtitle = useMemo(
    () => `${products.length} available ${products.length === 1 ? "product" : "products"}`,
    [products.length]
  );

  const openProduct = (product: ShopProduct) => {
    navigation.navigate("ProductView", {
      product: {
        ...product,
        shopId,
        shopName,
      },
    });
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadShop(); }} />}
      >
        <View style={styles.heroCard}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color="#22312d" />
          </TouchableOpacity>
          <Text style={styles.heroEyebrow}>Shop Products</Text>
          <Text style={styles.heroTitle}>{shopName}</Text>
          <Text style={styles.heroSubtitle}>{shopAddress || "Verified funeral shop"}</Text>
          <View style={styles.heroPill}>
            <Ionicons name="cube-outline" size={16} color="#22312d" />
            <Text style={styles.heroPillText}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.customRequestButton}
            activeOpacity={0.92}
            onPress={() =>
              navigation.navigate("FuneralCustomCasketRequest", {
                shopId,
                shopName,
                shopAddress,
                shopPhoneNumber,
              })
            }
          >
            <Ionicons name="color-wand-outline" size={16} color="#ffffff" />
            <Text style={styles.customRequestButtonText}>Request Custom Casket Design</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#22312d" />
            <Text style={styles.loadingText}>Loading shop products...</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={28} color="#86908a" />
            <Text style={styles.emptyTitle}>No products available</Text>
            <Text style={styles.emptyText}>This shop has not published visible products yet.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((item) => (
              <TouchableOpacity key={item.id} style={styles.card} activeOpacity={0.92} onPress={() => openProduct(item)}>
                {getPrimaryProductImage(item) ? (
                  <Image source={{ uri: getPrimaryProductImage(item) || "" }} style={styles.productImage} resizeMode="cover" />
                ) : (
                  <View style={styles.productVisual}>
                    <Ionicons name="cube-outline" size={44} color="#4c5b57" />
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <Text style={styles.price}>{formatPhilippinePeso(item.price)}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.description || "Product details will appear here."}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef1ec",
  },
  content: {
    padding: 18,
    paddingBottom: 28,
    gap: 16,
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#d6e2d2",
    padding: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.68)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroEyebrow: {
    color: "#86654a",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  heroTitle: {
    color: "#22312d",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  heroSubtitle: {
    color: "#53615d",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.68)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 16,
  },
  heroPillText: {
    color: "#22312d",
    fontSize: 12,
    fontWeight: "900",
  },
  customRequestButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#22312d",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  customRequestButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 48,
  },
  loadingText: {
    color: "#62706b",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: "#f8f6f2",
    borderWidth: 1,
    borderColor: "#d9d6cd",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: "#22312d",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#62706b",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  card: {
    width: "47.5%",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d9d6cd",
  },
  productImage: {
    width: "100%",
    height: 108,
    borderRadius: 18,
    marginBottom: 12,
  },
  productVisual: {
    height: 108,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: "#ebf1e8",
  },
  cardFooter: {
    marginTop: 10,
  },
  price: {
    color: "#22312d",
    fontSize: 18,
    fontWeight: "900",
  },
  cardTitle: {
    color: "#41514d",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
    minHeight: 34,
  },
  cardDescription: {
    color: "#62706b",
    fontSize: 11,
    lineHeight: 16,
    minHeight: 32,
  },
});
