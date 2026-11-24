import { router } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "../constants/firebase";

// ACTIVIDADES DISPONIBLES
const ACTIVIDADES = [
  {
    id: "act-1",
    titulo: "Manejo del estrés académico",
    categoria: "Taller",
    fecha: "20 nov 2026",
    hora: "4:00 pm",
    lugar: "Aula Magna",
    icono: "▤",
    cupos: 12,
  },
  {
    id: "act-2",
    titulo: "Grupo de apoyo: Ansiedad universitaria",
    categoria: "Sesión grupal",
    fecha: "23 nov 2026",
    hora: "5:30 pm",
    lugar: "En línea",
    icono: "♧",
    cupos: 8,
  },
  {
    id: "act-3",
    titulo: "Hábitos de sueño saludables",
    categoria: "Charla",
    fecha: "26 nov 2026",
    hora: "1:00 pm",
    lugar: "Edificio B, Sala 3",
    icono: "☾",
    cupos: 30,
  },
  {
    id: "act-4",
    titulo: "Mindfulness en campus",
    categoria: "Sesión grupal",
    fecha: "28 nov 2026",
    hora: "10:00 am",
    lugar: "Jardín Central",
    icono: "✎",
    cupos: 15,
  },
];

const VERDE = "#596838";
const VERDE_CLARO = "#E8EFE0";
const BEIGE_PENDIENTE = "#EFECE6";
const MARRON_PENDIENTE = "#7A7467";
const ROJO_CLARO = "#F9E2DF";
const ROJO_TEXTO = "#B84A39";
const FONDO = "#F4F5F0";

const MESES_CORTOS = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

const MESES_LARGO_MAYUS = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

// CONVERTIR FECHA A OBJETO DATE
function parsearFechaDate(fecha) {
  if (!fecha) return null;

  const texto = String(fecha).trim().toLowerCase();

  // Formato DD/MM/AAAA
  if (texto.includes("/")) {
    const partes = texto.split("/").map(Number);
    if (partes.length === 3) {
      const [dia, mes, anio] = partes;
      if (dia && mes && anio) {
        return new Date(anio, mes - 1, dia);
      }
    }
  }

  // Formato: 20 nov 2026 o 30 sep 2026
  const partes = texto.split(/\s+/);
  if (partes.length === 3) {
    const dia = Number(partes[0]);
    const mes = MESES_CORTOS[partes[1].substring(0, 3)];
    const anio = Number(partes[2]);
    if (dia && mes !== undefined && anio) {
      return new Date(anio, mes, dia);
    }
  }

  return null;
}

// CONVERTIR FECHA A VALOR NUMÉRICO
function obtenerFecha(fecha) {
  const d = parsearFechaDate(fecha);
  return d ? d.getTime() : 0;
}

// OBTENER ETIQUETA DE GRUPO "MES AÑO"
function obtenerGrupoMesAnio(fecha) {
  const d = parsearFechaDate(fecha);
  if (!d) return "SIN FECHA";
  return `${MESES_LARGO_MAYUS[d.getMonth()]} ${d.getFullYear()}`;
}

// CONVERTIR HORARIO A MINUTOS
function obtenerMinutos(horario) {
  if (!horario) return 0;

  const texto = String(horario).toLowerCase();
  const coincidencia = texto.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);

  if (!coincidencia) return 0;

  let horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);

  if (coincidencia[3] === "pm" && horas !== 12) {
    horas += 12;
  }

  if (coincidencia[3] === "am" && horas === 12) {
    horas = 0;
  }

  return horas * 60 + minutos;
}

// FECHA Y HORA COMPLETAS
function obtenerFechaCompleta(item) {
  const fecha = obtenerFecha(item.fecha);
  if (!fecha) return Number.MAX_SAFE_INTEGER;
  const minutos = obtenerMinutos(item.horario || item.hora);
  return fecha + minutos * 60000;
}

// ORDENAR REGISTROS
function ordenarPorFecha(a, b) {
  return obtenerFechaCompleta(a) - obtenerFechaCompleta(b);
}

function ordenarPasadasDesc(a, b) {
  return obtenerFechaCompleta(b) - obtenerFechaCompleta(a);
}

