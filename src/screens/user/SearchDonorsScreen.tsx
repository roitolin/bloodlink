import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  TouchableOpacity,
} from "react-native";
import { Card, Text, Avatar, Button, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import * as Location from "expo-location";
import { db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import OsmMapEmbed from "../../components/OsmMapEmbed";
import { useAuth } from "../../context/AuthContext";
import { rankDonors } from "../../utils/donorRanking";
import { parseTimestampToDate } from "../../utils/requestSla";
import { getDonorLocationText } from "../../utils/privacy";
import { findPhilippinePlaceMatch, getPhilippinePlaceSuggestions } from "../../utils/philippinePlaces";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const DEFAULT_CENTER = { latitude: 14.5995, longitude: 120.9842 };
const CITY_FALLBACK_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  cebu: { latitude: 10.3157, longitude: 123.8854 },
  "cebu city": { latitude: 10.3157, longitude: 123.8854 },
  manila: { latitude: 14.5995, longitude: 120.9842 },
};

interface Donor {
  id: string;
  fullName?: string;
  bloodType?: string;
  city?: string;
  contactNumber?: string;
  photoURL?: string;
  medicalCertificateURL?: string;
  donorStatus?: string;
  availabilityStatus?: string;
  availableSince?: any;
  location?: { latitude: number; longitude: number };
  distanceKm?: number;
  smartRankScore?: number;
  smartRankReasons?: string[];
  smartRankTier?: "excellent" | "good" | "fair";
}

const haversineDistanceKm = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(end.latitude - start.latitude);
  const dLon = toRad(end.longitude - start.longitude);
  const lat1 = toRad(start.latitude);
  const lat2 = toRad(end.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const geocodeCity = async (cityName: string): Promise<{ latitude: number; longitude: number } | null> => {
  const queryText = findPhilippinePlaceMatch(cityName) || cityName.trim();
  if (!queryText) return null;

  const nominatimQueries = [
    `${queryText}, Philippines`,
    `${queryText} municipality, Philippines`,
    `${queryText} city, Philippines`,
    queryText,
  ];
  for (const q of nominatimQueries) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ph&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
        {
          headers: {
            "Accept-Language": "en",
          },
        }
      );
      if (!response.ok) continue;
      const payload = await response.json();
      const first = Array.isArray(payload)
        ? payload.find((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon)))
        : null;
      if (!first) continue;

      const latitude = Number(first.lat);
      const longitude = Number(first.lon);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    } catch {
      // continue to other geocoding fallbacks
    }
  }

  try {
    const photonResponse = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(`${queryText} Philippines`)}&limit=1&lang=en`
    );
    if (photonResponse.ok) {
      const photonPayload = await photonResponse.json();
      const coordinates = photonPayload?.features?.[0]?.geometry?.coordinates;
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        const longitude = Number(coordinates[0]);
        const latitude = Number(coordinates[1]);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          return { latitude, longitude };
        }
      }
    }
  } catch {
    // continue to fallback table
  }

  return CITY_FALLBACK_CENTERS[queryText.toLowerCase()] || null;
};

export default function SearchDonorsScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const currentUserId = user?.uid;
  const initialDraft = route.params?.draft || {};
  const [selectedBloodType, setSelectedBloodType] = useState<string>(initialDraft.selectedBloodType || "");
  const [city, setCity] = useState<string>(initialDraft.city || "");
  const [searchRadiusKm, setSearchRadiusKm] = useState<string>(initialDraft.searchRadiusKm || "10");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(Boolean(initialDraft.showAdvancedFilters));
  const [centerLocation, setCenterLocation] = useState<{ latitude: number; longitude: number } | null>(
    route.params?.selectedLocation || null
  );
  const [donors, setDonors] = useState<Donor[]>([]);
  const [requesterProfile, setRequesterProfile] = useState<{
    city?: string;
    bloodType?: string;
    location?: { latitude: number; longitude: number };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownHiddenCount, setCooldownHiddenCount] = useState(0);
  const [cityLookupLoading, setCityLookupLoading] = useState(false);
  const latestSearchRef = useRef(0);
  const lastResetTokenRef = useRef<number | null>(null);
  const lastRefreshTokenRef = useRef<number | null>(null);
  const { isDesktop } = useResponsive();
  const placeSuggestions = useMemo(
    () => (showAdvancedFilters ? getPhilippinePlaceSuggestions(city, city.trim() ? 8 : 6) : []),
    [city, showAdvancedFilters]
  );
  const shouldShowPlaceSuggestions = showAdvancedFilters && placeSuggestions.length > 0 && city.trim().length > 0;

  useEffect(() => {
    if (route.params?.draft) {
      const returnedDraft = route.params.draft;
      setSelectedBloodType(returnedDraft.selectedBloodType || "");
      setCity(returnedDraft.city || "");
      setSearchRadiusKm(returnedDraft.searchRadiusKm || "10");
      setShowAdvancedFilters(Boolean(returnedDraft.showAdvancedFilters));
    }
    if (route.params?.selectedLocation) {
      setCenterLocation(route.params.selectedLocation);
      const mapAddress = route.params?.selectedAddress;
      const autoCity = mapAddress?.city || mapAddress?.subregion || "";
      if (autoCity) setCity(autoCity);
    }
  }, [route.params?.fromMapPicker, route.params?.selectedLocation, route.params?.selectedAddress, route.params?.draft]);

  useEffect(() => {
    if (!user) {
      setSelectedBloodType("");
      setCity("");
      setSearchRadiusKm("10");
      setShowAdvancedFilters(false);
      setCenterLocation(null);
      setDonors([]);
      setError(null);
      setRequesterProfile(null);
    }
  }, [user]);

  useEffect(() => {
    const loadRequesterProfile = async () => {
      if (!currentUserId) {
        setRequesterProfile(null);
        return;
      }
      try {
        const profileSnap = await getDoc(doc(db, "users", currentUserId));
        if (!profileSnap.exists()) {
          setRequesterProfile(null);
          return;
        }

        const data = profileSnap.data() as any;
        const profileLocation =
          typeof data?.location?.latitude === "number" && typeof data?.location?.longitude === "number"
            ? { latitude: data.location.latitude, longitude: data.location.longitude }
            : undefined;

        setRequesterProfile({
          city: data?.city || "",
          bloodType: data?.bloodType || "",
          location: profileLocation,
        });
      } catch {
        setRequesterProfile(null);
      }
    };

    loadRequesterProfile();
  }, [currentUserId]);

  const searchDonors = useCallback(async () => {
    const searchId = ++latestSearchRef.current;
    setLoading(true);
    setError(null);

    try {
      let effectiveCenter = centerLocation;

      if (showAdvancedFilters && city.trim()) {
        setCityLookupLoading(true);
        const cityLocation = await geocodeCity(city);
        if (searchId !== latestSearchRef.current) return;
        if (cityLocation) {
          effectiveCenter = cityLocation;
          setCenterLocation((prev) => {
            if (!prev) return cityLocation;
            const delta = haversineDistanceKm(prev, cityLocation);
            return delta > 0.01 ? cityLocation : prev;
          });
        }
        setCityLookupLoading(false);
      }

      const conditions = [
        where("availabilityStatus", "==", "available"),
        where("bloodType", "!=", null),
      ];
      if (selectedBloodType) conditions.push(where("bloodType", "==", selectedBloodType));

      const q = query(collection(db, "users"), ...conditions);
      const snapshot = await getDocs(q);
      if (searchId !== latestSearchRef.current) return;
      let list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Donor[];

      if (currentUserId) list = list.filter((donor) => donor.id !== currentUserId);

      const now = Date.now();
      let hiddenCount = 0;
      list = list.filter((donor) => {
        const cooldownUntil = parseTimestampToDate((donor as any).donationCooldownUntil);
        if (!cooldownUntil) return true;
        const isInCooldown = cooldownUntil.getTime() > now;
        if (isInCooldown) hiddenCount += 1;
        return !isInCooldown;
      });
      setCooldownHiddenCount(hiddenCount);

      const normalizedCity = showAdvancedFilters ? city.trim().toLowerCase() : "";
      if (normalizedCity) {
        list = list.filter((donor) => donor.city?.toLowerCase().includes(normalizedCity));
      }

      const rankingCenter =
        effectiveCenter ||
        (requesterProfile?.location
          ? {
              latitude: requesterProfile.location.latitude,
              longitude: requesterProfile.location.longitude,
            }
          : null);

      if (rankingCenter) {
        list = list.map((donor) => {
          if (!donor.location) return donor;
          return {
            ...donor,
            distanceKm: haversineDistanceKm(rankingCenter, donor.location),
          };
        });
      }

      const radius = Number(searchRadiusKm);
      if (showAdvancedFilters && rankingCenter && Number.isFinite(radius) && radius > 0) {
        list = list.filter((donor) => typeof donor.distanceKm !== "number" || donor.distanceKm <= radius);
      }

      const rankedDonors = rankDonors(list, {
        selectedBloodType,
        preferredCity: (showAdvancedFilters ? city : "") || requesterProfile?.city || "",
      });

      setDonors(rankedDonors);
    } catch (err: any) {
      console.error(err);
      if (searchId !== latestSearchRef.current) return;
      setError(
        err.code === "failed-precondition"
          ? "Database index missing. Please wait a few minutes and try again."
          : "Search failed. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCityLookupLoading(false);
    }
  }, [selectedBloodType, city, currentUserId, centerLocation, searchRadiusKm, showAdvancedFilters, requesterProfile]);

  useEffect(() => {
    searchDonors();
  }, [route.params?.fromMapPicker, searchDonors]);

  useEffect(() => {
    const resetToken = route.params?.resetFilters;
    if (!resetToken || resetToken === lastResetTokenRef.current) return;
    lastResetTokenRef.current = resetToken;
    setSelectedBloodType("");
    setCity("");
    setSearchRadiusKm("10");
    setShowAdvancedFilters(false);
    setCenterLocation(null);
  }, [route.params?.resetFilters]);

  useEffect(() => {
    const refreshToken = route.params?.refreshToken;
    if (!refreshToken || refreshToken === lastRefreshTokenRef.current) return;
    lastRefreshTokenRef.current = refreshToken;
    setRefreshing(true);
    void searchDonors();
  }, [route.params?.refreshToken, searchDonors]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (showAdvancedFilters && city.trim().length >= 3) {
        searchDonors();
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [city, searchDonors, showAdvancedFilters]);

  const onRefresh = () => {
    setRefreshing(true);
    searchDonors();
  };

  const useMyLocationForSearch = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setError("Location permission denied.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCenterLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      setError(null);
    } catch (err: any) {
      Alert.alert("Location Error", err?.message || "Unable to fetch your current location.");
    }
  };

  const openCenterInGoogleMaps = async () => {
    const mapCenter = centerLocation || donors.find((item) => item.location)?.location || DEFAULT_CENTER;
    const url = `https://www.google.com/maps/search/?api=1&query=${mapCenter.latitude},${mapCenter.longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Unable to open Google Maps.");
    }
  };

  const openDonorDetails = useCallback(
    (donorId: string) => {
      navigation.navigate("DonorDetail", { donorId });
    },
    [navigation]
  );

  const renderDonor = ({ item }: { item: Donor }) => (
    <Card style={styles.card} mode="elevated" onPress={() => openDonorDetails(item.id)}>
      <Card.Content style={styles.donorCardContent}>
        <View style={styles.donorTopRow}>
          <View style={styles.donorIdentityWrap}>
            {item.photoURL ? (
              <Avatar.Image size={52} source={{ uri: item.photoURL }} />
            ) : (
              <Avatar.Icon size={52} icon="account" style={styles.donorAvatarFallback} />
            )}
            <View style={styles.donorIdentityText}>
              <Text style={styles.donorName}>{item.fullName || "Anonymous"}</Text>
              <View style={styles.donorMetaRow}>
                <View style={styles.bloodTypeBadge}>
                  <Text style={styles.bloodTypeBadgeText}>{item.bloodType || "N/A"}</Text>
                </View>
                {item.medicalCertificateURL ? (
                  <View style={styles.verifiedStatusPill}>
                    <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                    <Text style={styles.verifiedStatusText}>Verified</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
        {typeof item.smartRankScore === "number" && (
          <View style={styles.rankRow}>
            <View style={[styles.rankPill, item.smartRankTier === "excellent" && styles.rankPillExcellent, item.smartRankTier === "good" && styles.rankPillGood]}>
              <Text style={styles.rankPillText}>Smart Rank {item.smartRankScore}/100</Text>
            </View>
            {item.smartRankReasons?.length ? (
              <Text style={styles.rankReasonText}>{item.smartRankReasons.join(" | ")}</Text>
            ) : null}
          </View>
        )}
        <View style={styles.infoChipList}>
          <View style={styles.infoChip}>
            <Ionicons name="location-outline" size={14} color="#9f1239" />
            <Text style={styles.infoChipText}>{getDonorLocationText(item, false)}</Text>
          </View>
          <View style={styles.infoChip}>
            <Ionicons name="call-outline" size={14} color="#9f1239" />
            <Text style={styles.infoChipText}>{item.contactNumber || "Not provided"}</Text>
          </View>
          {typeof item.distanceKm === "number" ? (
            <View style={styles.infoChip}>
              <Ionicons name="navigate-outline" size={14} color="#9f1239" />
              <Text style={styles.infoChipText}>{item.distanceKm.toFixed(1)} km away</Text>
            </View>
          ) : null}
        </View>
      </Card.Content>
      <Card.Actions style={styles.donorActions}>
        <Button mode="text" textColor="#7f1d1d" onPress={() => openDonorDetails(item.id)}>
          View Details
        </Button>
        <Button
          mode="contained"
          buttonColor="#7f1d1d"
          onPress={() =>
            navigation.navigate("CreateRequest", {
              fromFindDonor: true,
              prefilledBloodType: item.bloodType,
              donorContext: {
                donorId: item.id,
                fullName: item.fullName || "Donor",
                bloodType: item.bloodType || "",
                contactNumber: item.contactNumber || "",
                city: item.city || "",
                location: item.location || null,
              },
            })
          }
        >
          Request Blood
        </Button>
      </Card.Actions>
    </Card>
  );

  const firstMappableDonor = donors.find((item) => item.location);
  const mapCenter = centerLocation || firstMappableDonor?.location || DEFAULT_CENTER;

  const mapMarkers = useMemo(() => {
    // Privacy rule: exact donor coordinates are hidden until a request is accepted.
    return [];
  }, []);

  const headerComponent = (
    <View>
      <View style={styles.heroShell}>
        <View style={styles.heroGlowPrimary} pointerEvents="none" />
        <View style={styles.heroGlowSecondary} pointerEvents="none" />
        <View style={styles.pageHeader}>
          <Text style={styles.heroEyebrow}>Find Donors</Text>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.pageTitle}>Search your best matches</Text>
              <Text style={styles.pageSubtitle}>
                Browse available donors instantly. Smart ranking automatically prioritizes the best donor matches first.
              </Text>
            </View>
            <View style={styles.heroLiveBadge}>
              <Ionicons name="pulse-outline" size={15} color="#fff" />
              <Text style={styles.heroLiveBadgeText}>Live</Text>
            </View>
          </View>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Area</Text>
              <Text style={styles.heroStatValue}>{city || requesterProfile?.city || "Any location"}</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatLabel}>Blood type</Text>
              <Text style={styles.heroStatValue}>{selectedBloodType || "Any type"}</Text>
            </View>
          </View>
          <View style={styles.heroPillsRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Smart ranking</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Nearby donors</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Map search</Text>
            </View>
          </View>
        </View>
      </View>

      <Card style={styles.filterCard}>
        <Card.Content style={styles.filterCardContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEyebrow}>Filters</Text>
            <Text style={styles.sectionTitle}>Refine your search</Text>
          </View>
          <View style={styles.inlineToggleRow}>
            <View style={styles.filterIntro}>
              <Text style={styles.filterFieldLabel}>Blood Type</Text>
              <Text style={styles.filterFieldHint}>Choose a specific blood type or search all.</Text>
            </View>
            <TouchableOpacity
              style={[styles.filterTogglePill, showAdvancedFilters && styles.filterTogglePillOn]}
              onPress={() => setShowAdvancedFilters((prev) => !prev)}
              accessibilityRole="switch"
              accessibilityState={{ checked: showAdvancedFilters }}
              accessibilityLabel="Advanced Filters"
            >
              <View style={[styles.filterToggleTrack, showAdvancedFilters && styles.filterToggleTrackOn]}>
                <View style={[styles.filterToggleThumb, showAdvancedFilters && styles.filterToggleThumbOn]} />
              </View>
              <View style={styles.filterToggleCopy}>
                <Text style={[styles.filterToggleText, showAdvancedFilters && styles.filterToggleTextOn]}>
                  Advanced Filters
                </Text>
                <Text style={[styles.filterToggleState, showAdvancedFilters && styles.filterToggleStateOn]}>
                  {showAdvancedFilters ? "Enabled" : "Off"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <Picker selectedValue={selectedBloodType} onValueChange={setSelectedBloodType} style={styles.picker}>
            <Picker.Item label="Any" value="" />
            {BLOOD_TYPES.map((type) => (
              <Picker.Item key={type} label={type} value={type} />
            ))}
          </Picker>

          {showAdvancedFilters && (
            <>
              <Text style={styles.filterLabel}>City / Municipality</Text>
              <TextInput
                mode="outlined"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Manila or Bacnotan"
                style={styles.input}
              />
              {shouldShowPlaceSuggestions ? (
                <View style={styles.placeSuggestions}>
                  {placeSuggestions.map((item) => (
                    <TouchableOpacity key={item} style={styles.placeSuggestionItem} onPress={() => setCity(item)}>
                      <Text style={styles.placeSuggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={styles.filterLabel}>Distance Range (km)</Text>
              <TextInput
                mode="outlined"
                value={searchRadiusKm}
                onChangeText={setSearchRadiusKm}
                placeholder="e.g. 10"
                keyboardType="number-pad"
                style={styles.input}
              />

              <View style={styles.locationActions}>
                <Button mode="outlined" textColor="#7f1d1d" onPress={useMyLocationForSearch}>
                  Use My Location
                </Button>
                <Button
                  mode="outlined"
                  textColor="#7f1d1d"
                  onPress={() =>
                    navigation.navigate("MapLocationPicker", {
                      returnScreen: "SearchDonors",
                      initialLocation: centerLocation,
                      draft: { selectedBloodType, city, searchRadiusKm, showAdvancedFilters },
                    })
                  }
                >
                  Pin Search Area
                </Button>
              </View>
            </>
          )}

          <Button
            mode="contained"
            buttonColor="#7f1d1d"
            onPress={searchDonors}
            loading={loading}
            disabled={loading}
            style={styles.searchButton}
            labelStyle={styles.searchButtonLabel}
          >
            Search Donors
          </Button>
          {showAdvancedFilters && cityLookupLoading && <Text style={styles.lookupHint}>Locating city or municipality on map...</Text>}
        </Card.Content>
      </Card>

      {showAdvancedFilters && (
        <Card style={styles.mapCard}>
          <Card.Content style={styles.mapContent}>
            <View style={styles.mapHeaderRow}>
              <Text style={styles.mapTitle}>Donor Map</Text>
              <Button mode="text" textColor="#7f1d1d" onPress={openCenterInGoogleMaps} compact>
                Open in Google Maps
              </Button>
            </View>
            <OsmMapEmbed
              latitude={mapCenter.latitude}
              longitude={mapCenter.longitude}
              height={290}
              zoom={12}
              markers={mapMarkers}
              selectedLocation={centerLocation}
            />
            <Text style={styles.mapPrivacyHint}>Donor exact pins are hidden for privacy until request acceptance.</Text>
          </Card.Content>
        </Card>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsHeaderEyebrow}>Results</Text>
        <Text style={styles.resultsHeaderText}>
          {loading ? "Searching donors..." : `${donors.length} donor${donors.length === 1 ? "" : "s"} found`}
        </Text>
        {cooldownHiddenCount > 0 && (
          <Text style={styles.cooldownHint}>
            {cooldownHiddenCount} donor{cooldownHiddenCount === 1 ? "" : "s"} temporarily hidden due to donation cooldown.
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.backgroundOrbTop} pointerEvents="none" />
      <View style={styles.backgroundOrbBottom} pointerEvents="none" />
      <FlatList
        data={donors}
        keyExtractor={(item) => item.id}
        renderItem={renderDonor}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={headerComponent}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No donors found</Text>
              <Text style={styles.emptyHint}>Try adjusting city or distance filters, then search again.</Text>
              <Button mode="contained-tonal" onPress={() => navigation.navigate("CreateRequest")} style={styles.emptyAction}>
                Create Blood Request
              </Button>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f6f2ec" },
  containerDesktop: { maxWidth: 1040, alignSelf: "center", width: "100%" },
  backgroundOrbTop: {
    position: "absolute",
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: 20,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(251, 146, 60, 0.08)",
  },
  heroShell: {
    position: "relative",
    marginBottom: 10,
  },
  heroGlowPrimary: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 40,
    height: 110,
    borderRadius: 28,
    backgroundColor: "rgba(190, 24, 93, 0.14)",
  },
  heroGlowSecondary: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(249, 115, 22, 0.13)",
  },
  pageHeader: {
    marginBottom: 10,
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 28,
    padding: 14,
  },
  heroEyebrow: {
    color: "#fecdd3",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroLiveBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    color: "#fffaf5",
  },
  pageSubtitle: {
    marginTop: 8,
    color: "#ffe4e6",
    fontSize: 14,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroStatCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroStatLabel: {
    color: "#fecdd3",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroStatValue: {
    marginTop: 4,
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: "#9f1239",
    fontSize: 12,
    fontWeight: "800",
  },
  filterCard: {
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eadfd5",
    backgroundColor: "#fffdf9",
  },
  filterCardContent: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionTitle: {
    marginTop: 2,
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  filterIntro: {
    flex: 1,
    paddingRight: 6,
  },
  picker: { height: 50, width: "100%" },
  inlineToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  filterTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#d7dde7",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
  },
  filterTogglePillOn: {
    borderColor: "#f0b9be",
    backgroundColor: "#fff3f4",
  },
  filterToggleTrack: {
    width: 32,
    height: 19,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  filterToggleTrackOn: {
    backgroundColor: "#dc2626",
  },
  filterToggleThumb: {
    width: 15,
    height: 15,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  filterToggleThumbOn: {
    alignSelf: "flex-end",
  },
  filterToggleCopy: {
    gap: 1,
  },
  filterToggleText: {
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 14,
  },
  filterToggleTextOn: {
    color: "#991b1b",
  },
  filterToggleState: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterToggleStateOn: {
    color: "#b91c1c",
  },
  filterFieldLabel: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  filterFieldHint: {
    marginTop: 2,
    color: "#6b7280",
    fontSize: 12,
  },
  filterLabel: {
    marginTop: 12,
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  input: { marginVertical: 5 },
  placeSuggestions: {
    marginTop: 2,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  placeSuggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  placeSuggestionText: {
    color: "#1f2937",
    fontSize: 14,
  },
  locationActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  searchButton: {
    marginTop: 12,
    borderRadius: 14,
  },
  searchButtonLabel: {
    fontSize: 15,
    fontWeight: "900",
  },
  lookupHint: {
    marginTop: 8,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "600",
  },
  mapCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eadfd5",
    backgroundColor: "#fffdf9",
  },
  mapContent: {
    paddingBottom: 14,
  },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mapTitle: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
  },
  mapPrivacyHint: {
    marginTop: 6,
    color: "#92400e",
    fontSize: 12,
    fontWeight: "600",
  },
  resultsHeader: {
    marginTop: 8,
    marginBottom: 10,
  },
  resultsHeaderEyebrow: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  resultsHeaderText: {
    marginTop: 2,
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  cooldownHint: {
    marginTop: 4,
    color: "#92400e",
    fontWeight: "600",
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 36,
    flexGrow: 1,
  },
  error: {
    color: "#dc2626",
    marginBottom: 8,
    fontWeight: "600",
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: "#eadfd5",
    borderRadius: 24,
    backgroundColor: "#fffdf9",
    padding: 18,
    marginTop: 14,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  emptyHint: {
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 10,
  },
  emptyAction: {
    borderRadius: 12,
  },
  card: {
    marginBottom: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#eadfd5",
    backgroundColor: "#fff",
  },
  donorCardContent: {
    paddingBottom: 8,
  },
  donorTopRow: {
    marginBottom: 10,
  },
  donorIdentityWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  donorAvatarFallback: {
    backgroundColor: "#fde2e8",
  },
  donorIdentityText: {
    flex: 1,
  },
  donorName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  donorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  bloodTypeBadge: {
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bloodTypeBadgeText: {
    color: "#9f1239",
    fontSize: 12,
    fontWeight: "900",
  },
  rankRow: {
    marginBottom: 7,
    gap: 4,
  },
  rankPill: {
    alignSelf: "flex-start",
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rankPillExcellent: {
    backgroundColor: "#dcfce7",
  },
  rankPillGood: {
    backgroundColor: "#fef9c3",
  },
  rankPillText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 12,
  },
  rankReasonText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "600",
  },
  verifiedStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  verifiedStatusText: {
    color: "#15803d",
    fontSize: 12,
    fontWeight: "800",
  },
  infoChipList: {
    gap: 8,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#fff8ef",
    borderWidth: 1,
    borderColor: "#f3e5d1",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  infoChipText: {
    flex: 1,
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  donorActions: {
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
});


