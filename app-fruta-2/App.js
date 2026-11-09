import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  initDB,
  obtenerProductos,
  guardarPedido,
  agregarProducto,
  eliminarProducto,
} from './database';
import { guardarPedidoFirebase } from './firebaseConfig';

// Los productos ahora vienen de SQLite (ver database.js)
const ProductosContext = createContext({ productos: [], recargarProductos: async () => {} });
const useProductos = () => useContext(ProductosContext);

// ---------- DATOS: categorías (círculos de la pantalla de inicio) ----------
const CATEGORIAS = [
  { id: 'c1', nombre: 'Fresa', emoji: '🍓', color: '#E63946' },
  { id: 'c2', nombre: 'Mora', emoji: '🫐', color: '#3A2E52' },
  { id: 'c3', nombre: 'Mango', emoji: '🥭', color: '#FF8C42' },
  { id: 'c4', nombre: 'Maracuyá', emoji: '🍈', color: '#F4B400' },
];

const Stack = createNativeStackNavigator();

// ============================================================
// CARRITO (estado compartido) — Context API
// Guarda los productos agregados y expone funciones para que
// cualquier pantalla (Detalle, Carrito, barra inferior) las use.
// Cada ítem del carrito: { producto, cantidad }
// ============================================================
const CarritoContext = createContext(null);

function CarritoProvider({ children }) {
  const [items, setItems] = useState([]);

  // Agrega un producto; si ya existe, suma la cantidad
  const agregarAlCarrito = (producto, cantidad) => {
    setItems((prev) => {
      const existe = prev.find((it) => it.producto.id === producto.id);
      if (existe) {
        return prev.map((it) =>
          it.producto.id === producto.id ? { ...it, cantidad: it.cantidad + cantidad } : it
        );
      }
      return [...prev, { producto, cantidad }];
    });
  };

  // Cambia la cantidad de un ítem (mínimo 1)
  const cambiarCantidad = (id, delta) => {
    setItems((prev) =>
      prev.map((it) =>
        it.producto.id === id ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it
      )
    );
  };

  const quitarDelCarrito = (id) => setItems((prev) => prev.filter((it) => it.producto.id !== id));
  const vaciarCarrito = () => setItems([]);

  const total = items.reduce((suma, it) => suma + it.producto.price * it.cantidad, 0);
  const cantidadTotal = items.reduce((suma, it) => suma + it.cantidad, 0);

  return (
    <CarritoContext.Provider
      value={{ items, agregarAlCarrito, cambiarCantidad, quitarDelCarrito, vaciarCarrito, total, cantidadTotal }}
    >
      {children}
    </CarritoContext.Provider>
  );
}

const useCarrito = () => useContext(CarritoContext);

// ============================================================
// EJERCICIO 1: Botón con Pressable
// Componente reutilizable: cambia de estilo (opacidad/escala) al
// presionarlo, gracias a que "style" recibe una función con el
// estado del toque ({ pressed }).
// Lo usamos en "COMENZAR", "Ver productos" y "Agregar al pedido".
// ============================================================
function BotonAccion({ texto, onPress, colorFondo, colorTexto = '#FFFFFF', estilo }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.botonAccion,
        { backgroundColor: colorFondo },
        estilo,
        pressed && styles.botonAccionPresionado, // <- efecto al presionar
      ]}
    >
      <Text style={[styles.botonAccionTexto, { color: colorTexto }]}>{texto}</Text>
    </Pressable>
  );
}

// ---------- EVENTOS + NAVEGACIÓN: tarjeta de producto ----------
function TarjetaProducto({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.tarjeta} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.tarjetaIcono}>
        <Text style={styles.tarjetaIconoTexto}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tarjetaTitulo}>{item.title}</Text>
        <Text style={styles.tarjetaPresentacion}>{item.presentacion}</Text>
      </View>
      <Text style={styles.tarjetaPrecio}>${item.price.toLocaleString('es-CO')}</Text>
    </TouchableOpacity>
  );
}

