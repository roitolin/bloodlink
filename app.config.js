export default {
  expo: {
    name: "BloodLink",
    slug: "bloodlink",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/Logo.png",
    scheme: "bloodlink",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/Logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.Roi.bloodlink",
    },
    android: {
      package: "com.Roi.bloodlink",
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/LogoAdaptive.png",
        backgroundColor: "#ffffff",
      },
      permissions: [],
    },
    plugins: ["@react-native-community/datetimepicker", "expo-font", "expo-sharing"],
    extra: {
      eas: {
        projectId: "YOUR_EAS_PROJECT_ID",
      },
    },
  },
};
