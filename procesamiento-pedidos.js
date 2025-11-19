// === SISTEMA DE PROCESAMIENTO DE PEDIDOS (CON COMENTARIOS EXPLICATIVOS) ===
//
// Este fichero contiene:
// - La simulación original de APIs (Promesas).
// - Wrappers para usar las mismas APIs con CALLBACKS (para comparar estilos).
// - Funciones utilitarias: logging, timeout, reintentos y guardado local simulado.
// - 3 implementaciones del flujo de procesamiento de pedidos:
//     1) usando CALLBACKS
//     2) usando PROMISES (encadenadas .then/.catch)
//     3) usando ASYNC/AWAIT (más legible)
// - En cada función se incluyen comentarios paso a paso que explican lo que ocurre
//
// Nota: TODO el texto explicativo está dentro de comentarios en el propio código
//       como solicitaste. No hay texto fuera del bloque de código.

// --------------------------- Utilidades comunes ---------------------------

// Logger sencillo con niveles y timestamps para "logging detallado de progreso".
function log(nivel, mensaje) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${nivel}] ${mensaje}`);
}

// Simula persistencia local (por ejemplo, guardar en un archivo o DB local).
// Aquí solo almacenamos en memoria para demostración.
const localDB = { pedidos: [] };
function guardarLocal(pedidoProcesado) {
  // Guardado síncrono en memoria. En una aplicación real sería una llamada a FS o DB.
  localDB.pedidos.push({ ...pedidoProcesado, guardadoAt: new Date().toISOString() });
  log("INFO", `Pedido guardado localmente: ${pedidoProcesado.pedidoId || "sin-id"}`);
  return true;
}

// Timeout promisificado: rechaza si la promesa tarda más de ms
function withTimeout(promise, ms, etiqueta = "") {
  const t = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout (${ms}ms) - ${etiqueta}`)), ms)
  );
  return Promise.race([promise, t]);
}

// Función genérica de reintentos para Promesas.
// - fn: función que retorna una Promise (cuando se llama).
// - intentos: número total de intentos.
// - delayMs: delay entre intentos.
// - etiqueta: texto opcional para logs.
async function reintentarPromise(fn, intentos = 3, delayMs = 300, etiqueta = "") {
  let ultimoError;
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      log("INFO", `${etiqueta} - Intento ${intento} de ${intentos}`);
      const resultado = await fn();
      log("INFO", `${etiqueta} - Exitoso en intento ${intento}`);
      return resultado;
    } catch (err) {
      ultimoError = err;
      log("WARN", `${etiqueta} - Falló intento ${intento}: ${err.message}`);
      if (intento < intentos) {
        // Espera antes del siguiente intento
        await new Promise(res => setTimeout(res, delayMs));
      }
    }
  }
  // Si llegamos acá, todos los intentos fallaron
  throw ultimoError;
}

// Función genérica de reintentos para CALLBACKS.
// - fnWithCallback: función que espera (args..., callback(err, result))
// - args: array de argumentos que hay que pasar antes del callback
// - callbackFinal: callback final (err, result)
// - intentos, delayMs, etiqueta: comportamiento de reintentos
function reintentarCallback(fnWithCallback, args = [], callbackFinal, intentos = 3, delayMs = 300, etiqueta = "") {
  let intento = 0;
  function intentar() {
    intento++;
    log("INFO", `${etiqueta} - Callback intento ${intento} de ${intentos}`);
    // Llamamos la función pasando los args y un callback intermedio
    fnWithCallback(...args, (err, res) => {
      if (!err) {
        log("INFO", `${etiqueta} - Callback exitoso en intento ${intento}`);
        return callbackFinal(null, res);
      }
      log("WARN", `${etiqueta} - Callback falló en intento ${intento}: ${err.message}`);
      if (intento < intentos) {
        setTimeout(intentar, delayMs);
      } else {
        callbackFinal(err);
      }
    });
  }
  intentar();
}