// ============================================================
// PANTALLA: BIENVENIDA (splash tipo "El Imperio de Oppa")
// Pantalla nueva, se agrega al Stack Navigator (ver EJERCICIO 3)
// ============================================================
function BienvenidaScreen({ navigation }) {
  return (
    <View style={styles.bienvenidaContainer}>
      <View style={styles.logoCirculo}>
        <Text style={styles.logoCorona}>👑</Text>
        <Text style={styles.logoTitulo}>EL IMPERIO{'\n'}DE{'\n'}OPPA</Text>
        <Text style={styles.logoSubtitulo}>y su pulpa</Text>
      </View>

      <View style={styles.pillNatural}>
        <Text style={styles.pillNaturalTexto}>100% NATURAL · SIN CONSERVANTES</Text>
      </View>

      <Text style={styles.bienvenidaFrase}>
        Sabor natural{'\n'}directamente a tu hogar
      </Text>

      {/* EJERCICIO 1 en acción: botón "COMENZAR" con efecto Pressable */}
      <BotonAccion
        texto="COMENZAR →"
        colorFondo="#2E9B52"
        estilo={{ width: '100%', marginTop: 10 }}
        onPress={() => navigation.navigate('Lista')}
      />

      <Text style={styles.bienvenidaPie}>Pulpa de fruta fresca y natural</Text>

      <Pressable onPress={() => navigation.navigate('Admin')}>
        <Text style={styles.adminLink}>Administrador</Text>
      </Pressable>
    </View>
  );
}

// ============================================================
// PANTALLA: LISTA / INICIO (pantalla de la sesión 5, rediseñada)
// ============================================================
function ListaScreen({ navigation }) {
  // ============================================================
  // EJERCICIO 2: Campo de búsqueda
  // TextInput CONTROLADO con useState para filtrar la lista.
  // El valor siempre viene del estado (value={busqueda}) y cada
  // tecleo lo actualiza (onChangeText={setBusqueda}).
  // ============================================================
  const [busqueda, setBusqueda] = useState('');
  const { productos } = useProductos(); // <- vienen de SQLite

  const productosFiltrados = productos.filter((p) =>
    p.title.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    <FlatList
      style={styles.container}
      data={productosFiltrados}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {/* ---------- Encabezado verde con saludo ---------- */}
          <View style={styles.header}>
            <View style={styles.headerFila}>
              <View>
                <Text style={styles.saludo}>Hola, Jairo C 👋</Text>
                <Text style={styles.saludoSub}>¿Qué pulpa deseas hoy?</Text>
              </View>
              <View style={styles.avatarCirculo}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
            </View>

            {/* EJERCICIO 2: value + onChangeText — input controlado */}
            <TextInput
              style={styles.buscador}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="🔍  Buscar pulpa de fruta..."
              placeholderTextColor="#8FA890"
            />
          </View>

          {/* ---------- Banner promocional ---------- */}
          <View style={styles.banner}>
            <View style={styles.bannerBadge}>
              <Text style={styles.bannerBadgeTexto}>🍃 100% NATURAL</Text>
            </View>
            <Text style={styles.bannerMarca}>EL IMPERIO DE OPPA</Text>
            <Text style={styles.bannerTitulo}>¡Sabor fresco, directo a tu puerta!</Text>
            <BotonAccion
              texto="Ver productos →"
              colorFondo="#F4B400"
              colorTexto="#2D1B00"
              estilo={{ marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 18 }}
              onPress={() => {}}
            />
          </View>

          {/* ---------- Categorías ---------- */}
          <View style={styles.categoriasHeader}>
            <Text style={styles.categoriasTitulo}>Categorías</Text>
            <Text style={styles.categoriasVerTodas}>Ver todas ›</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriasScroll}>
            {CATEGORIAS.map((cat) => (
              // Al tocar una categoría, reutilizamos el estado "busqueda"
              // del EJERCICIO 2 para filtrar la lista automáticamente.
              <TouchableOpacity
                key={cat.id}
                style={styles.categoriaItem}
                onPress={() => setBusqueda(cat.nombre)}
                activeOpacity={0.7}
              >
                <View style={[styles.categoriaCirculo, { backgroundColor: cat.color }]}>
                  <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
                </View>
                <Text style={styles.categoriaNombre}>{cat.nombre}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.productosTitulo}>Todos los productos</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TarjetaProducto
          item={item}
          // ============================================================
          // EJERCICIO 4: navigate() con parámetros
          // Al tocar una tarjeta, navegamos a "Detalle" enviando el
          // producto tocado: navigate('Pantalla', { datos }).
          // ============================================================
          onPress={() => navigation.navigate('Detalle', { producto: item })}
        />
      )}
      contentContainerStyle={{ paddingBottom: 12 }}
      ListFooterComponent={<View style={{ height: 8 }} />}
    />
    {/* Barra inferior: el botón "Carrito" abre la pantalla del carrito */}
    <BarraInferior navigation={navigation} />
    </View>
  );
}

