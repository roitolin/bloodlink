import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const slides = [
  {
    id: "first",
    image: require("../../../assets/Mobile Landing/First Swipe.png"),
    kicker: "Donate Faster",
    title: "Find blood donors faster",
    body: "Browse BloodLink in a quick intro before login, then continue to requests, donors, and urgent community needs.",
    accent: "#ef4444",
  },
  {
    id: "second",
    image: require("../../../assets/Mobile Landing/Second Swipe..png"),
    kicker: "Welcome to BloodLink",
    title: "Get started with BloodLink",
    body: "Swipe up on the last card to continue, or tap the button below when you are ready to log in.",
    accent: "#fb7185",
  },
];

export default function MobileLandingScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const screenIntro = useRef(new Animated.Value(0)).current;
  const ctaPulse = useRef(new Animated.Value(1)).current;
  const swipeFloat = useRef(new Animated.Value(0)).current;

  const horizontalInset = Math.max(16, Math.round(width * 0.06));
  const cardGap = 14;
  const cardWidth = width - horizontalInset * 2;
  const cardHeight = Math.min(Math.max(height - 198, 520), 700);
  const imageHeight = Math.min(Math.max(cardHeight * 0.47, 240), 380);
  const isLastSlide = activeIndex === slides.length - 1;

  const goToLogin = useCallback(() => {
    navigation.replace("Login");
  }, [navigation]);

  useEffect(() => {
    Animated.timing(screenIntro, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [screenIntro]);

  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      tension: 72,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, entrance]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.spring(ctaPulse, {
          toValue: 1.045,
          tension: 90,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(ctaPulse, {
          toValue: 1,
          tension: 90,
          friction: 10,
          useNativeDriver: true,
        }),
      ])
    );

    const swipeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swipeFloat, {
          toValue: -8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(swipeFloat, {
          toValue: 0,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();
    swipeLoop.start();

    return () => {
      pulseLoop.stop();
      swipeLoop.stop();
    };
  }, [ctaPulse, swipeFloat]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          isLastSlide &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy < -10,
        onPanResponderRelease: (_, gestureState) => {
          if (isLastSlide && gestureState.dy < -70) {
            goToLogin();
          }
        },
      }),
    [goToLogin, isLastSlide]
  );

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / (cardWidth + cardGap));
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, nextIndex)));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <Animated.View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, 8) },
          {
            opacity: screenIntro,
            transform: [
              {
                translateY: screenIntro.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View>
          <Text style={styles.headerKicker}>BloodLink</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="water" size={18} color="#d32f2f" />
        </View>
      </Animated.View>

      <Animated.ScrollView
        horizontal
        decelerationRate="fast"
        snapToInterval={cardWidth + cardGap}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: horizontalInset,
          paddingTop: 18,
          paddingBottom: 18 + Math.max(insets.bottom, 10),
        }}
        onMomentumScrollEnd={handleMomentumEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
      >
        {slides.map((slide, index) => {
          const inputRange = [(index - 1) * (cardWidth + cardGap), index * (cardWidth + cardGap), (index + 1) * (cardWidth + cardGap)];
          const translateY = scrollX.interpolate({
            inputRange,
            outputRange: [22, 0, 22],
            extrapolate: "clamp",
          });
          const translateX = scrollX.interpolate({
            inputRange,
            outputRange: [18, 0, -18],
            extrapolate: "clamp",
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.955, 1, 0.955],
            extrapolate: "clamp",
          });
          const rotate = scrollX.interpolate({
            inputRange,
            outputRange: ["2deg", "0deg", "-2deg"],
            extrapolate: "clamp",
          });
          const cardOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.78, 1, 0.78],
            extrapolate: "clamp",
          });
          const imageShift = scrollX.interpolate({
            inputRange,
            outputRange: [-28, 0, 28],
            extrapolate: "clamp",
          });
          const imageScale = scrollX.interpolate({
            inputRange,
            outputRange: [1.06, 1, 1.06],
            extrapolate: "clamp",
          });
          const contentShift = scrollX.interpolate({
            inputRange,
            outputRange: [16, 0, -16],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={slide.id}
              style={[
                styles.cardWrap,
                {
                  width: cardWidth,
                  height: cardHeight,
                  marginRight: index === slides.length - 1 ? 0 : cardGap,
                  opacity: cardOpacity,
                  transform: [{ translateY }, { translateX }, { rotate }, { scale }],
                },
              ]}
            >
              <View style={styles.cardShadow} />
              <View style={styles.card}>
                <View style={[styles.imageShell, { height: imageHeight }]}>
                  <Animated.Image
                    source={slide.image}
                    resizeMode="cover"
                    style={[
                      styles.image,
                      {
                        transform: [{ translateX: imageShift }, { scale: imageScale }],
                      },
                    ]}
                  />
                </View>

                <Animated.View
                  style={[
                    styles.contentPanel,
                    {
                      opacity: entrance,
                      transform: [
                        {
                          translateX: contentShift,
                        },
                        {
                          translateY: entrance.interpolate({
                            inputRange: [0, 1],
                            outputRange: [28, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.copyBlock}>
                    <Text style={[styles.kicker, { color: slide.accent }]}>{slide.kicker}</Text>
                    <Text style={styles.title}>{slide.title}</Text>
                    <Text style={styles.body}>{slide.body}</Text>
                  </View>

                  {index === 0 ? (
                    <View style={styles.footerRow}>
                      <View style={styles.swipePill}>
                        <Ionicons name="arrow-forward" size={16} color="#fca5a5" />
                        <Text style={styles.swipePillText}>Swipe left to continue</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.ctaBlock} {...panResponder.panHandlers}>
                      <Animated.View style={{ transform: [{ scale: ctaPulse }] }}>
                        <Pressable style={styles.primaryButton} onPress={goToLogin}>
                          <Text style={styles.primaryButtonText}>Get Started</Text>
                        </Pressable>
                      </Animated.View>

                      <Animated.View
                        style={[
                          styles.swipeUpBlock,
                          {
                            transform: [{ translateY: swipeFloat }],
                          },
                        ]}
                      >
                        <Ionicons name="chevron-up" size={24} color="#ef4444" />
                        <Text style={styles.swipeUpText}>Swipe up to continue</Text>
                      </Animated.View>

                      <Pressable style={styles.secondaryButton} onPress={goToLogin}>
                        <Text style={styles.secondaryButtonText}>Continue to Login</Text>
                      </Pressable>
                    </View>
                  )}
                </Animated.View>
              </View>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff7f7",
  },
  glowTop: {
    position: "absolute",
    top: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "#ffe1e1",
  },
  glowBottom: {
    position: "absolute",
    right: -110,
    bottom: 20,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "#ffd4d4",
  },
  header: {
    paddingTop: 8,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
  },
  headerKicker: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  cardWrap: {
    position: "relative",
  },
  cardShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    backgroundColor: "#ef4444",
    opacity: 0.08,
    transform: [{ translateY: 10 }, { scale: 0.99 }],
  },
  card: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ffe4e6",
  },
  imageShell: {
    overflow: "hidden",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "#f7f5f3",
  },
  image: {
    width: "112%",
    height: "100%",
    marginLeft: "-6%",
  },
  contentPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 24 : 18,
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#ffe4e6",
  },
  copyBlock: {
    gap: 7,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  title: {
    color: "#b91c1c",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  body: {
    color: "#6b7280",
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 290,
  },
  footerRow: {
    marginTop: 18,
    alignItems: "flex-start",
  },
  swipePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  swipePillText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "700",
  },
  ctaBlock: {
    marginTop: 14,
    alignItems: "center",
    gap: 12,
  },
  primaryButton: {
    minWidth: 190,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    paddingHorizontal: 30,
    shadowColor: "#ef4444",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
  },
  swipeUpBlock: {
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  swipeUpText: {
    color: "#991b1b",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    minWidth: 180,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  secondaryButtonText: {
    color: "#b91c1c",
    fontSize: 15,
    fontWeight: "800",
  },
});

