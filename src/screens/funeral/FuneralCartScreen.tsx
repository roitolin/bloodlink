import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { formatPhilippinePeso } from "@/utils/funeralCatalog";
import { FuneralCartItem, loadFuneralCart, removeFuneralCartItem } from "@/utils/funeralCart";

function CartHeader({
  total,
}: {
  total: number;
}) {
  return (
    <View style={styles.navHeader}>
      <View style={styles.navHeaderTextWrap}>
        <Text style={styles.navHeaderTitle}>Cart Total</Text>
        <Text style={styles.navHeaderValue}>{formatPhilippinePeso(total)}</Text>
      </View>
    </View>
  );
}

export default function FuneralCartScreen({ navigation }: any) {
  const [items, setItems] = useState<FuneralCartItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCartId, setSelectedCartId] = useState<string | null>(null);

  const loadCart = useCallback(async () => {
    try {
      const next = await loadFuneralCart();
      setItems(next);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCart();
    }, [loadCart])
  );

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const numeric = Number(String(item.price || "").replace(/[^\d.]/g, "")) || 0;
        return sum + numeric * item.quantity;
      }, 0),
    [items]
  );

  const handleCheckout = useCallback(() => {
    const selectedItem = items.find((item) => item.cartId === selectedCartId);
    if (!selectedItem) {
      Alert.alert("Select Item", "Please select a cart item first.");
      return;
    }

    navigation.navigate("FuneralCheckout", { cartItem: selectedItem });
  }, [items, navigation, selectedCartId]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleAlign: "left",
      headerTitle: () => <CartHeader total={total} />,
      headerRight: selectedCartId
        ? () => (
            <TouchableOpacity style={styles.navHeaderCheckoutButton} onPress={handleCheckout}>
              <Ionicons name="flash-outline" size={16} color="#ffffff" />
              <Text style={styles.navHeaderCheckoutText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [handleCheckout, navigation, selectedCartId, total]);

  const removeItem = async (cartId: string) => {
    const next = await removeFuneralCartItem(cartId);
    setItems(next);
    if (selectedCartId === cartId) {
      setSelectedCartId(null);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadCart(); }} />}
      >
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cart-outline" size={30} color="#78716c" />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>Products you add from funeral shops will appear here.</Text>
          </View>
        ) : (
          <>
            {items.map((item) => (
              <TouchableOpacity
                key={item.cartId}
                style={[styles.itemCard, selectedCartId === item.cartId ? styles.itemCardActive : null]}
                activeOpacity={0.92}
                onPress={() => setSelectedCartId((current) => (current === item.cartId ? null : item.cartId))}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.itemFallback}>
                    <Ionicons name="cube-outline" size={24} color="#475569" />
                  </View>
                )}

                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemShop}>{item.shopName}</Text>
                  {item.variationName ? <Text style={styles.itemVariation}>Variation: {item.variationName}</Text> : null}
                  <Text style={styles.itemPrice}>{formatPhilippinePeso(item.price)}</Text>

                  <View style={styles.itemActions}>
                    <TouchableOpacity style={styles.removeButton} onPress={() => void removeItem(item.cartId)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
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
    paddingBottom: 28,
    gap: 16,
  },
  navHeader: {
    justifyContent: "center",
  },
  navHeaderTextWrap: {
    flexShrink: 1,
  },
  navHeaderTitle: {
    color: "#57534e",
    fontSize: 13,
    fontWeight: "700",
  },
  navHeaderValue: {
    color: "#171717",
    fontSize: 20,
    fontWeight: "900",
  },
  navHeaderCheckoutButton: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "#171717",
    paddingHorizontal: 14,
    marginRight: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  navHeaderCheckoutText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#ece7df",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: "#171717",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  itemCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 12,
  },
  itemCardActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#fffaf0",
  },
  itemImage: {
    width: 94,
    height: 94,
    borderRadius: 16,
  },
  itemFallback: {
    width: 94,
    height: 94,
    borderRadius: 16,
    backgroundColor: "#fff8d8",
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: {
    flex: 1,
  },
  itemName: {
    color: "#171717",
    fontSize: 15,
    fontWeight: "900",
  },
  itemShop: {
    color: "#a16207",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  itemVariation: {
    color: "#57534e",
    fontSize: 12,
    marginTop: 4,
  },
  itemPrice: {
    color: "#171717",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  itemActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 10,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeButtonText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "800",
  },
});
