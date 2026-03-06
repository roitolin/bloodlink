import { useState } from "react";
import { View, TextInput, Button, Alert, StyleSheet } from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../services/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Please enter your full name.");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        fullName: fullName.trim(),
        role: "user",
        createdAt: new Date(),
      });
      Alert.alert("Success", "Registration successful! You can now log in.");
      navigation.navigate("Login");
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("Registration Failed", "Email already in use.");
      } else if (error.code === "auth/weak-password") {
        Alert.alert("Registration Failed", "Password should be at least 6 characters.");
      } else {
        Alert.alert("Registration Failed", error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        style={styles.input}
      />
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <Button title="Register" onPress={handleRegister} />
      <Button title="Back to Login" onPress={() => navigation.navigate("Login")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, justifyContent: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 15 },
});