export default function Home() {
  const [usuario, setUsuario] = useState(null);
  const [citas, setCitas] = useState([]);
  const [actividadesElegidas, setActividadesElegidas] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [pestana, setPestana] = useState("inicio");
  const [filtroCitas, setFiltroCitas] = useState("Próximas");
  const [filtroActividad, setFiltroActividad] = useState("Todas");

  const [mostrarEscribir, setMostrarEscribir] = useState(false);
  const [textoActividad, setTextoActividad] = useState("");

  // AUTENTICACIÓN Y CONEXIÓN CON FIRESTORE
  useEffect(() => {
    let unsubscribeCitas = null;
    let unsubscribeActividades = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeCitas) {
        unsubscribeCitas();
        unsubscribeCitas = null;
      }

      if (unsubscribeActividades) {
        unsubscribeActividades();
        unsubscribeActividades = null;
      }

      if (!user) {
        setUsuario(null);
        setCitas([]);
        setActividadesElegidas([]);
        setCargando(false);
        router.replace("/login");
        return;
      }

      setUsuario(user);
      setCargando(true);

      const consultaCitas = query(
        collection(db, "citas"),
        where("userId", "==", user.uid),
      );

      unsubscribeCitas = onSnapshot(
        consultaCitas,
        (snapshot) => {
          const lista = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          setCitas(lista.sort(ordenarPorFecha));
          setCargando(false);
        },
        (error) => {
          console.log("Error de citas:", error);
          setCargando(false);
          Alert.alert("Error", "No se pudieron cargar las citas.");
        },
      );

      const consultaActividades = query(
        collection(db, "actividadesUsuario"),
        where("userId", "==", user.uid),
      );

      unsubscribeActividades = onSnapshot(
        consultaActividades,
        (snapshot) => {
          const lista = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

          setActividadesElegidas(lista);
        },
        (error) => {
          console.log("Error de actividades:", error);
          Alert.alert("Error", "No se pudieron cargar tus actividades.");
        },
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeCitas) unsubscribeCitas();
      if (unsubscribeActividades) unsubscribeActividades();
    };
  }, []);

  // INFORMACIÓN DEL USUARIO
  const nombreCompleto =
    usuario?.displayName || usuario?.email?.split("@")[0] || "Usuario";

  const partesNombre = nombreCompleto.trim().split(/\s+/);

  const iniciales =
    partesNombre.length > 1
      ? (partesNombre[0][0] + partesNombre[1][0]).toUpperCase()
      : (partesNombre[0]?.[0] || "U").toUpperCase();

  const matricula = usuario?.email || "";

  // CITAS PRÓXIMAS / PENDIENTES Y PASADAS (COMPLETADAS)
  const citasProximasPendientes = citas
    .filter(
      (c) =>
        c.estado === "Pendiente" ||
        c.estado === "Confirmada" ||
        c.estado === "Próxima",
    )
    .sort(ordenarPorFecha);

  const citasPasadasCompletadas = citas
    .filter((c) => c.estado === "Completada")
    .sort(ordenarPasadasDesc);

  const citasCompletadasTotal = citasPasadasCompletadas.length;
  const citasCanceladasTotal = citas.filter(
    (c) => c.estado === "Cancelada",
  ).length;
  const historial = citas
    .filter((c) => c.estado === "Completada" || c.estado === "Cancelada")
    .sort(ordenarPasadasDesc);

  const historialAgrupado = historial.reduce((grupos, cita) => {
    const clave = obtenerGrupoMesAnio(cita.fecha);
    if (!grupos[clave]) {
      grupos[clave] = [];
    }
    grupos[clave].push(cita);
    return grupos;
  }, {});

  const citasVisibles =
    filtroCitas === "Próximas"
      ? citasProximasPendientes
      : citasPasadasCompletadas;

  const asistencias = citasCompletadasTotal;

  // PRÓXIMA CITA
  const ahora = Date.now();

  const proximaCita =
    citasProximasPendientes
      .filter((cita) => obtenerFechaCompleta(cita) >= ahora)
      .sort(ordenarPorFecha)[0] ||
    citasProximasPendientes[0] ||
    null;

  // UNIR CITAS Y ACTIVIDADES INSCRITAS
  const todosMisRegistros = [
    ...citasProximasPendientes
      .filter((cita) => obtenerFechaCompleta(cita) >= ahora)
      .map((cita) => ({
        ...cita,
        tipoRegistro: "cita",
        tituloRegistro: cita.area || cita.especialidad || "Cita Kanvu",
        fechaRegistro: cita.fecha,
        horaRegistro: cita.horario,
      })),

    ...actividadesElegidas
      .filter((actividad) => {
        const fecha = obtenerFechaCompleta(actividad);
        return fecha === Number.MAX_SAFE_INTEGER || fecha >= ahora;
      })
      .map((actividad) => ({
        ...actividad,
        tipoRegistro: "actividad",
        tituloRegistro: actividad.titulo,
        fechaRegistro: actividad.fecha,
        horaRegistro: actividad.hora,
      })),
  ].sort(ordenarPorFecha);

  // ACTIVIDADES DISPONIBLES
  const actividadesFiltradas = ACTIVIDADES.filter((actividad) => {
    if (filtroActividad === "Todas") return true;
    if (filtroActividad === "Sesiones grupales") {
      return actividad.categoria === "Sesión grupal";
    }
    return actividad.categoria === "Taller" || actividad.categoria === "Charla";
  });

  const yaSeleccionada = (titulo) => {
    return actividadesElegidas.some(
      (actividad) => actividad.titulo?.toLowerCase() === titulo.toLowerCase(),
    );
  };

  // INSCRIBIRSE A UNA ACTIVIDAD
  const seleccionarActividad = async (actividad) => {
    if (!usuario) {
      Alert.alert("Sesión requerida", "Inicia sesión nuevamente.");
      return;
    }

    if (yaSeleccionada(actividad.titulo)) {
      Alert.alert(
        "Ya estás inscrito",
        "Esta actividad ya aparece en tus actividades.",
      );
      return;
    }

    if (procesando) return;
    setProcesando(true);

    try {
      await addDoc(collection(db, "actividadesUsuario"), {
        userId: usuario.uid,
        actividadId: actividad.id || "personalizada",
        titulo: actividad.titulo,
        categoria: actividad.categoria || "Personalizada",
        fecha: actividad.fecha || "Por definir",
        hora: actividad.hora || "A tu ritmo",
        lugar: actividad.lugar || "Personal",
        origen: actividad.origen || "catalogo",
        estado: "Inscrito",
        createdAt: serverTimestamp(),
      });

      setPestana("inicio");

      Alert.alert(
        "¡Inscripción exitosa!",
        "Tu actividad ya está guardada en Inicio.",
      );
    } catch (error) {
      console.log("Error al inscribirse:", error);
      Alert.alert(
        "Error",
        "No se pudo guardar tu inscripción. Revisa tu conexión.",
      );
    } finally {
      setProcesando(false);
    }
  };

  // ACTIVIDAD ALEATORIA
  const elegirAleatoria = () => {
    const disponibles = ACTIVIDADES.filter(
      (actividad) => !yaSeleccionada(actividad.titulo),
    );

    if (disponibles.length === 0) {
      Alert.alert(
        "¡Excelente!",
        "Ya estás inscrito en todas las actividades disponibles.",
      );
      return;
    }

    const indice = Math.floor(Math.random() * disponibles.length);

    Alert.alert("Actividad seleccionada", disponibles[indice].titulo, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Inscribirme",
        onPress: () => seleccionarActividad(disponibles[indice]),
      },
    ]);
  };

  // GUARDAR ACTIVIDAD PERSONALIZADA
  const guardarEscrita = async () => {
    const limpia = textoActividad.trim();

    if (!limpia) {
      Alert.alert("Atención", "Escribe el nombre de tu actividad.");
      return;
    }

    await seleccionarActividad({
      id: "personalizada",
      titulo: limpia,
      categoria: "Personalizada",
      fecha: "Por definir",
      hora: "A tu ritmo",
      lugar: "Personal",
      origen: "escrita",
    });

    setTextoActividad("");
    setMostrarEscribir(false);
  };

  // CANCELAR CITA
  const cancelarCita = (id) => {
    Alert.alert("Cancelar cita", "¿Estás seguro de cancelar esta cita?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: async () => {
          try {
            await updateDoc(doc(db, "citas", id), {
              estado: "Cancelada",
            });
            Alert.alert("Correcto", "Tu cita fue cancelada.");
          } catch (error) {
            console.log(error);
            Alert.alert("Error", "No se pudo cancelar la cita.");
          }
        },
      },
    ]);
  };

  // ELIMINAR ACTIVIDAD DE MIS INSCRIPCIONES
  const eliminarActividad = (id) => {
    Alert.alert(
      "Cancelar inscripción",
      "¿Deseas quitar esta actividad de tu lista?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, quitar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "actividadesUsuario", id));
              Alert.alert("Correcto", "Se eliminó tu inscripción.");
            } catch (error) {
              console.log(error);
              Alert.alert("Error", "No se pudo eliminar.");
            }
          },
        },
      ],
    );
  };

  // CERRAR SESIÓN
  const cerrarSesion = () => {
    Alert.alert("Cerrar sesión", "¿Deseas cerrar tu sesión de Kanvu?", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, cerrar sesión",
        onPress: async () => {
          try {
            await signOut(auth);
            setUsuario(null);
            setPestana("inicio");
            router.replace("/login");
          } catch (error) {
            console.log("Error al cerrar sesión:", error);
            Alert.alert("Error", "No se pudo cerrar la sesión.");
          }
        },
      },
    ]);
  };

  // CAMBIAR PESTAÑA
  const cambiarPestana = (nuevaPestana) => {
    setPestana(nuevaPestana);
    setMostrarEscribir(false);
  };

  // NAVEGACIÓN INFERIOR
  const Navegacion = () => (
    <View style={styles.bottomNav}>
      {[
        { id: "inicio", icon: "⌂", label: "Inicio" },
        { id: "citas", icon: "▣", label: "Citas" },
        { id: "actividades", icon: "☆", label: "Actividades" },
        { id: "perfil", icon: "♙", label: "Perfil" },
      ].map((item) => {
        const activo =
          pestana === item.id ||
          (item.id === "citas" && pestana === "historial");

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.navItem}
            activeOpacity={0.6}
            onPress={() => cambiarPestana(item.id)}
          >
            <Text style={[styles.navIcon, activo && styles.navIconActive]}>
              {item.icon}
            </Text>

            <Text style={[styles.navText, activo && styles.navTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // PANTALLA DE CARGA
  if (cargando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={VERDE} />
        <Text style={styles.loadingText}>Cargando Kanvu...</Text>
      </View>
    );
  }

  // ENCABEZADO
  const Encabezado = ({ titulo, subtitulo }) => (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.greeting}>{titulo}</Text>
        <Text style={styles.userName}>{subtitulo}</Text>
      </View>

      <TouchableOpacity
        style={styles.avatar}
        activeOpacity={0.7}
        onPress={() => cambiarPestana("perfil")}
      >
        <Text style={styles.avatarText}>{iniciales}</Text>
      </TouchableOpacity>
    </View>
  );

  // TARJETA DE ACTIVIDAD
  const TarjetaActividad = ({ actividad, inscrita }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <View style={styles.activityIcon}>
          <Text style={styles.activityIconText}>{actividad.icono || "☆"}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.activityTitle}>{actividad.titulo}</Text>
          <Text style={styles.activityCategory}>{actividad.categoria}</Text>
        </View>
      </View>

      <View style={styles.activityDetails}>
        <Text style={styles.activityMeta}>▢ {actividad.fecha}</Text>
        <Text style={styles.activityMeta}>◷ {actividad.hora}</Text>
        <Text style={styles.activityMeta}>♧ {actividad.lugar}</Text>
      </View>

      {actividad.cupos ? (
        <Text style={styles.activityMeta}>♙ {actividad.cupos} lugares</Text>
      ) : null}

      {inscrita ? (
        <View style={styles.enrolledBadge}>
          <Text style={styles.enrolledText}>✓ Inscripción realizada</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.selectActBtn, procesando && styles.disabledButton]}
          activeOpacity={0.7}
          disabled={procesando}
          onPress={() => seleccionarActividad(actividad)}
        >
          {procesando ? (
            <ActivityIndicator color={VERDE} />
          ) : (
            <Text style={styles.selectActText}>Inscribirme</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  // TARJETA DE CITA PARA "MIS CITAS" (PRÓXIMAS Y PASADAS)
  const TarjetaCitaMisCitas = ({ cita, esPasada }) => {
    const areaTitulo = cita.area || cita.especialidad || "Psicología";
    const especialista = cita.especialista || cita.profesional || "Cita Kanvu";
    const modalidad = cita.modalidad || cita.lugar || "Presencial";
    const esOrientacion = areaTitulo.toLowerCase().includes("orient");
    const iconoTexto = esOrientacion ? "🎓" : "✎";

    const esProximaVerde =
      !esPasada && (cita.estado === "Próxima" || cita.estado === "Confirmada");

    const badgeBg = esPasada
      ? VERDE_CLARO
      : esProximaVerde
        ? VERDE_CLARO
        : BEIGE_PENDIENTE;

    const badgeColor = esPasada
      ? VERDE
      : esProximaVerde
        ? VERDE
        : MARRON_PENDIENTE;

    const iconBoxBg = esPasada
      ? VERDE_CLARO
      : esProximaVerde
        ? VERDE_CLARO
        : BEIGE_PENDIENTE;

    const iconColor = esPasada
      ? VERDE
      : esProximaVerde
        ? VERDE
        : MARRON_PENDIENTE;

    return (
      <View style={styles.citaRefCard}>
        <View style={styles.citaRefTop}>
          <View style={[styles.citaRefIconBox, { backgroundColor: iconBoxBg }]}>
            <Text style={[styles.citaRefIconText, { color: iconColor }]}>
              {iconoTexto}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.citaRefTitle}>{areaTitulo}</Text>
            <Text style={styles.citaRefSubtitle}>{especialista}</Text>
          </View>

          <View style={[styles.citaRefBadge, { backgroundColor: badgeBg }]}>
            <Text style={[styles.citaRefBadgeText, { color: badgeColor }]}>
              {cita.estado || (esPasada ? "Completada" : "Pendiente")}
            </Text>
          </View>
        </View>

        <View style={styles.citaRefMetaRow}>
          <Text style={styles.citaRefMetaText}>▢ {cita.fecha}</Text>
          <Text style={styles.citaRefMetaText}>◷ {cita.horario}</Text>
          <Text style={styles.citaRefMetaText}>♧ {modalidad}</Text>
        </View>

        {!esPasada &&
          (cita.estado === "Pendiente" ||
            cita.estado === "Confirmada" ||
            cita.estado === "Próxima") && (
            <TouchableOpacity
              onPress={() => cancelarCita(cita.id)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancelar cita</Text>
            </TouchableOpacity>
          )}
      </View>
    );
  };

  // TARJETA DE CITA EN HISTORIAL
  const TarjetaHistorialCita = ({ cita }) => {
    const esCompletada = cita.estado === "Completada";
    const areaTitulo = cita.area || cita.especialidad || "Psicología";
    const especialista = cita.especialista || cita.profesional || "Cita Kanvu";
    const modalidad = cita.modalidad || cita.lugar || "Presencial";
    const iconoArea = areaTitulo.toLowerCase().includes("orient") ? "🎓" : "✎";

    return (
      <View style={styles.historyItemCard}>
        <View style={styles.historyItemTop}>
          <View
            style={[
              styles.historyIconBox,
              { backgroundColor: esCompletada ? VERDE_CLARO : BEIGE_PENDIENTE },
            ]}
          >
            <Text
              style={[
                styles.historyIconText,
                { color: esCompletada ? VERDE : MARRON_PENDIENTE },
              ]}
            >
              {iconoArea}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.historyAreaTitle}>{areaTitulo}</Text>
            <Text style={styles.historySpecialist}>{especialista}</Text>
          </View>

          <View
            style={[
              styles.historyBadge,
              { backgroundColor: esCompletada ? VERDE_CLARO : ROJO_CLARO },
            ]}
          >
            <Text
              style={[
                styles.historyBadgeText,
                { color: esCompletada ? VERDE : ROJO_TEXTO },
              ]}
            >
              {cita.estado}
            </Text>
          </View>
        </View>

        <View style={styles.historyMetaRow}>
          <Text style={styles.historyMetaText}>▢ {cita.fecha}</Text>
          <Text style={styles.historyMetaText}>◷ {cita.horario}</Text>
          <Text style={styles.historyMetaText}>♧ {modalidad}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" />

      {/* VISTA DEDICADA DE HISTORIAL */}
      {pestana === "historial" ? (
        <View style={{ flex: 1, backgroundColor: FONDO }}>
          <View style={styles.historyTopBar}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={() => cambiarPestana("perfil")}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.historyHeaderTitle}>Historial</Text>

            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.historyScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.historySummaryRow}>
              <View style={[styles.summaryCard, styles.summaryCompleted]}>
                <Text style={[styles.summaryNum, { color: VERDE }]}>
                  {citasCompletadasTotal}
                </Text>
                <Text style={styles.summaryLabel}>Completadas</Text>
              </View>

              <View style={[styles.summaryCard, styles.summaryCancelled]}>
                <Text style={[styles.summaryNum, { color: ROJO_TEXTO }]}>
                  {citasCanceladasTotal}
                </Text>
                <Text style={styles.summaryLabel}>Canceladas</Text>
              </View>

              <View style={[styles.summaryCard, styles.summaryTotal]}>
                <Text style={[styles.summaryNum, { color: "#222222" }]}>
                  {historial.length}
                </Text>
                <Text style={styles.summaryLabel}>Total</Text>
              </View>
            </View>

            {historial.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>🍃</Text>
                <Text style={styles.emptyTitle}>Tu historial está vacío</Text>
                <Text style={styles.emptyText}>
                  Aquí aparecerán las citas completadas y canceladas.
                </Text>
              </View>
            ) : (
              Object.entries(historialAgrupado).map(([mesAnio, listaCitas]) => (
                <View key={mesAnio} style={{ marginBottom: 14 }}>
                  <Text style={styles.monthSectionTitle}>{mesAnio}</Text>
                  {listaCitas.map((cita) => (
                    <TarjetaHistorialCita key={cita.id} cita={cita} />
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          <Navegacion />
        </View>
      ) : (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* INICIO */}
            {pestana === "inicio" && (
              <>
                <Encabezado
                  titulo={
                    new Date().getHours() < 12
                      ? "Buenos días"
                      : new Date().getHours() < 19
                        ? "Buenas tardes"
                        : "Buenas noches"
                  }
                  subtitulo={nombreCompleto}
                />

                <View style={styles.body}>
                  <View style={styles.nextAppointmentCard}>
                    <View style={styles.nextAppointmentHeader}>
                      <Text style={styles.nextAppointmentLabel}>
                        PRÓXIMA CITA
                      </Text>
                      <Text style={styles.nextAppointmentIcon}>▣</Text>
                    </View>

                    {proximaCita ? (
                      <>
                        <Text style={styles.nextAppointmentTitle}>
                          {proximaCita.area || "Cita Kanvu"}
                        </Text>
                        <Text style={styles.nextAppointmentDetail}>
                          🗓 {proximaCita.fecha}
                        </Text>
                        <Text style={styles.nextAppointmentDetail}>
                          ◷ {proximaCita.horario}
                        </Text>
                        <Text style={styles.nextAppointmentStatus}>
                          {proximaCita.estado}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.nextAppointmentTitle}>
                          Sin próximas citas
                        </Text>
                        <Text style={styles.nextAppointmentDetail}>
                          Cuando solicites una cita aparecerá aquí.
                        </Text>
                      </>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.requestCard}
                    activeOpacity={0.7}
                    onPress={() => router.push("/solicitar-cita")}
                  >
                    <View style={styles.plusContainer}>
                      <Text style={styles.plus}>+</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestTitle}>
                        Solicitar nueva cita
                      </Text>
                      <Text style={styles.requestSubtitle}>
                        Agenda tu próxima sesión
                      </Text>
                    </View>

                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>

                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      style={styles.quickAction}
                      onPress={() => {
                        setFiltroCitas("Próximas");
                        cambiarPestana("citas");
                      }}
                    >
                      <Text style={styles.quickIcon}>▣</Text>
                      <Text style={styles.quickText}>Mis citas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickAction}
                      onPress={() => cambiarPestana("historial")}
                    >
                      <Text style={styles.quickIcon}>◷</Text>
                      <Text style={styles.quickText}>Historial</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickAction}
                      onPress={() => cambiarPestana("actividades")}
                    >
                      <Text style={styles.quickIcon}>☆</Text>
                      <Text style={styles.quickText}>Actividades</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Próximas citas</Text>
                  </View>

                  {todosMisRegistros.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🍃</Text>
                      <Text style={styles.emptyTitle}>
                        Todavía no tienes registros
                      </Text>
                      <Text style={styles.emptyText}>
                        Tus citas y actividades inscritas aparecerán aquí.
                      </Text>
                    </View>
                  ) : (
                    todosMisRegistros.map((item) => (
                      <View
                        key={`${item.tipoRegistro}-${item.id}`}
                        style={styles.appointmentCard}
                      >
                        <Text style={styles.activityCategory}>
                          {item.tipoRegistro === "cita"
                            ? "CITA SOLICITADA"
                            : item.categoria || "ACTIVIDAD"}
                        </Text>

                        <Text style={styles.appointmentTitle}>
                          {item.tituloRegistro}
                        </Text>

                        <Text style={styles.activityMeta}>
                          ▢ {item.fechaRegistro}
                        </Text>

                        <Text style={styles.activityMeta}>
                          ◷ {item.horaRegistro}
                        </Text>

                        {item.tipoRegistro === "cita" ? (
                          <>
                            <Text style={styles.statusText}>{item.estado}</Text>

                            <TouchableOpacity
                              onPress={() => cancelarCita(item.id)}
                              style={styles.cancelButton}
                            >
                              <Text style={styles.cancelText}>
                                Cancelar cita
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <>
                            <Text style={styles.activityMeta}>
                              ♧ {item.lugar}
                            </Text>

                            <Text style={styles.enrolledText}>
                              ✓ Inscripción realizada
                            </Text>

                            <TouchableOpacity
                              style={styles.cancelButton}
                              onPress={() => eliminarActividad(item.id)}
                            >
                              <Text style={styles.cancelText}>
                                Cancelar inscripción
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {/* MIS CITAS (PRÓXIMAS Y PASADAS COMPLETADAS) */}
            {pestana === "citas" && (
              <>
                <View style={styles.citasTopBar}>
                  <View style={{ width: 36 }} />
                  <Text style={styles.citasHeaderTitle}>Mis citas</Text>
                  <TouchableOpacity
                    style={styles.citasAddBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push("/solicitar-cita")}
                  >
                    <Text style={styles.citasAddBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.body}>
                  <View style={styles.citasSegmentRow}>
                    {["Próximas", "Pasadas"].map((tab) => {
                      const activa = filtroCitas === tab;
                      return (
                        <TouchableOpacity
                          key={tab}
                          style={[
                            styles.citasSegmentBtn,
                            activa && styles.citasSegmentBtnActive,
                          ]}
                          activeOpacity={0.75}
                          onPress={() => setFiltroCitas(tab)}
                        >
                          <Text
                            style={[
                              styles.citasSegmentText,
                              activa && styles.citasSegmentTextActive,
                            ]}
                          >
                            {tab}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {citasVisibles.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🍃</Text>
                      <Text style={styles.emptyTitle}>
                        {filtroCitas === "Próximas"
                          ? "No tienes citas próximas o pendientes"
                          : "No tienes citas pasadas completadas"}
                      </Text>
                      <Text style={styles.emptyText}>
                        {filtroCitas === "Próximas"
                          ? "Agenda una nueva sesión presionando el botón +."
                          : "Aquí aparecerán tus citas una vez que sean completadas."}
                      </Text>
                    </View>
                  ) : (
                    citasVisibles.map((cita) => (
                      <TarjetaCitaMisCitas
                        key={cita.id}
                        cita={cita}
                        esPasada={filtroCitas === "Pasadas"}
                      />
                    ))
                  )}
                </View>
              </>
            )}

            {/* ACTIVIDADES */}
            {pestana === "actividades" && (
              <>
                <Encabezado
                  titulo="Actividades y sesiones"
                  subtitulo="Elige una actividad"
                />

                <View style={styles.body}>
                  <View style={styles.actButtonsRow}>
                    <TouchableOpacity
                      style={styles.randomBtn}
                      activeOpacity={0.7}
                      onPress={elegirAleatoria}
                    >
                      <Text style={styles.randomBtnText}>
                        Actividad aleatoria
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.writeBtn}
                      activeOpacity={0.7}
                      onPress={() => setMostrarEscribir(!mostrarEscribir)}
                    >
                      <Text style={styles.writeBtnText}>
                        {mostrarEscribir ? "Cerrar" : "+ Escribir"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {mostrarEscribir && (
                    <View style={styles.writeBox}>
                      <Text style={styles.activityCategory}>
                        ACTIVIDAD PERSONALIZADA
                      </Text>

                      <TextInput
                        style={styles.writeInput}
                        placeholder="Escribe tu actividad..."
                        placeholderTextColor="#999999"
                        value={textoActividad}
                        onChangeText={setTextoActividad}
                        maxLength={100}
                      />

                      <TouchableOpacity
                        style={styles.mainButton}
                        onPress={guardarEscrita}
                      >
                        <Text style={styles.mainButtonText}>
                          Guardar actividad
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsRow}
                  >
                    {["Todas", "Sesiones grupales", "Talleres y charlas"].map(
                      (filtro) => (
                        <TouchableOpacity
                          key={filtro}
                          style={[
                            styles.chip,
                            filtroActividad === filtro && styles.chipActive,
                          ]}
                          onPress={() => setFiltroActividad(filtro)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              filtroActividad === filtro &&
                                styles.chipTextActive,
                            ]}
                          >
                            {filtro}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </ScrollView>

                  {actividadesFiltradas.map((actividad) => (
                    <TarjetaActividad
                      key={actividad.id}
                      actividad={actividad}
                      inscrita={yaSeleccionada(actividad.titulo)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* PERFIL */}
            {pestana === "perfil" && (
              <>
                <View style={styles.profileTopBar}>
                  <Text style={styles.profileHeaderTitle}>Mi perfil</Text>
                </View>

                <View style={styles.profileBody}>
                  <View style={styles.profileCard}>
                    <View style={styles.profileAvatarBox}>
                      <Text style={styles.profileAvatarText}>{iniciales}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>{nombreCompleto}</Text>
                      <Text style={styles.profileSub}>Estudiante · Kanvu</Text>
                      <Text style={styles.profileMatricula}>{matricula}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{citas.length}</Text>
                      <Text style={styles.statLabel}>Citas</Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>{asistencias}</Text>
                      <Text style={styles.statLabel}>Asistencias</Text>
                    </View>

                    <View style={styles.statBox}>
                      <Text style={styles.statNum}>
                        {actividadesElegidas.length}
                      </Text>
                      <Text style={styles.statLabel}>Actividades</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.menuCard}
                    activeOpacity={0.7}
                    onPress={() => cambiarPestana("historial")}
                  >
                    <Text style={styles.menuCardText}>
                      ◷ Ver historial de citas
                    </Text>
                    <Text style={styles.arrow}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.logoutCard}
                    activeOpacity={0.7}
                    onPress={cerrarSesion}
                  >
                    <Text style={styles.logoutText}>Cerrar sesión</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>

          <Navegacion />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FONDO,
  },
  scroll: {
    paddingBottom: 24,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: FONDO,
  },
  loadingText: {
    marginTop: 10,
    color: "#555555",
    fontSize: 14,
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EAECE6",
  },
  greeting: {
    fontSize: 13,
    color: "#666666",
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F1F1F",
    marginTop: 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: VERDE_CLARO,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  avatarText: {
    color: VERDE,
    fontWeight: "700",
    fontSize: 15,
  },
  body: {
    padding: 18,
  },
  nextAppointmentCard: {
    backgroundColor: VERDE,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  nextAppointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nextAppointmentLabel: {
    color: "#DCE5D2",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  nextAppointmentIcon: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  nextAppointmentTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  nextAppointmentDetail: {
    color: "#EFF3EA",
    fontSize: 13,
    marginTop: 2,
  },
  nextAppointmentStatus: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 10,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  plusContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: VERDE_CLARO,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  plus: {
    color: VERDE,
    fontSize: 22,
    fontWeight: "700",
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  requestSubtitle: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  arrow: {
    fontSize: 22,
    color: "#888888",
    marginLeft: 8,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
  },
  quickAction: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  quickIcon: {
    fontSize: 18,
    color: VERDE,
    marginBottom: 4,
  },
  quickText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2B2B2B",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8E1",
    marginBottom: 14,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F1F",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#666666",
    textAlign: "center",
  },
  appointmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F1F1F",
    marginBottom: 4,
  },
  statusText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: VERDE,
  },
  cancelButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: ROJO_CLARO,
  },
  cancelText: {
    color: ROJO_TEXTO,
    fontSize: 12,
    fontWeight: "600",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE0D5",
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: VERDE,
    borderColor: VERDE,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#444444",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  mainButton: {
    backgroundColor: VERDE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  mainButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  actButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  randomBtn: {
    flex: 1,
    backgroundColor: VERDE_CLARO,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  randomBtnText: {
    color: VERDE,
    fontWeight: "700",
    fontSize: 13,
  },
  writeBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE0D5",
  },
  writeBtnText: {
    color: "#222222",
    fontWeight: "700",
    fontSize: 13,
  },
  writeBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  writeInput: {
    borderWidth: 1,
    borderColor: "#DCE0D5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F1F1F",
    marginTop: 8,
    backgroundColor: "#FAFBF8",
  },
  chipsRow: {
    marginBottom: 14,
  },
  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: VERDE_CLARO,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityIconText: {
    fontSize: 18,
    color: VERDE,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  activityCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: VERDE,
    marginTop: 2,
  },
  activityDetails: {
    gap: 4,
    marginBottom: 4,
  },
  activityMeta: {
    fontSize: 13,
    color: "#555555",
    marginTop: 2,
  },
  enrolledBadge: {
    marginTop: 10,
    backgroundColor: VERDE_CLARO,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  enrolledText: {
    color: VERDE,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  selectActBtn: {
    marginTop: 12,
    backgroundColor: VERDE_CLARO,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  selectActText: {
    color: VERDE,
    fontWeight: "700",
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.6,
  },
  profileTopBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECE6",
  },
  profileHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  profileBody: {
    padding: 18,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  profileAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: VERDE_CLARO,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  profileAvatarText: {
    color: VERDE,
    fontSize: 18,
    fontWeight: "700",
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  profileSub: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  profileMatricula: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "700",
    color: VERDE,
  },
  statLabel: {
    fontSize: 12,
    color: "#666666",
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  menuCardText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F1F1F",
  },
  logoutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  logoutText: {
    color: ROJO_TEXTO,
    fontWeight: "700",
    fontSize: 14,
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EAECE6",
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 18,
    color: "#888888",
  },
  navIconActive: {
    color: VERDE,
  },
  navText: {
    fontSize: 11,
    color: "#888888",
    marginTop: 2,
    fontWeight: "500",
  },
  navTextActive: {
    color: VERDE,
    fontWeight: "700",
  },

  // ESTILOS DE "MIS CITAS" (TIPO IMAGEN)
  citasTopBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEE8",
  },
  citasHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  citasAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2EFE9",
    justifyContent: "center",
    alignItems: "center",
  },
  citasAddBtnText: {
    fontSize: 20,
    color: "#2B2B2B",
    fontWeight: "600",
    lineHeight: 22,
  },
  citasSegmentRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  citasSegmentBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECEEE8",
  },
  citasSegmentBtnActive: {
    backgroundColor: VERDE,
    borderColor: VERDE,
  },
  citasSegmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7A7A72",
  },
  citasSegmentTextActive: {
    color: "#FFFFFF",
  },
  citaRefCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EAE3",
  },
  citaRefTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  citaRefIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  citaRefIconText: {
    fontSize: 16,
    fontWeight: "700",
  },
  citaRefTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  citaRefSubtitle: {
    fontSize: 12,
    color: "#666666",
    marginTop: 1,
  },
  citaRefBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  citaRefBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  citaRefMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2F3EE",
  },
  citaRefMetaText: {
    fontSize: 12,
    color: "#666666",
  },

  // ESTILOS DE HISTORIAL
  historyTopBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEE8",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2EFE9",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 22,
    color: "#2B2B2B",
    lineHeight: 24,
  },
  historyHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  historyScroll: {
    padding: 16,
    paddingBottom: 28,
  },
  historySummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCompleted: {
    backgroundColor: VERDE_CLARO,
  },
  summaryCancelled: {
    backgroundColor: ROJO_CLARO,
  },
  summaryTotal: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6E8E1",
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#555555",
    marginTop: 3,
    fontWeight: "500",
  },
  monthSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7A7A72",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  historyItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E8EAE3",
  },
  historyItemTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  historyIconText: {
    fontSize: 16,
    fontWeight: "700",
  },
  historyAreaTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F1F1F",
  },
  historySpecialist: {
    fontSize: 12,
    color: "#666666",
    marginTop: 1,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 8,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  historyMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2F3EE",
  },
  historyMetaText: {
    fontSize: 12,
    color: "#666666",
  },
});