// --------------------------- Simulación de API (Promesas) ---------------------------

// Mantengo tus funciones originales que devuelven Promesas (como las diste),
// pero agrego logs y la posibilidad de forzar timeouts desde los wrappers.
const api = {
  // Simula llamada a base de datos. Resuelve con usuario si existe, rechaza si no.
  obtenerUsuario: (id) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const usuarios = {
          1: { id: 1, nombre: "Ana García", email: "ana@email.com" },
          2: { id: 2, nombre: "Carlos López", email: "carlos@email.com" }
        };
        const usuario = usuarios[id];
        if (usuario) {
          log("DEBUG", `API obtenerUsuario: encontrado usuario ${id}`);
          resolve(usuario);
        } else {
          log("DEBUG", `API obtenerUsuario: usuario ${id} no encontrado`);
          reject(new Error(`Usuario ${id} no encontrado`));
        }
      }, 300); // latencia simulada
    });
  },

  // Simula procesamiento de pago
  procesarPago: (monto) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Rechaza si monto inválido; simula éxito en otro caso
        if (monto > 0 && monto < 10000) {
          const trans = { transaccionId: "txn_" + Date.now(), monto };
          log("DEBUG", `API procesarPago: OK monto ${monto}`);
          resolve(trans);
        } else {
          log("DEBUG", `API procesarPago: monto inválido ${monto}`);
          reject(new Error("Monto de pago inválido"));
        }
      }, 500);
    });
  },

  // Simula envío de email (siempre resuelve)
  enviarEmailConfirmacion: (usuario, pedido) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        log("DEBUG", `API enviarEmail: Email enviado a ${usuario.email}`);
        console.log(`📧 Email enviado a ${usuario.email}: Pedido confirmado`);
        resolve(true);
      }, 200);
    });
  },

  // Simula actualización de inventario; rechaza si alguna cantidad > 10
  actualizarInventario: (productos) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const stockInsuficiente = productos.some(p => p.cantidad > 10);
        if (stockInsuficiente) {
          log("DEBUG", `API actualizarInventario: stock insuficiente`);
          reject(new Error("Stock insuficiente para algunos productos"));
        } else {
          log("DEBUG", `API actualizarInventario: inventario actualizado`);
          resolve({ actualizado: true, productos });
        }
      }, 400);
    });
  }
};

// --------------------------- Wrappers para CALLBACKS ---------------------------
//
// Para comparar "callback style" creamos funciones que usan callbacks
// en lugar de Promises. Internamente reutilizan la simulación (podríamos
// también reimplementar desde cero), pero en este ejemplo envolvemos
// las Promesas llamando al callback cuando la promesa se resuelve/rechaza.

const apiCallback = {
  obtenerUsuario: (id, cb) => {
    // Convertimos la Promesa a callback-style
    api.obtenerUsuario(id)
      .then(usuario => cb(null, usuario))
      .catch(err => cb(err));
  },

  procesarPago: (monto, cb) => {
    api.procesarPago(monto)
      .then(res => cb(null, res))
      .catch(err => cb(err));
  },

  enviarEmailConfirmacion: (usuario, pedido, cb) => {
    api.enviarEmailConfirmacion(usuario, pedido)
      .then(res => cb(null, res))
      .catch(err => cb(err));
  },

  actualizarInventario: (productos, cb) => {
    api.actualizarInventario(productos)
      .then(res => cb(null, res))
      .catch(err => cb(err));
  }
};

// --------------------------- Implementación: CALLBACKS ---------------------------
//
// Aquí mostramos el mismo flujo de negocio pero usando callbacks y reintentos
// y un timeout por operación (simulado). Los comentarios explican cada paso.

