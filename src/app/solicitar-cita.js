import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../constants/firebase";

const MESES_2026 = [
  { year: 2026, month: 10, label: "Noviembre 2026" },
  { year: 2026, month: 11, label: "Diciembre 2026" },
];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const MODALIDADES = ["Presencial", "En línea"];

const HORARIOS_40_MIN = [
  { id: "09:00-09:40", inicio: "9:00 am", fin: "9:40 am" },
  { id: "09:40-10:20", inicio: "9:40 am", fin: "10:20 am" },
  { id: "10:20-11:00", inicio: "10:20 am", fin: "11:00 am" },
  { id: "11:00-11:40", inicio: "11:00 am", fin: "11:40 am" },
  { id: "11:40-12:20", inicio: "11:40 am", fin: "12:20 pm" },
  { id: "14:00-14:40", inicio: "2:00 pm", fin: "2:40 pm" },
  { id: "14:40-15:20", inicio: "2:40 pm", fin: "3:20 pm" },
  { id: "15:20-16:00", inicio: "3:20 pm", fin: "4:00 pm" },
  { id: "16:00-16:40", inicio: "4:00 pm", fin: "4:40 pm" },
];

function formatFechaDDMMAAAA(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export default function SolicitarCita() {
  const totalSteps = 2;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [monthIndex, setMonthIndex] = useState(0);
  const [modalidad, setModalidad] = useState("Presencial");
  const [fecha, setFecha] = useState("");
  const [horario, setHorario] = useState("");
  const [motivo, setMotivo] = useState("");

  const hoy = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const mesActual = MESES_2026[monthIndex];

  const celdasCalendario = useMemo(() => {
    const primerDia = new Date(mesActual.year, mesActual.month, 1);
    const ultimoDia = new Date(mesActual.year, mesActual.month + 1, 0);
    const celdas = [];

    for (let i = 0; i < primerDia.getDay(); i++) {
      celdas.push({ key: `empty-${i}`, empty: true });
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fechaObj = new Date(mesActual.year, mesActual.month, dia);
      fechaObj.setHours(0, 0, 0, 0);

      const formatted = formatFechaDDMMAAAA(fechaObj);

      celdas.push({
        key: formatted,
        dia,
        formatted,
        disabled: fechaObj < hoy || fechaObj.getDay() === 0,
      });
    }

    return celdas;
  }, [mesActual, hoy]);

  const handleNext = () => {
    if (step === 1) {
      if (!fecha) {
        Alert.alert("Fecha requerida", "Selecciona una fecha.");
        return;
      }

      if (!horario) {
        Alert.alert("Horario requerido", "Selecciona un horario.");
        return;
      }
    }

    setStep((actual) => Math.min(actual + 1, totalSteps));
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((actual) => actual - 1);
    } else {
      router.back();
    }
  };

  const guardarCita = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Sesión no encontrada", "Inicia sesión nuevamente.");
      router.replace("/login");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "citas"), {
        userId: user.uid,
        userName: user.displayName || "Usuario",
        userEmail: user.email || "",
        modalidad,
        fecha,
        horario,
        duracionMinutos: 40,
        motivo: motivo.trim(),
        estado: "Pendiente",
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        "¡Solicitud enviada!",
        "Tu cita se guardó correctamente en Kanvu.",
        [
          {
            text: "Aceptar",
            onPress: () => router.replace("/home"),
          },
        ],
      );
    } catch (error) {
      console.log("Error al guardar cita:", error);

      Alert.alert(
        "Error",
        "No se pudo guardar tu solicitud. Comprueba tu conexión.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Nueva cita</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              { width: `${(step / totalSteps) * 100}%` },
            ]}
          />
        </View>

        <Text style={styles.stepText}>
          Paso {step} de {totalSteps}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <>
            <Text style={styles.title}>Selecciona tu cita</Text>

            <Text style={styles.subtitle}>
              Elige la modalidad, día y horario disponible.
            </Text>

            <Text style={styles.label}>MODALIDAD</Text>
            <View style={styles.modalidadRow}>
              {MODALIDADES.map((mod) => {
                const activa = modalidad === mod;
                return (
                  <TouchableOpacity
                    key={mod}
                    style={[
                      styles.modalidadBtn,
                      activa && styles.optionCardActive,
                    ]}
                    onPress={() => setModalidad(mod)}
                  >
                    <Text
                      style={[
                        styles.optionTitle,
                        activa && styles.optionTextActive,
                      ]}
                    >
                      {mod}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calendarHeaderRow}>
              <Text style={styles.label}>FECHA</Text>

              {fecha ? <Text style={styles.selectedBadge}>{fecha}</Text> : null}
            </View>

            <View style={styles.calendarCard}>
              <View style={styles.monthSwitch}>
                <TouchableOpacity
                  onPress={() => setMonthIndex(0)}
                  disabled={monthIndex === 0}
                  style={[
                    styles.arrowBtn,
                    monthIndex === 0 && styles.arrowDisabled,
                  ]}
                >
                  <Text style={styles.arrowText}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.monthTitle}>{mesActual.label}</Text>

                <TouchableOpacity
                  onPress={() => setMonthIndex(1)}
                  disabled={monthIndex === 1}
                  style={[
                    styles.arrowBtn,
                    monthIndex === 1 && styles.arrowDisabled,
                  ]}
                >
                  <Text style={styles.arrowText}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekRow}>
                {DIAS_SEMANA.map((d) => (
                  <Text key={d} style={styles.weekDay}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {celdasCalendario.map((celda) => {
                  if (celda.empty) {
                    return <View key={celda.key} style={styles.dayCell} />;
                  }

                  const seleccionado = fecha === celda.formatted;

                  return (
                    <TouchableOpacity
                      key={celda.key}
                      disabled={celda.disabled}
                      onPress={() => setFecha(celda.formatted)}
                      style={[
                        styles.dayCell,
                        celda.disabled && styles.dayDisabled,
                        seleccionado && styles.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          celda.disabled && styles.dayTextDisabled,
                          seleccionado && styles.dayTextSelected,
                        ]}
                      >
                        {celda.dia}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              Horarios disponibles (40 minutos)
            </Text>

            <View style={styles.grid}>
              {HORARIOS_40_MIN.map((item) => {
                const etiqueta = `${item.inicio} - ${item.fin}`;
                const activo = horario === etiqueta;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.time, activo && styles.timeSelected]}
                    onPress={() => setHorario(etiqueta)}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        activo && styles.timeTextSelected,
                      ]}
                    >
                      {item.inicio}
                    </Text>

                    <Text
                      style={[
                        styles.timeSubText,
                        activo && styles.timeTextSelected,
                      ]}
                    >
                      a {item.fin}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Comentarios o motivo</Text>

            <Text style={styles.subtitle}>
              Agrega cualquier detalle que quieras compartir antes de tu cita.
              Este apartado es opcional.
            </Text>

            <Text style={styles.label}>COMENTARIOS</Text>

            <TextInput
              style={styles.textArea}
              placeholder="Escribe aquí tus comentarios..."
              placeholderTextColor="#999999"
              multiline
              value={motivo}
              onChangeText={setMotivo}
              maxLength={500}
            />

            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Resumen de tu solicitud</Text>

              <Text style={styles.summaryText}>📍 Modalidad: {modalidad}</Text>

              <Text style={styles.summaryText}>🗓 Fecha: {fecha}</Text>

              <Text style={styles.summaryText}>
                🕒 Horario: {horario} (40 minutos)
              </Text>

              <Text style={styles.summaryText}>
                💬 Comentarios: {motivo.trim() || "Sin comentarios"}
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            step === 1 && (!fecha || !horario) && styles.buttonMuted,
          ]}
          onPress={step < totalSteps ? handleNext : guardarCita}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {step < totalSteps ? "Continuar" : "Solicitar cita"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F5F2",
    justifyContent: "center",
    alignItems: "center",
  },

  back: { fontSize: 24, color: "#596838", lineHeight: 26 },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#222222" },

  progressContainer: { paddingHorizontal: 20, marginBottom: 16 },

  progressBackground: {
    height: 5,
    backgroundColor: "#EAEAEA",
    borderRadius: 5,
    overflow: "hidden",
  },

  progressFill: { height: 5, backgroundColor: "#65763D" },
  stepText: { color: "#888888", marginTop: 8, fontSize: 12 },

  content: { paddingHorizontal: 20, paddingBottom: 30 },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#222222",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 13,
    color: "#888888",
    marginBottom: 18,
  },

  label: {
    color: "#777777",
    fontSize: 11,
    marginBottom: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  optionCardActive: {
    backgroundColor: "#65763D",
    borderColor: "#65763D",
  },

  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222222",
  },

  optionTextActive: {
    color: "#FFFFFF",
  },

  modalidadRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  modalidadBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  calendarHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  selectedBadge: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#65763D",
    backgroundColor: "#F5F7EE",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 10,
  },

  calendarCard: {
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },

  monthSwitch: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  monthTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#222222",
  },

  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F5F7EE",
    justifyContent: "center",
    alignItems: "center",
  },

  arrowDisabled: { opacity: 0.3 },
  arrowText: {
    fontSize: 20,
    color: "#65763D",
    fontWeight: "bold",
    lineHeight: 22,
  },

  weekRow: { flexDirection: "row", marginBottom: 6 },

  weekDay: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "bold",
    color: "#888888",
  },

  daysGrid: { flexDirection: "row", flexWrap: "wrap" },

  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginVertical: 2,
  },

  dayDisabled: { opacity: 0.3 },
  daySelected: { backgroundColor: "#65763D" },

  dayText: {
    fontSize: 13,
    color: "#333333",
    fontWeight: "500",
  },

  dayTextDisabled: { color: "#AAAAAA" },
  dayTextSelected: { color: "#FFFFFF", fontWeight: "bold" },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 22,
    marginBottom: 12,
    color: "#333333",
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  time: {
    width: "31%",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  timeSelected: {
    backgroundColor: "#65763D",
    borderColor: "#65763D",
  },

  timeText: { color: "#333333", fontSize: 12, fontWeight: "600" },
  timeSubText: { color: "#888888", fontSize: 10, marginTop: 1 },
  timeTextSelected: { color: "#FFFFFF" },

  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 12,
    padding: 13,
    textAlignVertical: "top",
    color: "#222222",
  },

  summary: {
    marginTop: 20,
    backgroundColor: "#F5F7EE",
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },

  summaryTitle: {
    fontWeight: "bold",
    color: "#65763D",
    marginBottom: 4,
  },

  summaryText: { fontSize: 13, color: "#444444" },
  footer: { padding: 20 },

  button: {
    backgroundColor: "#65763D",
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },

  buttonMuted: { backgroundColor: "#B7BEAA" },
  buttonText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 },
});
