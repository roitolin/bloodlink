import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, addDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { formatPhilippinePeso } from "@/utils/funeralCatalog";
import { auth, db } from "@/services";
import { createAdminNotification } from "@/utils/createAdminNotification";
import { addFuneralCartItem } from "@/utils/funeralCart";

type ProductVariation = {
  name: string;
  imageUrl?: string | null;
};

type ProductReview = {
  id?: string;
  reviewerName?: string;
  rating?: number;
  comment?: string;
  itemLabel?: string;
  imageUrl?: string | null;
  createdLabel?: string;
};

type ProductRatingDoc = {
  id: string;
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  rating: number;
  createdAt?: any;
  updatedAt?: any;
};

type ProductFeedbackDoc = {
  id: string;
  productKey: string;
  productId: string;
  shopId?: string | null;
  userId: string;
  userEmail?: string | null;
  displayName?: string | null;
  feedback: string;
  ratingSnapshot?: number;
  createdAt?: any;
  updatedAt?: any;
};

type ProductViewItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  stock?: number;
  rating?: number;
  soldCount?: number;
  imageUrl?: string | null;
  galleryImageUrls?: string[];
  shopName?: string;
  shopId?: string;
  hasVariations?: boolean;
  variations?: ProductVariation[];
  reviewCount?: number;
  reviews?: ProductReview[];
};

function getGallery(item: ProductViewItem) {
  if (item.galleryImageUrls?.length) return item.galleryImageUrls;
  if (item.imageUrl) return [item.imageUrl];
  const variations = Array.isArray(item.variations) ? item.variations : [];
  const variationImages = variations.map((entry) => entry.imageUrl).filter((entry): entry is string => Boolean(entry));
  return variationImages;
}

