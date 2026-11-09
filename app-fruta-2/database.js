import * as SQLite from 'expo-sqlite';

let db = null;

// Productos iniciales (se insertan solo la primera vez)
const PRODUCTOS_INICIALES = [
  { id: '1', title: 'Pulpa de Mango', presentacion: '500g', price: 8000, emoji: '🥭' },
  { id: '2', title: 'Pulpa de Maracuyá', presentacion: '500g', price: 7500, emoji: '🍈' },
  { id: '3', title: 'Pulpa de Guanábana', presentacion: '500g', price: 9000, emoji: '🍈' },
  { id: '4', title: 'Pulpa de Mora', presentacion: '500g', price: 7000, emoji: '🫐' },
  { id: '5', title: 'Pulpa de Fresa', presentacion: '500g', price: 8500, emoji: '🍓' },
  { id: '6', title: 'Pulpa de Lulo', presentacion: '500g', price: 7800, emoji: '🍋' },
];

// Abre (o crea) el archivo pulpifrut.db, crea las tablas e inserta los productos
export async function initDB() {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('pulpifrut.db');

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      presentacion TEXT NOT NULL,
      price REAL NOT NULL,
      emoji TEXT
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pedido_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      producto_id TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      precio REAL NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    );
  `);

  // Insertar productos solo si la tabla está vacía (evita duplicados)
  const fila = await db.getFirstAsync('SELECT COUNT(*) AS total FROM productos');
  if (fila.total === 0) {
    await db.withTransactionAsync(async () => {
      for (const p of PRODUCTOS_INICIALES) {
        await db.runAsync(
          'INSERT INTO productos (id, title, presentacion, price, emoji) VALUES (?, ?, ?, ?, ?)',
          p.id, p.title, p.presentacion, p.price, p.emoji
        );
      }
    });
  }

  return db;
}

export async function obtenerProductos() {
  const base = await initDB();
  return await base.getAllAsync('SELECT * FROM productos ORDER BY CAST(id AS INTEGER)');
}

// Guarda un pedido completo y devuelve su id
export async function guardarPedido(items, total) {
  const base = await initDB();
  let pedidoId;

  await base.withTransactionAsync(async () => {
    const r = await base.runAsync(
      'INSERT INTO pedidos (fecha, total) VALUES (?, ?)',
      new Date().toISOString(), total
    );
    pedidoId = r.lastInsertRowId;

    for (const it of items) {
      await base.runAsync(
        'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)',
        pedidoId, it.producto.id, it.cantidad, it.producto.price
      );
    }
  });

  return pedidoId;
}

// Agrega un producto nuevo y devuelve el producto creado
export async function agregarProducto({ title, presentacion, price, emoji }) {
  const base = await initDB();
  const id = Date.now().toString(); // id único
  await base.runAsync(
    'INSERT INTO productos (id, title, presentacion, price, emoji) VALUES (?, ?, ?, ?, ?)',
    id, title, presentacion, price, emoji
  );
  return { id, title, presentacion, price, emoji };
}

// Elimina un producto por id
export async function eliminarProducto(id) {
  const base = await initDB();
  await base.runAsync('DELETE FROM productos WHERE id = ?', id);
}