function procesarPedidoConCallbacks(pedido, cbFinal) {
  // Paso 0: log de inicio
  log("INFO", `CALLBACKS - Iniciando procesamiento pedido para usuario ${pedido.usuarioId}`);

  // 1) Obtener usuario con reintentos (callback wrapper)
  reintentarCallback(
    apiCallback.obtenerUsuario,
    [pedido.usuarioId],
    (err, usuario) => {
      if (err) {
        log("ERROR", `CALLBACKS - Error obteniendo usuario: ${err.message}`);
        return cbFinal(null, { exito: false, error: err.message });
      }

      log("INFO", `CALLBACKS - Usuario validado: ${usuario.nombre}`);

      // 2) Procesar pago y actualizar inventario EN PARALELO (con callbacks)
      //    Para paralelizar en estilo callback lanzamos ambas operaciones
      //    y sincronizamos con un contador.
      let resultados = {};
      let contador = 0;
      let fallo = null;

      function revisarFinal() {
        contador++;
        if (contador === 2) {
          if (fallo) {
            log("ERROR", `CALLBACKS - Error en paralelo: ${fallo.message}`);
            return cbFinal(null, { exito: false, error: fallo.message });
          }
          // 3) Enviar email (callback)
          apiCallback.enviarEmailConfirmacion(usuario, pedido, (errEmail) => {
            if (errEmail) {
              log("ERROR", `CALLBACKS - Error enviando email: ${errEmail.message}`);
              return cbFinal(null, { exito: false, error: errEmail.message });
            }
            // 4) Guardar localmente y retornar éxito
            const resultadoFinal = {
              exito: true,
              pedidoId: "ped_cb_" + Date.now(),
              usuario: usuario.nombre,
              monto: pedido.monto,
              productos: pedido.productos.length
            };
            guardarLocal(resultadoFinal); // persistencia simulada
            log("INFO", `CALLBACKS - Pedido completado ${resultadoFinal.pedidoId}`);
            return cbFinal(null, resultadoFinal);
          });
        }
      }

      // Llamado a procesarPago con reintentos (callback)
      reintentarCallback(
        apiCallback.procesarPago,
        [pedido.monto],
        (errPago, resPago) => {
          if (errPago) {
            fallo = errPago;
          } else {
            resultados.pago = resPago;
            log("INFO", `CALLBACKS - Pago procesado: $${resPago.monto}`);
          }
          revisarFinal();
        },
        3, // intentos
        300, // delay
        "CALLBACKS-procesarPago"
      );

      // Llamado a actualizarInventario con reintentos (callback)
      reintentarCallback(
        apiCallback.actualizarInventario,
        [pedido.productos],
        (errInv, resInv) => {
          if (errInv) {
            fallo = errInv;
          } else {
            resultados.inv = resInv;
            log("INFO", `CALLBACKS - Inventario actualizado`);
          }
          revisarFinal();
        },
        3,
        300,
        "CALLBACKS-actualizarInventario"
      );
    },
    3, // intentos para obtener usuario
    300,
    "CALLBACKS-obtenerUsuario"
  );
}

// --------------------------- Implementación: PROMISES ---------------------------
//
// Versión usando Promises encadenadas (.then/.catch), con reintentos y timeout.
// Comentarios en cada bloque explican la lógica.

