console.log("=== SISTEMA DE PROCESAMIENTO DE PEDIDOS ===\n");

// Simulación de API asíncrona
const api = {
  // Simula llamada a base de datos
  obtenerUsuario: (id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const usuarios = {
          1: { id: 1, nombre: "Ana García", email: "ana@email.com" },
          2: { id: 2, nombre: "Carlos López", email: "carlos@email.com" }
        };
        const usuario = usuarios[id];
        if (usuario) {
          resolve(usuario);
        } else {
          reject(new Error(`Usuario ${id} no encontrado`));
        }
      }, 300);
    });
  },

  // Simula procesamiento de pago
  procesarPago: (monto) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (monto > 0 && monto < 10000) {
          resolve({ transaccionId: "txn_" + Date.now(), monto });
        } else {
          reject(new Error("Monto de pago inválido"));
        }
      }, 500);
    });
  },

  // Simula envío de email
  enviarEmailConfirmacion: (usuario, pedido) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`📧 Email enviado a ${usuario.email}: Pedido confirmado`);
        resolve(true);
      }, 200);
    });
  },

  // Simula actualización de inventario
  actualizarInventario: (productos) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const stockInsuficiente = productos.some(p => p.cantidad > 10);
        if (stockInsuficiente) {
          reject(new Error("Stock insuficiente para algunos productos"));
        } else {
          resolve({ actualizado: true, productos });
        }
      }, 400);
    });
  }
};

// Función principal usando async/await
async function procesarPedido(pedido) {
  try {
    console.log("🚀 Iniciando procesamiento de pedido...");

    // Paso 1: Validar usuario
    const usuario = await api.obtenerUsuario(pedido.usuarioId);
    console.log(`✅ Usuario validado: ${usuario.nombre}`);

    // Paso 2: Procesar pago y actualizar inventario en paralelo
    const [resultadoPago, resultadoInventario] = await Promise.all([
      api.procesarPago(pedido.monto),
      api.actualizarInventario(pedido.productos)
    ]);

    console.log(`💳 Pago procesado: $${resultadoPago.monto}`);
    console.log(`📦 Inventario actualizado`);

    // Paso 3: Enviar confirmación
    await api.enviarEmailConfirmacion(usuario, pedido);

    // Resultado exitoso
    return {
      exito: true,
      pedidoId: "ped_" + Date.now(),
      usuario: usuario.nombre,
      monto: pedido.monto,
      productos: pedido.productos.length
    };

  } catch (error) {
    console.error(`❌ Error procesando pedido: ${error.message}`);
    return {
      exito: false,
      error: error.message
    };
  }
}

// Demostración con diferentes escenarios
async function demostrarProcesamiento() {
  const pedidos = [
    {
      usuarioId: 1,
      monto: 150,
      productos: [
        { nombre: "Producto A", cantidad: 2 },
        { nombre: "Producto B", cantidad: 1 }
      ]
    },
    {
      usuarioId: 3, // Usuario inexistente
      monto: 200,
      productos: [{ nombre: "Producto C", cantidad: 1 }]
    },
    {
      usuarioId: 2,
      monto: 15000, // Monto inválido
      productos: [{ nombre: "Producto D", cantidad: 1 }]
    }
  ];

  console.log("=== PROCESANDO PEDIDOS ===\n");

  for (const pedido of pedidos) {
    console.log(`\n📋 Procesando pedido para usuario ${pedido.usuarioId}...`);
    const resultado = await procesarPedido(pedido);

    if (resultado.exito) {
      console.log(`🎉 Pedido ${resultado.pedidoId} completado exitosamente`);
      console.log(`   Usuario: ${resultado.usuario}`);
      console.log(`   Monto: $${resultado.monto}`);
      console.log(`   Productos: ${resultado.productos}`);
    } else {
      console.log(`💥 Pedido fallido: ${resultado.error}`);
    }
  }
}

// Ejecutar demostración
demostrarProcesamiento().then(() => {
  console.log("\n🏁 Demostración completada");
});

// Comparación: Mismo proceso con Promises (más verboso)
function procesarPedidoConPromises(pedido) {
  return api.obtenerUsuario(pedido.usuarioId)
    .then(usuario => {
      console.log(`[PROMISES] Usuario: ${usuario.nombre}`);
      return Promise.all([
        api.procesarPago(pedido.monto),
        api.actualizarInventario(pedido.productos),
        Promise.resolve(usuario)
      ]);
    })
    .then(([pago, inventario, usuario]) => {
      console.log(`[PROMISES] Pago e inventario procesados`);
      return api.enviarEmailConfirmacion(usuario, pedido);
    })
    .then(() => {
      return { exito: true, mensaje: "Pedido procesado con Promises" };
    })
    .catch(error => {
      return { exito: false, error: error.message };
    });
}

// Demostrar comparación
setTimeout(async () => {
  console.log("\n=== COMPARACIÓN: PROMISES VS ASYNC/AWAIT ===\n");

  const pedido = {
    usuarioId: 1,
    monto: 100,
    productos: [{ nombre: "Test", cantidad: 1 }]
  };

  console.log("Con Promises:");
  const resultadoPromises = await procesarPedidoConPromises(pedido);
  console.log("Resultado:", resultadoPromises);

  console.log("\nCon Async/Await:");
  const resultadoAsync = await procesarPedido(pedido);
  console.log("Resultado:", resultadoAsync);
}, 3000);

/*Ejercicio: Crea un sistema de sincronización de datos que descargue información de múltiples APIs, la procese, y la guarde localmente. Implementa reintentos automáticos en caso de fallos, logging detallado de progreso, y manejo de timeouts. Compara la implementación usando callbacks vs Promises vs async/await.*/