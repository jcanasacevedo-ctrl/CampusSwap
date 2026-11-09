import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
// >>> PEGA AQUÍ tus datos de Firebase <<<
// Consola de Firebase → Configuración del proyecto → Tus apps → App web (</>)
const firebaseConfig = {
  apiKey: 'TU_API_KEY',
  authDomain: 'appfruta-cd63a.firebaseapp.com',
  projectId: 'appfruta-cd63a',
  storageBucket: 'appfruta-cd63a.firebasestorage.app',
  messagingSenderId: '1002611830408',
  appId: '1:1002611830408:web:e149449af459e8c94fb93d',
};

const app = initializeApp(firebaseConfig);

export const firestore = getFirestore(app);


// Guarda el pedido en la colección "pedidos" de Firestore
export async function guardarPedidoFirebase(items, total) {
  return await addDoc(collection(firestore, 'pedidos'), {
    fecha: serverTimestamp(),
    total,
    items: items.map((it) => ({
      productoId: it.producto.id,
      titulo: it.producto.title,
      cantidad: it.cantidad,
      precio: it.producto.price,
    })),
  });
}