function procesarPedidoConPromises(pedido) {
  log("INFO", `PROMISES - Iniciando procesamiento pedido para usuario ${pedido.usuarioId}`);

  // Intento obtener usuario con reintentos (usando reintentarPromise)
  return reintentarPromise(() => withTimeout(api.obtenerUsuario(pedido.usuarioId), 1000, "obtenerUsuario"), 3, 300, "PROMISES-obtenerUsuario")
    .then(usuario => {
      log("INFO", `PROMISES - Usuario validado: ${usuario.nombre}`);

      // Procesar pago e inventario en paralelo, ambos con timeout y reintentos independientes
      const pagoPromise = reintentarPromise(() => withTimeout(api.procesarPago(pedido.monto), 1500, "procesarPago"), 3, 300, "PROMISES-procesarPago");
      const inventarioPromise = reintentarPromise(() => withTimeout(api.actualizarInventario(pedido.productos), 1200, "actualizarInventario"), 3, 300, "PROMISES-actualizarInventario");

      // Ejecutamos en paralelo
      return Promise.all([pagoPromise, inventarioPromise, Promise.resolve(usuario)]);
    })
    .then(([resultadoPago, resultadoInventario, usuario]) => {
      log("INFO", `PROMISES - Pago procesado: $${resultadoPago.monto}`);
      log("INFO", `PROMISES - Inventario actualizado`);

      // Enviar email (con timeout simple)
      return withTimeout(api.enviarEmailConfirmacion(usuario, pedido), 1000, "enviarEmail")
        .then(() => ({ usuario, resultadoPago }));
    })
    .then(({ usuario, resultadoPago }) => {
      // Guardamos localmente el pedido procesado
      const resultadoFinal = {
        exito: true,
        pedidoId: "ped_prom_" + Date.now(),
        usuario: usuario.nombre,
        monto: pedido.monto,
        productos: pedido.productos.length
      };
      guardarLocal(resultadoFinal);
      log("INFO", `PROMISES - Pedido completado ${resultadoFinal.pedidoId}`);
      return resultadoFinal;
    })
    .catch(error => {
      log("ERROR", `PROMISES - Error procesando pedido: ${error.message}`);
      return { exito: false, error: error.message };
    });
}

// --------------------------- Implementación: ASYNC/AWAIT ---------------------------
//
// Versión más legible usando async/await. Usa conTimeout y reintentarPromise para
// timeouts y reintentos. Comentarios detallados por paso.

async function procesarPedido(pedido) {
  log("INFO", `ASYNC/AWAIT - Iniciando procesamiento pedido para usuario ${pedido.usuarioId}`);
  try {
    // Paso 1: Obtener usuario con reintentos y timeout.
    // - withTimeout para asegurar que la llamada no quede pendiente indefinidamente.
    // - reintentarPromise para realizar reintentos automáticos si falla.
    const usuario = await reintentarPromise(
      () => withTimeout(api.obtenerUsuario(pedido.usuarioId), 1000, "obtenerUsuario"),
      3,
      300,
      "ASYNC-obtenerUsuario"
    );
    log("INFO", `ASYNC/AWAIT - Usuario validado: ${usuario.nombre}`);

    // Paso 2: Procesar pago y actualizar inventario en paralelo.
    // Cada llamada envuelta en reintentos y timeouts individuales.
    const pagoPromise = reintentarPromise(
      () => withTimeout(api.procesarPago(pedido.monto), 1500, "procesarPago"),
      3,
      300,
      "ASYNC-procesarPago"
    );
    const inventarioPromise = reintentarPromise(
      () => withTimeout(api.actualizarInventario(pedido.productos), 1200, "actualizarInventario"),
      3,
      300,
      "ASYNC-actualizarInventario"
    );

    // Promise.all para ejecutar en paralelo y esperar ambos.
    const [resultadoPago, resultadoInventario] = await Promise.all([pagoPromise, inventarioPromise]);

    log("INFO", `ASYNC/AWAIT - Pago procesado: $${resultadoPago.monto}`);
    log("INFO", `ASYNC/AWAIT - Inventario actualizado`);

    // Paso 3: Enviar confirmación por email (con timeout).
    await withTimeout(api.enviarEmailConfirmacion(usuario, pedido), 1000, "enviarEmail");
    log("INFO", `ASYNC/AWAIT - Email de confirmación enviado a ${usuario.email}`);

    // Paso 4: Guardar resultado local y devolver estructura final.
    const resultadoFinal = {
      exito: true,
      pedidoId: "ped_" + Date.now(),
      usuario: usuario.nombre,
      monto: pedido.monto,
      productos: pedido.productos.length
    };

    guardarLocal(resultadoFinal);
    log("INFO", `ASYNC/AWAIT - Pedido completado ${resultadoFinal.pedidoId}`);
    return resultadoFinal;

  } catch (error) {
    // Manejo de errores centralizado: incluimos logging detallado.
    log("ERROR", `ASYNC/AWAIT - Error procesando pedido: ${error.message}`);
    return { exito: false, error: error.message };
  }
}

