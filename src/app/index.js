import { router } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../constants/firebase";

export default function Index() {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const emailLimpio = correo.trim();

    if (!emailLimpio || !password) {
      Alert.alert(
        "Campos incompletos",
        "Ingresa tu correo institucional y contraseña.",
      );
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, emailLimpio, password);
      router.replace("/home");
    } catch (error) {
      console.log("Error al iniciar sesión:", error.code);
      Alert.alert(
        "Error de acceso",
        "Correo o contraseña incorrectos. Verifica tus datos.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarPassword = async () => {
    const emailLimpio = correo.trim();

    if (!emailLimpio) {
      Alert.alert(
        "Correo requerido",
        "Escribe primero tu correo institucional para enviarte el enlace.",
      );
      return;
    }

    try {
      await sendPasswordResetEmail(auth, emailLimpio);
      Alert.alert(
        "Correo enviado",
        "Revisa tu bandeja de entrada para restablecer tu contraseña.",
      );
    } catch (error) {
      console.log("Error al enviar recuperación:", error.code);
      Alert.alert(
        "No se pudo enviar",
        "Verifica que el correo esté registrado en el sistema.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.banner}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>✎</Text>
            </View>
            <Text style={styles.brandTitle}>Kanvu</Text>
            <Text style={styles.brandSubtitle}>
              BIENESTAR · ACOMPAÑAMIENTO ESCOLAR
            </Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.welcomeTitle}>Bienvenido de vuelta</Text>
            <Text style={styles.welcomeSubtitle}>
              Inicia sesión con tu cuenta institucional.
            </Text>

            <Text style={styles.label}>CORREO INSTITUCIONAL</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@universidad.edu.mx"
                placeholderTextColor="#A0A0A0"
                value={correo}
                onChangeText={setCorreo}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>CONTRASEÑA</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="•••••••••"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleRecuperarPassword}
            >
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Iniciar sesión</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, backgroundColor: "#FFFFFF" },
  banner: {
    backgroundColor: "#596838",
    paddingTop: 34,
    paddingBottom: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  logoIcon: { fontSize: 26, color: "#FFFFFF" },
  brandTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    color: "#D8E0C5",
    letterSpacing: 2,
    marginTop: 6,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 30,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1E1E1E",
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: "#7A7A7A",
    marginTop: 4,
    marginBottom: 22,
  },
  label: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#7A7A7A",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E2E2",
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  inputIcon: { fontSize: 14, color: "#999999", marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: "#222222" },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 20 },
  forgotText: { fontSize: 12, fontWeight: "600", color: "#596838" },
  loginBtn: {
    backgroundColor: "#596838",
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  loginBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "bold" },
});