// ============================================================
// PANTALLA: DETALLE (nueva, parte del EJERCICIO 3 y 4)
// ============================================================
function DetalleScreen({ route, navigation }) {
  // EJERCICIO 4 (continuación): route.params trae lo enviado con
  // navigate('Detalle', { producto: item })
  const { producto } = route.params;

  // CARRITO: traemos la función para agregar productos
  const { agregarAlCarrito } = useCarrito();

  const [cantidad, setCantidad] = useState(1);
  const total = producto.price * cantidad;

  return (
    <View style={styles.detalleContainer}>
      <View style={styles.detalleIcono}>
        <Text style={{ fontSize: 40 }}>{producto.emoji}</Text>
      </View>
      <Text style={styles.detalleTitulo}>{producto.title}</Text>
      <Text style={styles.detallePresentacion}>Presentación: {producto.presentacion}</Text>
      <Text style={styles.detallePrecio}>${producto.price.toLocaleString('es-CO')} c/u</Text>

      <View style={styles.cantidadFila}>
        <Pressable
          style={styles.cantidadBoton}
          onPress={() => setCantidad((prev) => Math.max(1, prev - 1))}
        >
          <Text style={styles.cantidadBotonTexto}>−</Text>
        </Pressable>
        <Text style={styles.cantidadNumero}>{cantidad}</Text>
        <Pressable style={styles.cantidadBoton} onPress={() => setCantidad((prev) => prev + 1)}>
          <Text style={styles.cantidadBotonTexto}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.totalTexto}>Total: ${total.toLocaleString('es-CO')}</Text>

      <BotonAccion
        texto="Agregar al pedido"
        colorFondo="#FF8C42"
        estilo={{ marginBottom: 12, paddingHorizontal: 32 }}
        onPress={() => {
          // CARRITO: guarda el producto con la cantidad elegida y vuelve
          agregarAlCarrito(producto, cantidad);
          navigation.goBack();
        }}
      />

      <Pressable style={styles.volverBoton} onPress={() => navigation.goBack()}>
        <Text style={styles.volverTexto}>← Volver al catálogo</Text>
      </Pressable>
    </View>
  );
}