function getNumericPrice(value: string | number | null | undefined) {
  const raw = typeof value === "number" ? String(value) : String(value || "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : 0;
}

function renderStars(value: number) {
  const safeValue = Math.max(0, Math.min(5, Math.round(value)));
  return `${"\u2605".repeat(safeValue)}${"\u2606".repeat(5 - safeValue)}`;
}

function formatTimestamp(timestamp: any) {
  if (!timestamp) return "Just now";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString();
}

const RATING_VALUES = [1, 2, 3, 4, 5];
type VariationSheetMode = "browse" | "cart" | "buy";
type VariationPreviewState = {
  name: string;
  imageUrl?: string | null;
} | null;

export default function FuneralProductViewScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [variationsVisible, setVariationsVisible] = useState(false);
  const [variationSheetMode, setVariationSheetMode] = useState<VariationSheetMode>("browse");
  const [cartConfirmVisible, setCartConfirmVisible] = useState(false);
  const [variationPreviewVisible, setVariationPreviewVisible] = useState(false);
  const [previewVariation, setPreviewVariation] = useState<VariationPreviewState>(null);
  const [reviewsVisible, setReviewsVisible] = useState(false);
  const [selectedVariationName, setSelectedVariationName] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [postingFeedback, setPostingFeedback] = useState(false);
  const [ratings, setRatings] = useState<ProductRatingDoc[]>([]);
  const [feedbacks, setFeedbacks] = useState<ProductFeedbackDoc[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const product = (route?.params?.product || null) as ProductViewItem | null;
  const gallery = product ? getGallery(product) : [];

  const imageWidth = Math.max(width - 24, 280);
  const imageHeight = Math.min(imageWidth * 0.94, 420);

  const priceValue = useMemo(() => getNumericPrice(product?.price), [product?.price]);
  const stockCount = product?.stock ?? 0;
  const priceLabel = product?.name || "Funeral product";
  const defaultRatingValue = Math.max(0, Math.min(5, Number(product?.rating) || 4.4));
  const soldCount = Math.max(0, Number(product?.soldCount) || 19);
  const variations = Array.isArray(product?.variations) ? product.variations : [];
  const variationCount = variations.length;
  const selectedVariation = variations.find((item) => item.name === selectedVariationName) || null;
  const fallbackItemLabel = variations[0]?.name ? `Item: ${variations[0].name}` : "Item: Standard";
  const productKey = product ? `${product.shopId || "shop"}:${product.id}` : "";

  const getIdentity = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const data = userDoc.data() || {};
    return {
      userId: currentUser.uid,
      userEmail: currentUser.email || null,
      displayName: data.fullName || currentUser.email || "User",
    };
  }, []);

  const loadReviews = useCallback(async () => {
    if (!productKey) {
      setRatings([]);
      setFeedbacks([]);
      setLoadingReviews(false);
      return;
    }

    setLoadingReviews(true);
    try {
      const [ratingsSnap, feedbacksSnap] = await Promise.all([
        getDocs(query(collection(db, "funeral_product_ratings"), where("productKey", "==", productKey))),
        getDocs(query(collection(db, "funeral_product_feedback"), where("productKey", "==", productKey))),
      ]);

      const nextRatings = ratingsSnap.docs.map((item) => ({ id: item.id, ...item.data() })) as ProductRatingDoc[];
      const nextFeedbacks = feedbacksSnap.docs
        .map((item) => ({ id: item.id, ...item.data() }) as ProductFeedbackDoc)
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

      setRatings(nextRatings);
      setFeedbacks(nextFeedbacks);

      const currentUser = auth.currentUser;
      const myRating = currentUser ? nextRatings.find((item) => item.userId === currentUser.uid) : null;
      setRating(myRating?.rating || 0);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load product reviews.");
    } finally {
      setLoadingReviews(false);
    }
  }, [productKey]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const averageRating = useMemo(() => {
    if (!ratings.length) return defaultRatingValue;
    const total = ratings.reduce((sum, item) => sum + (Number(item.rating) || 0), 0);
    return total / ratings.length;
  }, [defaultRatingValue, ratings]);

  const reviews = useMemo(() => {
    const mappedReviews = feedbacks.map((item) => ({
      id: item.id,
      reviewerName: item.displayName || item.userEmail || "User",
      rating: item.ratingSnapshot || averageRating || defaultRatingValue,
      itemLabel: fallbackItemLabel,
      comment: item.feedback,
      createdLabel: formatTimestamp(item.updatedAt || item.createdAt),
    })) as ProductReview[];

    if (mappedReviews.length) return mappedReviews;
    return Array.isArray(product?.reviews) ? product.reviews : [];
  }, [averageRating, defaultRatingValue, fallbackItemLabel, feedbacks, product?.reviews]);

  const reviewCount = Math.max(reviews.length, ratings.length, Number(product?.reviewCount) || 0);
  const visibleReviews = reviews.slice(0, 2);

  const handleGalleryScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!gallery.length) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveImageIndex(Math.min(Math.max(nextIndex, 0), gallery.length - 1));
  };

  if (!product) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Product not found</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const saveMyRating = async () => {
    const identity = await getIdentity();
    if (!identity) {
      Alert.alert("Login Required", "You need to be logged in to rate this product.");
      return;
    }

    setSavingRating(true);
    try {
      await setDoc(
        doc(db, "funeral_product_ratings", `${productKey}_${identity.userId}`),
        {
          productKey,
          productId: product.id,
          shopId: product.shopId || null,
          userId: identity.userId,
          userEmail: identity.userEmail,
          displayName: identity.displayName,
          rating,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await createAdminNotification(
        "rating_update",
        "Funeral Product Rating",
        `${identity.displayName || "A user"} rated ${product.name} ${rating}/5.`,
        { productId: product.id, shopId: product.shopId || null, rating }
      );

      Alert.alert("Saved", "Your rating has been saved.");
      await loadReviews();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save your rating.");
    } finally {
      setSavingRating(false);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert("Feedback Required", "Please write your comment before posting.");
      return;
    }

    const identity = await getIdentity();
    if (!identity) {
      Alert.alert("Login Required", "You need to be logged in to comment on this product.");
      return;
    }

    setPostingFeedback(true);
    try {
      await addDoc(collection(db, "funeral_product_feedback"), {
        productKey,
        productId: product.id,
        shopId: product.shopId || null,
        userId: identity.userId,
        userEmail: identity.userEmail,
        displayName: identity.displayName,
        feedback: feedbackText.trim(),
        ratingSnapshot: rating > 0 ? rating : averageRating,
        createdAt: serverTimestamp(),
        updatedAt: null,
      });

      await createAdminNotification(
        "feedback_new",
        "New Funeral Product Feedback",
        `${identity.displayName || "A user"} posted feedback for ${product.name}.`,
        { productId: product.id, shopId: product.shopId || null }
      );

      setFeedbackText("");
      Alert.alert("Posted", "Your feedback has been posted.");
      await loadReviews();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to post feedback.");
    } finally {
      setPostingFeedback(false);
    }
  };

  const handleOpenShop = () => {
    if (product.shopId) {
      navigation.navigate("ShopProducts", {
        shopId: product.shopId,
        shopName: product.shopName || "Verified Shop",
      });
      return;
    }

    navigation.navigate("FuneralTabs", { screen: "Shops" });
  };

  const confirmAddToCart = () => {
    setCartConfirmVisible(true);
  };

  const proceedToCheckout = () => {
    if (!product.shopId) {
      Alert.alert("Unavailable", "This product is missing its shop details.");
      return;
    }

    navigation.navigate("FuneralCheckout", {
      cartItem: {
        cartId: `buy_now_${product.shopId}_${product.id}_${selectedVariationName || "standard"}_${Date.now()}`,
        productId: product.id,
        shopId: product.shopId,
        shopName: product.shopName || "Verified Shop",
        name: product.name,
        price: String(product.price || ""),
        imageUrl: selectedVariation?.imageUrl || gallery[0] || product.imageUrl || null,
        variationName: selectedVariationName,
        quantity: 1,
      },
    });
  };

  const addToCart = async () => {
    if (!product.shopId) {
      Alert.alert("Unavailable", "This product is missing its shop details.");
      return;
    }

    try {
      await addFuneralCartItem({
        productId: product.id,
        shopId: product.shopId,
        shopName: product.shopName || "Verified Shop",
        name: product.name,
        price: String(product.price || ""),
        imageUrl: selectedVariation?.imageUrl || gallery[0] || product.imageUrl || null,
        variationName: selectedVariationName,
      });

      Alert.alert("Added to Cart", selectedVariationName ? `${product.name} (${selectedVariationName}) was added to your cart.` : `${product.name} was added to your cart.`);
      navigation.navigate("FuneralTabs", { screen: "Carts" });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to add this item to your cart.");
    }
  };

  const handleAddToCart = () => {
    if (variationCount > 0) {
      setVariationSheetMode("cart");
      setVariationsVisible(true);
      return;
    }

    confirmAddToCart();
  };

  const handleBuyNow = () => {
    if (variationCount > 0) {
      setVariationSheetMode("buy");
      setVariationsVisible(true);
      return;
    }

    proceedToCheckout();
  };

  const openVariationPreview = (variation: ProductVariation, index: number) => {
    setSelectedVariationName(variation.name || `Option ${index + 1}`);
    if (!variation.imageUrl) return;
    setPreviewVariation({
      name: variation.name || `Option ${index + 1}`,
      imageUrl: variation.imageUrl,
    });
    setVariationPreviewVisible(true);
  };

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 112 + Math.max(insets.bottom, 12) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topIconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#22312d" />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} style={styles.searchPill} onPress={() => navigation.navigate("FuneralTabs", { screen: "Home" })}>
            <Ionicons name="search-outline" size={18} color="#8a928d" />
            <Text numberOfLines={1} style={styles.searchPillText}>
              {product.name}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.topIconButton} onPress={() => Alert.alert("Share", "Share flow is not connected yet.")}>
            <Ionicons name="share-social-outline" size={20} color="#22312d" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.topIconButton} onPress={() => Alert.alert("More", "More actions are not connected yet.")}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#22312d" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          {gallery.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleGalleryScroll}
            >
              {gallery.map((imageUrl, index) => (
                <View key={`${product.id}_${index}`} style={[styles.imagePage, { width }]}>
                  <TouchableOpacity activeOpacity={0.92} onPress={() => setImageViewerVisible(true)}>
                    <Image
                      source={{ uri: imageUrl }}
                      style={[styles.heroImage, { width: imageWidth, height: imageHeight }]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.heroFallback, { width: imageWidth, height: imageHeight }]}>
              <Ionicons name="image-outline" size={40} color="#86908a" />
            </View>
          )}

          <View style={styles.heroFooterRow}>
            <View style={styles.heroStatusBadge}>
              <Text style={styles.heroStatusBadgeText}>
                {gallery.length ? `${activeImageIndex + 1}/${gallery.length}` : "1/1"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{formatPhilippinePeso(priceValue || product.price)}</Text>
          </View>

          <Text style={styles.priceSubtext}>{priceLabel}</Text>

          <View style={styles.ratingRow}>
            <Ionicons name="star" size={15} color="#f59e0b" />
            <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
            <Text style={styles.ratingDivider}>|</Text>
            <Text style={styles.soldText}>{soldCount} sold</Text>
          </View>

          <View style={styles.offerRow}>
            <View style={styles.offerPill}>
              <Text style={styles.offerPillText}>{product.shopName || "Verified Shop"}</Text>
            </View>
            <View style={styles.offerPill}>
              <Text style={styles.offerPillText}>{stockCount > 0 ? `${stockCount} in stock` : "Ask stock"}</Text>
            </View>
            <View style={styles.offerPill}>
              <Text style={styles.offerPillText}>{variationCount > 0 ? `${variationCount} option${variationCount === 1 ? "" : "s"}` : "Standard option"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Product Description</Text>
          <Text style={styles.descriptionText}>{product.description || "No description available."}</Text>

          {variationCount > 0 ? (
            <View style={styles.variationPreviewSection}>
              <Text style={styles.variationPreviewTitle}>Variations</Text>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.variationPreviewRow}
                onPress={() => {
                  setVariationSheetMode("browse");
                  setVariationsVisible(true);
                }}
              >
                <View style={styles.variationLeadIcon}>
                  <Ionicons name="grid-outline" size={18} color="#5a6b64" />
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.variationPreviewList}
                >
                  {variations.slice(0, 6).map((variation, index) => (
                    <View key={`${product.id}_${variation.name}_${index}`} style={styles.variationPreviewThumb}>
                      {variation.imageUrl ? (
                        <Image source={{ uri: variation.imageUrl }} style={styles.variationPreviewImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.variationPreviewFallback}>
                          <Ionicons name="cube-outline" size={14} color="#75807b" />
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>

                <Text numberOfLines={1} style={styles.variationPreviewText}>
                  {selectedVariationName || `${variationCount} option${variationCount === 1 ? "" : "s"} available`}
                </Text>

                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Listing Details</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Availability</Text>
              <Text style={styles.infoValue}>{stockCount > 0 ? "Ready to inquire" : "Ask the shop"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Media</Text>
              <Text style={styles.infoValue}>{gallery.length} product preview{gallery.length === 1 ? "" : "s"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Variants</Text>
              <Text style={styles.infoValue}>{variationCount > 0 ? `${variationCount} selectable options` : "Single configuration"}</Text>
            </View>
          </View>

        </View>

        <View style={styles.panel}>
          <View style={styles.reviewHeaderRow}>
            <Text style={styles.panelTitle}>Customer Reviews ({reviewCount})</Text>
            <TouchableOpacity onPress={() => setReviewsVisible(true)}>
              <Text style={styles.reviewSeeMore}>See more</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reviewSummaryRow}>
            <Text style={styles.reviewSummaryScore}>{averageRating.toFixed(1)}/5</Text>
            <Text style={styles.reviewSummaryStars}>{renderStars(averageRating)}</Text>
          </View>

          {loadingReviews ? (
            <Text style={styles.reviewEmptyText}>Loading reviews...</Text>
          ) : visibleReviews.length === 0 ? (
            <Text style={styles.reviewEmptyText}>No customer reviews yet. Be the first to rate and comment.</Text>
          ) : (
            visibleReviews.map((review, index) => (
              <View key={review.id || `preview_review_${index}`} style={styles.reviewCard}>
                <Text style={styles.reviewAuthor}>{review.reviewerName || `Buyer ${index + 1}`}</Text>
                <Text style={styles.reviewStars}>{renderStars(Number(review.rating) || 5)}</Text>
                <Text style={styles.reviewItemLabel}>{review.itemLabel || "Item: Standard"}</Text>
                <Text style={styles.reviewComment}>{review.comment || "No written feedback yet."}</Text>
                {review.imageUrl ? (
                  <Image source={{ uri: review.imageUrl }} style={styles.reviewImage} resizeMode="cover" />
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Rate & Feedback</Text>
          <Text style={styles.reviewComposerHint}>Tap a star to rate this product, then leave a comment if you want to share more.</Text>

          <View style={styles.ratingPickerRow}>
            {RATING_VALUES.map((value) => (
              <TouchableOpacity
                key={value}
                style={styles.ratingButton}
                activeOpacity={0.85}
                onPress={() => setRating((current) => (current === value ? 0 : value))}
              >
                <Text style={[styles.ratingPickerIcon, value <= rating && styles.ratingPickerIconActive]}>{"\u2605"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, !rating || savingRating ? styles.submitButtonDisabled : null]}
            activeOpacity={0.88}
            disabled={!rating || savingRating}
            onPress={() => void saveMyRating()}
          >
            <Text style={styles.submitButtonText}>{savingRating ? "Saving..." : "Save My Rating"}</Text>
          </TouchableOpacity>

          <TextInput
            multiline
            placeholder="Write your feedback about this product"
            placeholderTextColor="#94a3b8"
            style={styles.feedbackInput}
            value={feedbackText}
            onChangeText={setFeedbackText}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, postingFeedback ? styles.submitButtonDisabled : null]}
            activeOpacity={0.88}
            disabled={postingFeedback}
            onPress={() => void submitFeedback()}
          >
            <Text style={styles.submitButtonText}>{postingFeedback ? "Posting..." : "Post Feedback"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.iconAction}
            onPress={handleOpenShop}
          >
            <Ionicons name="storefront-outline" size={20} color="#22312d" />
          </TouchableOpacity>

        <TouchableOpacity style={styles.cartButton} onPress={() => void handleAddToCart()}>
          <Ionicons name="cart-outline" size={20} color="#22312d" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow}>
          <Ionicons name="flash-outline" size={18} color="#ffffff" />
          <Text style={styles.buyButtonText}>Buy Now</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerCloseButton} onPress={() => setImageViewerVisible(false)}>
            <Ionicons name="close" size={22} color="#ffffff" />
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            contentOffset={{ x: width * activeImageIndex, y: 0 }}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleGalleryScroll}
          >
            {gallery.map((imageUrl, index) => (
              <View key={`viewer_${product.id}_${index}`} style={[styles.viewerPage, { width }]}>
                <Image source={{ uri: imageUrl }} style={styles.viewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>

          <View style={styles.viewerCounter}>
            <Text style={styles.viewerCounterText}>{gallery.length ? `${activeImageIndex + 1}/${gallery.length}` : "1/1"}</Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={variationsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVariationsVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setVariationsVisible(false)} />

          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{variationSheetMode === "cart" ? "Choose Variation" : "Variations"}</Text>
                <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setVariationsVisible(false)}>
                  <Ionicons name="close" size={20} color="#22312d" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {variations.map((variation, index) => (
                  <TouchableOpacity
                    key={`sheet_${product.id}_${variation.name}_${index}`}
                    style={[
                      styles.sheetVariationRow,
                      selectedVariationName === variation.name ? styles.sheetVariationRowActive : null,
                    ]}
                    activeOpacity={0.88}
                    onPress={() => {
                      setSelectedVariationName(variation.name || `Option ${index + 1}`);
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.9}
                      style={styles.sheetVariationThumbLarge}
                      onPress={() => {
                        if (variationSheetMode === "browse") {
                          openVariationPreview(variation, index);
                          return;
                        }
                        setSelectedVariationName(variation.name || `Option ${index + 1}`);
                      }}
                    >
                      {variation.imageUrl ? (
                        <Image source={{ uri: variation.imageUrl }} style={styles.sheetVariationImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.sheetVariationFallback}>
                          <Ionicons name="cube-outline" size={22} color="#75807b" />
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.sheetVariationBody}>
                      <Text style={styles.sheetVariationName}>{variation.name || `Option ${index + 1}`}</Text>
                      <Text style={styles.sheetVariationHint}>
                        {variationSheetMode === "cart" ? "Select this variation for your cart" : "Tap to view this variation clearly"}
                      </Text>
                    </View>
                    {selectedVariationName === variation.name ? (
                      <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {variationSheetMode === "cart" || variationSheetMode === "buy" ? (
                <TouchableOpacity
                  style={[
                    styles.sheetAddToCartButton,
                    variationCount > 0 && !selectedVariationName ? styles.sheetAddToCartButtonDisabled : null,
                  ]}
                  activeOpacity={0.88}
                  disabled={variationCount > 0 && !selectedVariationName}
                  onPress={() => {
                    setVariationsVisible(false);
                    if (variationSheetMode === "buy") {
                      proceedToCheckout();
                      return;
                    }
                    confirmAddToCart();
                  }}
                >
                  <Ionicons name={variationSheetMode === "buy" ? "flash-outline" : "cart-outline"} size={18} color="#ffffff" />
                  <Text style={styles.sheetAddToCartButtonText}>{variationSheetMode === "buy" ? "Continue to Checkout" : "Add to Cart"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
      </Modal>

      <Modal
        visible={reviewsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewsVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setReviewsVisible(false)} />

          <View style={styles.sheetCard}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Reviews ({reviewCount})</Text>
              <TouchableOpacity style={styles.sheetCloseButton} onPress={() => setReviewsVisible(false)}>
                <Ionicons name="close" size={20} color="#22312d" />
              </TouchableOpacity>
            </View>

            <View style={styles.reviewSummaryRow}>
              <Text style={styles.reviewSummaryScore}>{averageRating.toFixed(1)}/5</Text>
              <Text style={styles.reviewSummaryStars}>{renderStars(averageRating)}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {reviews.length === 0 ? (
                <Text style={styles.reviewEmptyText}>No reviews yet.</Text>
              ) : (
                reviews.map((review, index) => (
                  <View key={review.id || `sheet_review_${index}`} style={styles.fullReviewCard}>
                    <Text style={styles.reviewAuthor}>{review.reviewerName || `Buyer ${index + 1}`}</Text>
                    <View style={styles.fullReviewMetaRow}>
                      <Text style={styles.reviewStars}>{renderStars(Number(review.rating) || 5)}</Text>
                      <Text style={styles.fullReviewMetaText}>{review.itemLabel || "Item: Standard"}</Text>
                    </View>
                    <Text style={styles.reviewComment}>{review.comment || "No written feedback yet."}</Text>
                    {review.imageUrl ? (
                      <Image source={{ uri: review.imageUrl }} style={styles.reviewImage} resizeMode="cover" />
                    ) : null}
                    <Text style={styles.fullReviewMetaText}>{review.createdLabel || "Recently posted"}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={cartConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCartConfirmVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="cart-outline" size={22} color="#22312d" />
            </View>
            <Text style={styles.confirmTitle}>Add to Cart</Text>
            <Text style={styles.confirmText}>Add this product to your cart now?</Text>

            <View style={styles.confirmProductRow}>
              <View style={styles.confirmImageWrap}>
                {selectedVariation?.imageUrl || gallery[0] || product.imageUrl ? (
                  <Image
                    source={{ uri: selectedVariation?.imageUrl || gallery[0] || product.imageUrl || "" }}
                    style={styles.confirmImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.confirmImageFallback}>
                    <Ionicons name="cube-outline" size={20} color="#66746f" />
                  </View>
                )}
              </View>
              <View style={styles.confirmBody}>
                <Text style={styles.confirmProductName} numberOfLines={2}>{product.name}</Text>
                {selectedVariationName ? <Text style={styles.confirmVariation}>Variation: {selectedVariationName}</Text> : null}
                <Text style={styles.confirmPrice}>{formatPhilippinePeso(priceValue || product.price)}</Text>
              </View>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmSecondaryButton} onPress={() => setCartConfirmVisible(false)}>
                <Text style={styles.confirmSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPrimaryButton}
                onPress={() => {
                  setCartConfirmVisible(false);
                  void addToCart();
                }}
              >
                <Text style={styles.confirmPrimaryText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={variationPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVariationPreviewVisible(false)}
      >
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerCloseButton} onPress={() => setVariationPreviewVisible(false)}>
            <Ionicons name="close" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.viewerPage}>
            {previewVariation?.imageUrl ? (
              <Image source={{ uri: previewVariation.imageUrl }} style={styles.viewerImage} resizeMode="contain" />
            ) : null}
            <View style={styles.variationViewerLabel}>
              <Text style={styles.variationViewerLabelText}>{previewVariation?.name || "Variation"}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fbfcf8",
  },
  content: {
    backgroundColor: "#fbfcf8",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
  },
  topIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: "#eef1ec",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchPillText: {
    flex: 1,
    color: "#8a928d",
    fontSize: 15,
    fontWeight: "600",
  },
  heroSection: {
    backgroundColor: "#ffffff",
    paddingTop: 16,
    paddingBottom: 16,
  },
  imagePage: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroImage: {
    borderRadius: 28,
    backgroundColor: "#d8ddd7",
  },
  heroFallback: {
    alignSelf: "center",
    borderRadius: 28,
    backgroundColor: "#d8ddd7",
    alignItems: "center",
    justifyContent: "center",
  },
  heroFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 10,
  },
  heroStatusBadge: {
    borderRadius: 999,
    backgroundColor: "#22312d",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroStatusBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  priceSection: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  priceText: {
    color: "#6d7f72",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -1.1,
  },
  priceSubtext: {
    color: "#22312d",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  ratingText: {
    color: "#22312d",
    fontSize: 14,
    fontWeight: "800",
  },
  ratingDivider: {
    color: "#cad5cc",
    fontSize: 14,
    fontWeight: "700",
    marginHorizontal: 2,
  },
  soldText: {
    color: "#66746f",
    fontSize: 14,
    fontWeight: "700",
  },
  offerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  offerPill: {
    borderRadius: 999,
    backgroundColor: "#fbfcf8",
    borderWidth: 1,
    borderColor: "#e4ebe4",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  offerPillText: {
    color: "#66746f",
    fontSize: 12,
    fontWeight: "800",
  },
  panel: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  panelTitle: {
    color: "#22312d",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 10,
  },
  reviewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewSeeMore: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
  },
  reviewEmptyText: {
    color: "#6b7280",
    fontSize: 14,
    fontStyle: "italic",
    marginTop: 2,
  },
  reviewSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  reviewSummaryScore: {
    color: "#22312d",
    fontSize: 26,
    fontWeight: "900",
  },
  reviewSummaryStars: {
    color: "#f59e0b",
    fontSize: 18,
    fontWeight: "900",
  },
  reviewCard: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f4ef",
  },
  fullReviewCard: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#d8ddd7",
  },
  reviewAuthor: {
    color: "#22312d",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },
  reviewStars: {
    color: "#f59e0b",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  reviewItemLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  reviewComment: {
    color: "#22312d",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  reviewImage: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#d8ddd7",
  },
  reviewComposerHint: {
    color: "#75807b",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  ratingPickerRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  ratingButton: {
    marginRight: 8,
  },
  ratingPickerIcon: {
    fontSize: 34,
    color: "#cad5cc",
  },
  ratingPickerIconActive: {
    color: "#f59e0b",
  },
  feedbackInput: {
    minHeight: 112,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e4ebe4",
    backgroundColor: "#fbfcf8",
    color: "#22312d",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  submitButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  variationPreviewSection: {
    marginTop: 18,
  },
  variationPreviewTitle: {
    color: "#22312d",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 10,
  },
  variationPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#fbfcf8",
    borderWidth: 1,
    borderColor: "#e4ebe4",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  variationLeadIcon: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  variationPreviewList: {
    gap: 6,
    paddingHorizontal: 6,
  },
  variationPreviewThumb: {
    width: 34,
    height: 34,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#e4ebe4",
  },
  variationPreviewImage: {
    width: "100%",
    height: "100%",
  },
  variationPreviewFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f4ef",
  },
  variationPreviewText: {
    flex: 1,
    color: "#75807b",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  infoGrid: {
    gap: 10,
    marginBottom: 18,
  },
  infoCard: {
    borderRadius: 18,
    backgroundColor: "#fbfcf8",
    borderWidth: 1,
    borderColor: "#e4ebe4",
    padding: 14,
  },
  infoLabel: {
    color: "#75807b",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  infoValue: {
    color: "#22312d",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  descriptionText: {
    color: "#66746f",
    fontSize: 14,
    lineHeight: 22,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#d8ddd7",
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  iconAction: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#eef1ec",
    alignItems: "center",
    justifyContent: "center",
  },
  cartButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#f2ede5",
    borderWidth: 1,
    borderColor: "#d4c4ae",
    alignItems: "center",
    justifyContent: "center",
  },
  buyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buyButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.96)",
    justifyContent: "center",
  },
  viewerCloseButton: {
    position: "absolute",
    top: 54,
    right: 16,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerPage: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  viewerImage: {
    width: "100%",
    height: "78%",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 44,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewerCounterText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  variationViewerLabel: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  variationViewerLabelText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.34)",
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetCard: {
    maxHeight: "72%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cad5cc",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetTitle: {
    color: "#22312d",
    fontSize: 20,
    fontWeight: "900",
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eef1ec",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetVariationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#fbfcf8",
    borderWidth: 1,
    borderColor: "#e4ebe4",
    padding: 12,
    marginBottom: 10,
  },
  sheetVariationRowActive: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  sheetVariationThumb: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#e4ebe4",
  },
  sheetVariationThumbLarge: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e4ebe4",
  },
  sheetVariationImage: {
    width: "100%",
    height: "100%",
  },
  sheetVariationFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f4ef",
  },
  sheetVariationName: {
    color: "#22312d",
    fontSize: 15,
    fontWeight: "800",
  },
  sheetVariationBody: {
    flex: 1,
    gap: 4,
  },
  sheetVariationHint: {
    color: "#75807b",
    fontSize: 12,
    lineHeight: 18,
  },
  sheetAddToCartButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  sheetAddToCartButtonDisabled: {
    opacity: 0.45,
  },
  sheetAddToCartButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.42)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#d8ddd7",
  },
  confirmIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f2ede5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: {
    color: "#22312d",
    fontSize: 22,
    fontWeight: "900",
  },
  confirmText: {
    color: "#75807b",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  confirmProductRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#fbfcf8",
    borderWidth: 1,
    borderColor: "#e4ebe4",
  },
  confirmImageWrap: {
    width: 74,
    height: 74,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#e4ebe4",
  },
  confirmImage: {
    width: "100%",
    height: "100%",
  },
  confirmImageFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f4ef",
  },
  confirmBody: {
    flex: 1,
    justifyContent: "center",
  },
  confirmProductName: {
    color: "#22312d",
    fontSize: 15,
    fontWeight: "800",
  },
  confirmVariation: {
    color: "#75807b",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  confirmPrice: {
    color: "#6d7f72",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  confirmSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#eef1ec",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSecondaryText: {
    color: "#22312d",
    fontSize: 14,
    fontWeight: "800",
  },
  confirmPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  fullReviewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  fullReviewMetaText: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  emptyTitle: {
    color: "#22312d",
    fontSize: 22,
    fontWeight: "900",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
});