// --------------------------- DEMOSTRACIÓN Y COMPARACIÓN ---------------------------
//
// Creamos varios pedidos (válidos e inválidos) y los procesamos usando las 3
// implementaciones para que puedas comparar logs y comportamiento.

async function demostrarComparacion() {
  log("INFO", "=== INICIO DEMOSTRACIÓN COMPARATIVA ===");

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
      usuarioId: 3, // Usuario inexistente -> fallará en obtenerUsuario
      monto: 200,
      productos: [{ nombre: "Producto C", cantidad: 1 }]
    },
    {
      usuarioId: 2,
      monto: 15000, // Monto inválido -> fallará en procesarPago
      productos: [{ nombre: "Producto D", cantidad: 1 }]
    },
    {
      usuarioId: 2,
      monto: 200,
      productos: [{ nombre: "Producto E", cantidad: 20 }] // cantidad > 10 -> inventory fail
    }
  ];

  // Procesamiento secuencial y demostrativo para ASYNC/AWAIT
  log("INFO", "=== PROCESANDO CON ASYNC/AWAIT ===");
  for (const pedido of pedidos) {
    log("INFO", `ASYNC DEMO - Procesando pedido para usuario ${pedido.usuarioId}`);
    const resultado = await procesarPedido(pedido);
    log("INFO", `ASYNC DEMO - Resultado: ${JSON.stringify(resultado)}`);
  }

  // Procesamiento secuencial con PROMISES (se muestra un ejemplo con un pedido simple)
  log("INFO", "=== PROCESANDO UN PEDIDO CON PROMISES (EJEMPLO) ===");
  const pedidoEj = { usuarioId: 1, monto: 100, productos: [{ nombre: "Test", cantidad: 1 }] };
  procesarPedidoConPromises(pedidoEj)
    .then(res => log("INFO", `PROMISES DEMO - Resultado: ${JSON.stringify(res)}`))
    .catch(err => log("ERROR", `PROMISES DEMO - Error inesperado: ${err.message}`));

  // Procesamiento con CALLBACKS: usar callback final para obtener resultado.
  log("INFO", "=== PROCESANDO UN PEDIDO CON CALLBACKS (EJEMPLO) ===");
  const pedidoCb = { usuarioId: 1, monto: 120, productos: [{ nombre: "CbTest", cantidad: 1 }] };
  procesarPedidoConCallbacks(pedidoCb, (err, resultado) => {
    // Nota: seguimos el patrón (err, result) aunque nuestras funciones retornan {exito:...}
    if (err) {
      log("ERROR", `CALLBACKS DEMO - Error crítico: ${err.message}`);
    } else {
      log("INFO", `CALLBACKS DEMO - Resultado: ${JSON.stringify(resultado)}`);
    }
  });

  log("INFO", "=== DEMOSTRACIÓN INICIADA (algunas operaciones son asíncronas) ===");
}

// Ejecutamos la demostración principal.
// (Se usa setTimeout final en caso de que quieras observar orden de logs; no es obligatorio.)
demostrarComparacion().then(() => {
  // Advertencia: las operaciones con callbacks/promises pueden seguir ejecutándose.
  log("INFO", "Demostración (async/await) finalizada (otras demo async pueden seguir).");
});

// --------------------------- FIN DEL FICHERO ---------------------------
//
// Aquí termina el código. Todos los comentarios explicativos, pasos y
// funciones solicitadas (reintentos, logging, timeouts, callbacks/promises/async)
// están integrados dentro del propio código como comentarios.