// ---------- Barra inferior ----------
// El botón "Carrito" navega a la pantalla del carrito y muestra
// un globo con la cantidad de unidades agregadas.
function BarraInferior({ navigation }) {
  const { cantidadTotal } = useCarrito();
  const items = [
    { icono: '🏠', label: 'Inicio', activo: true },
    { icono: '🛍️', label: 'Productos', activo: false },
    { icono: '🛒', label: 'Carrito', activo: false, destino: 'Carrito' },
    { icono: '👤', label: 'Perfil', activo: false },
  ];
  return (
    <View style={styles.barraInferior}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          style={styles.barraItem}
          onPress={() => it.destino && navigation.navigate(it.destino)}
        >
          <View>
            <Text style={{ fontSize: 20, opacity: it.activo ? 1 : 0.6 }}>{it.icono}</Text>
            {it.label === 'Carrito' && cantidadTotal > 0 && (
              <View style={styles.globo}>
                <Text style={styles.globoTexto}>{cantidadTotal}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.barraLabel, it.activo && styles.barraLabelActivo]}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ============================================================
// >>> NUEVA PANTALLA: CARRITO / MI PEDIDO <<<
// Muestra la lista de productos agregados con su cantidad,
// subtotal por producto y el TOTAL del pedido.
// Datos que lee del contexto: items, total, cambiarCantidad,
// quitarDelCarrito, vaciarCarrito.
// ============================================================
function CarritoScreen({ navigation }) {
  const { items, total, cambiarCantidad, quitarDelCarrito, vaciarCarrito } = useCarrito();

  // ---------- CARRITO: estado vacío ----------
  if (items.length === 0) {
    return (
      <View style={styles.carritoVacio}>
        <Text style={{ fontSize: 56 }}>🛒</Text>
        <Text style={styles.carritoVacioTitulo}>Tu pedido está vacío</Text>
        <Text style={styles.carritoVacioSub}>Agrega pulpas desde el catálogo</Text>
        <BotonAccion
          texto="Ver productos"
          colorFondo="#2E9B52"
          estilo={{ marginTop: 16, paddingHorizontal: 28 }}
          onPress={() => navigation.navigate('Lista')}
        />
      </View>
    );
  }

  return (
    <View style={styles.carritoContainer}>
      {/* ---------- CARRITO: listado de productos agregados ---------- */}
      <FlatList
        data={items}
        keyExtractor={(it) => it.producto.id}
        contentContainerStyle={{ paddingBottom: 12 }}
        renderItem={({ item }) => (
          <View style={styles.carritoFila}>
            <View style={styles.tarjetaIcono}>
              <Text style={styles.tarjetaIconoTexto}>{item.producto.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tarjetaTitulo}>{item.producto.title}</Text>
              <Text style={styles.tarjetaPresentacion}>
                {item.producto.presentacion} · ${item.producto.price.toLocaleString('es-CO')} c/u
              </Text>

              {/* Selector de cantidad por producto */}
              <View style={styles.carritoCantidadFila}>
                <Pressable style={styles.cantidadMini} onPress={() => cambiarCantidad(item.producto.id, -1)}>
                  <Text style={styles.cantidadMiniTexto}>−</Text>
                </Pressable>
                <Text style={styles.carritoCantidad}>{item.cantidad}</Text>
                <Pressable style={styles.cantidadMini} onPress={() => cambiarCantidad(item.producto.id, 1)}>
                  <Text style={styles.cantidadMiniTexto}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              {/* Subtotal = precio × cantidad */}
              <Text style={styles.tarjetaPrecio}>
                ${(item.producto.price * item.cantidad).toLocaleString('es-CO')}
              </Text>
              <Pressable onPress={() => quitarDelCarrito(item.producto.id)}>
                <Text style={styles.quitarTexto}>Quitar</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* ---------- CARRITO: total del pedido ---------- */}
      <View style={styles.totalCaja}>
        <View style={styles.totalFila}>
          <Text style={styles.totalEtiqueta}>Total del pedido</Text>
          <Text style={styles.totalValor}>${total.toLocaleString('es-CO')}</Text>
        </View>
        <BotonAccion
          texto="Confirmar pedido"
          colorFondo="#FF8C42"
          onPress={async () => {
            try {
              // 1) Guardar en SQLite (local)
              await guardarPedido(items, total);
            } catch (e) {
              console.log('Error SQLite:', e);
              Alert.alert('Error', 'No se pudo guardar el pedido.');
              return;
            }
            // 2) Enviar a Firebase (nube) sin bloquear la app si falla
            guardarPedidoFirebase(items, total).catch((e) =>
              console.log('Error Firebase:', e)
            );
            vaciarCarrito();
            Alert.alert('¡Pedido confirmado!', 'Gracias por tu compra.');
            navigation.navigate('Lista');
          }}
        />
        <Pressable onPress={vaciarCarrito}>
          <Text style={styles.vaciarTexto}>Vaciar carrito</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// PANTALLA: ADMINISTRADOR
// Formulario para crear productos y lista para eliminarlos.
// Todo se guarda en SQLite y el catálogo se actualiza solo.
// ============================================================
function AdminScreen() {
  const { productos, recargarProductos } = useProductos();
  const [nombre, setNombre] = useState('');
  const [presentacion, setPresentacion] = useState('500g');
  const [precio, setPrecio] = useState('');
  const [emoji, setEmoji] = useState('🍹');

  const guardar = async () => {
    const precioNum = Number(precio.replace(/[^0-9]/g, ''));
    if (!nombre.trim() || !precioNum) {
      Alert.alert('Faltan datos', 'Escribe el nombre y un precio válido.');
      return;
    }
    try {
      await agregarProducto({
        title: nombre.trim(),
        presentacion: presentacion.trim() || '500g',
        price: precioNum,
        emoji: emoji.trim() || '🍹',
      });
      await recargarProductos();
      setNombre('');
      setPrecio('');
      Alert.alert('Listo', 'Producto agregado al catálogo.');
    } catch (e) {
      console.log('Error al agregar producto:', e);
      Alert.alert('Error', 'No se pudo guardar el producto.');
    }
  };

  const confirmarEliminar = (item) => {
    Alert.alert('Eliminar producto', `¿Eliminar "${item.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await eliminarProducto(item.id);
          await recargarProductos();
        },
      },
    ]);
  };

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
      data={productos}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.adminForm}>
          <Text style={styles.adminTitulo}>Nuevo producto</Text>

          <Text style={styles.adminEtiqueta}>Nombre</Text>
          <TextInput
            style={styles.adminInput}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Pulpa de Piña"
            placeholderTextColor="#8FA890"
          />

          <Text style={styles.adminEtiqueta}>Presentación</Text>
          <TextInput
            style={styles.adminInput}
            value={presentacion}
            onChangeText={setPresentacion}
            placeholder="Ej: 500g"
            placeholderTextColor="#8FA890"
          />

          <Text style={styles.adminEtiqueta}>Precio (COP)</Text>
          <TextInput
            style={styles.adminInput}
            value={precio}
            onChangeText={setPrecio}
            placeholder="Ej: 8000"
            placeholderTextColor="#8FA890"
            keyboardType="numeric"
          />

          <Text style={styles.adminEtiqueta}>Emoji</Text>
          <TextInput
            style={styles.adminInput}
            value={emoji}
            onChangeText={setEmoji}
            placeholder="🍍"
            placeholderTextColor="#8FA890"
          />

          <BotonAccion
            texto="Guardar producto"
            colorFondo="#2E9B52"
            estilo={{ marginTop: 8 }}
            onPress={guardar}
          />

          <Text style={[styles.adminTitulo, { marginTop: 24 }]}>
            Productos ({productos.length})
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.tarjeta}>
          <View style={styles.tarjetaIcono}>
            <Text style={styles.tarjetaIconoTexto}>{item.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tarjetaTitulo}>{item.title}</Text>
            <Text style={styles.tarjetaPresentacion}>
              {item.presentacion} · ${item.price.toLocaleString('es-CO')}
            </Text>
          </View>
          <Pressable onPress={() => confirmarEliminar(item)}>
            <Text style={styles.quitarTexto}>Eliminar</Text>
          </Pressable>
        </View>
      )}
      contentContainerStyle={{ paddingBottom: 30 }}
    />
  );
}

// ============================================================
// EJERCICIO 3: Stack Navigator con varias pantallas
// "Bienvenida" (splash) → "Lista" (inicio, sesión 5) → "Detalle"
// ============================================================
export default function App() {
  const [productos, setProductos] = useState([]);
  const [listo, setListo] = useState(false);

  const recargarProductos = async () => setProductos(await obtenerProductos());

  // Al abrir la app: crea la BD (si no existe), inserta productos y los carga
  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await recargarProductos();
      } catch (e) {
        console.log('Error al iniciar la BD:', e);
      } finally {
        setListo(true);
      }
    })();
  }, []);

  if (!listo) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F3D22' }}>
        <ActivityIndicator size="large" color="#F4B400" />
      </View>
    );
  }

  return (
    // Los Providers envuelven todo para compartir productos y carrito
    <ProductosContext.Provider value={{ productos, recargarProductos }}>
    <CarritoProvider>
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Bienvenida">
        <Stack.Screen
          name="Bienvenida"
          component={BienvenidaScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Lista" component={ListaScreen} options={{ title: 'PulpiFrut' }} />
        <Stack.Screen
          name="Detalle"
          component={DetalleScreen}
          options={{ title: 'Detalle del producto' }}
        />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Administrador' }} />
        {/* >>> NUEVA PANTALLA: Carrito / Mi pedido <<< */}
        <Stack.Screen name="Carrito" component={CarritoScreen} options={{ title: 'Mi pedido' }} />
      </Stack.Navigator>
    </NavigationContainer>
    </CarritoProvider>
    </ProductosContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // ---------- Bienvenida ----------
  bienvenidaContainer: {
    flex: 1,
    backgroundColor: '#1F3D22',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  logoCirculo: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    borderColor: '#F4B400',
    backgroundColor: '#14532A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoCorona: { fontSize: 26, marginBottom: 4 },
  logoTitulo: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
  },
  logoSubtitulo: { color: '#F4B400', fontSize: 14, fontWeight: '700', marginTop: 4 },
  pillNatural: {
    backgroundColor: '#2E9B52',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pillNaturalTexto: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  bienvenidaFrase: {
    color: '#EAF5E8',
    fontStyle: 'italic',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  bienvenidaPie: { color: '#B9CDB9', fontSize: 12, marginTop: 16 },
  adminLink: { color: '#DCE9DC', fontSize: 13, marginTop: 10, textDecorationLine: 'underline' },

  // ---------- Botón reutilizable (EJERCICIO 1) ----------
  botonAccion: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  botonAccionPresionado: { opacity: 0.65 },
  botonAccionTexto: { fontWeight: '700', fontSize: 15 },

  // ---------- Encabezado / Inicio ----------
  header: {
    backgroundColor: '#2E9B52',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  saludo: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  saludoSub: { fontSize: 13, color: '#E4F3DF', marginTop: 2 },
  avatarCirculo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buscador: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1F3D22',
  },

  // ---------- Banner ----------
  banner: {
    backgroundColor: '#14532A',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
  },
  bannerBadge: {
    backgroundColor: '#F4B400',
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  bannerBadgeTexto: { fontSize: 11, fontWeight: '700', color: '#2D1B00' },
  bannerMarca: { color: '#CDE9CD', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  bannerTitulo: { color: '#FFFFFF', fontSize: 19, fontWeight: 'bold', lineHeight: 24 },

  // ---------- Categorías ----------
  categoriasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  categoriasTitulo: { fontSize: 17, fontWeight: 'bold', color: '#1F3D22' },
  categoriasVerTodas: { fontSize: 13, color: '#2E9B52', fontWeight: '600' },
  categoriasScroll: { paddingLeft: 16 },
  categoriaItem: { alignItems: 'center', marginRight: 18 },
  categoriaCirculo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  categoriaNombre: { fontSize: 12, color: '#1F3D22', fontWeight: '600' },
  productosTitulo: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1F3D22',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 4,
  },

  // ---------- Tarjeta producto ----------
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#F3FAF0',
    borderRadius: 14,
  },
  tarjetaIcono: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FF8C42',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tarjetaIconoTexto: { fontSize: 22 },
  tarjetaTitulo: { fontSize: 14, fontWeight: '600', color: '#1F3D22' },
  tarjetaPresentacion: { fontSize: 12, color: '#5C7A5E', marginTop: 2 },
  tarjetaPrecio: { fontSize: 15, fontWeight: 'bold', color: '#1F7A3D' },

  // ---------- Detalle ----------
  detalleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  detalleIcono: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: '#FF8C42',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  detalleTitulo: { fontSize: 22, fontWeight: 'bold', color: '#1F3D22', marginBottom: 4 },
  detallePresentacion: { fontSize: 14, color: '#5C7A5E', marginBottom: 8 },
  detallePrecio: { fontSize: 18, color: '#1F7A3D', marginBottom: 20 },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cantidadBoton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E4F3DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidadBotonTexto: { fontSize: 20, fontWeight: 'bold', color: '#1F7A3D' },
  cantidadNumero: { fontSize: 18, fontWeight: '600', marginHorizontal: 20, color: '#1F3D22' },
  totalTexto: { fontSize: 18, fontWeight: 'bold', color: '#1F3D22', marginBottom: 24 },
  volverBoton: {
    backgroundColor: '#1F7A3D',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  volverTexto: { color: '#FFFFFF', fontWeight: '600' },

  // ---------- Barra inferior ----------
  barraInferior: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E4',
    backgroundColor: '#FFFFFF',
  },
  barraItem: { alignItems: 'center', flex: 1 },
  globo: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4D4D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  globoTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },

  // ---------- Pantalla Carrito ----------
  carritoContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  carritoVacio: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  carritoVacioTitulo: { fontSize: 20, fontWeight: 'bold', color: '#1F3D22', marginTop: 12 },
  carritoVacioSub: { fontSize: 14, color: '#5C7A5E', marginTop: 4 },
  carritoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#F3FAF0',
    borderRadius: 14,
  },
  carritoCantidadFila: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cantidadMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E4F3DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidadMiniTexto: { fontSize: 16, fontWeight: 'bold', color: '#1F7A3D' },
  carritoCantidad: { fontSize: 14, fontWeight: '600', marginHorizontal: 12, color: '#1F3D22' },
  quitarTexto: { fontSize: 12, color: '#D64545', marginTop: 10, fontWeight: '600' },
  totalCaja: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E4',
    backgroundColor: '#FFFFFF',
  },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalEtiqueta: { fontSize: 16, color: '#1F3D22', fontWeight: '600' },
  totalValor: { fontSize: 22, fontWeight: 'bold', color: '#1F7A3D' },
  vaciarTexto: {
    textAlign: 'center',
    color: '#8A8A8A',
    fontSize: 13,
    marginTop: 12,
    textDecorationLine: 'underline',
  },
  // ---------- Admin ----------
  adminForm: { padding: 16 },
  adminTitulo: { fontSize: 18, fontWeight: 'bold', color: '#1F3D22', marginBottom: 8 },
  adminEtiqueta: { fontSize: 13, color: '#5C7A5E', marginTop: 10, marginBottom: 4, fontWeight: '600' },
  adminInput: {
    backgroundColor: '#F3FAF0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1F3D22',
  },
  barraLabel: { fontSize: 11, color: '#8A8A8A', marginTop: 2 },
  barraLabelActivo: { color: '#1F7A3D', fontWeight: '700' },

}


);
