// CONFIGURACIÓN DE TU FIREBASE (Ya integrada con tus datos)
const firebaseConfig = {
    apiKey: "AIzaSyB5jfRLHoPSl-2WgAsNesKx4pIQ7XOafis",
    authDomain: "doblep-7ad88.firebaseapp.com",
    databaseURL: "https://doblep-7ad88-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "doblep-7ad88",
    storageBucket: "doblep-7ad88.firebasestorage.app",
    messagingSenderId: "742656133458",
    appId: "1:742656133458:web:988551266251ce49d2928b",
    measurementId: "G-Q7GLFBKKP4"
};

// Inicializar Firebase (Versión compatible con navegador)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let inventario = [];
let ventas = [];
let idSeleccionado = null;

// --- SINCRONIZACIÓN EN TIEMPO REAL ---
db.ref('/').on('value', (snapshot) => {
    const data = snapshot.val() || {};
    
    // Convertir Inventario de objeto a lista
    inventario = data.inventario ? Object.keys(data.inventario).map(key => ({
        id: key, ...data.inventario[key]
    })) : [];

    // Convertir Ventas y poner las últimas primero
    ventas = data.ventas ? Object.keys(data.ventas).map(key => ({
        id: key, ...data.ventas[key]
    })).reverse() : [];

    actualizarVista();
});

let miGrafico; // Para poder destruirlo y recrearlo cuando cambien los datos

// --- LÓGICA DE PRODUCTOS ---
function agregarProducto() {
    const nombre = document.getElementById('nombre').value;
    const stock = parseInt(document.getElementById('stock').value);
    const costo = parseFloat(document.getElementById('costo').value);
    const venta = parseFloat(document.getElementById('venta').value);

    if (nombre && !isNaN(stock)) {
        db.ref('inventario').push({ nombre, stock, costo, venta });
        
        // Limpiar formulario
        document.getElementById('nombre').value = '';
        document.getElementById('stock').value = 0;
        document.getElementById('costo').value = 0;
        document.getElementById('venta').value = 0;
    }
}

// --- LÓGICA DE VENTAS ---
function confirmarVenta() {
    const cant = parseInt(document.getElementById('inputCantidadVenta').value);
    const item = inventario.find(p => p.id === idSeleccionado);

    if (item && cant > 0 && item.stock >= cant) {
        const bruto = item.venta * cant;
        const neto = (item.venta - item.costo) * cant;

        // Descontar stock
        db.ref(`inventario/${idSeleccionado}`).update({
            stock: item.stock - cant
        });

        // Registrar venta
        db.ref('ventas').push({
            producto_id: idSeleccionado,
            nombre_registro: `${cant}x ${item.nombre}`,
            monto_facturado: bruto,
            monto_ganancia: neto,
            cantidad_vendida: cant,
            fecha: Date.now()
        });

        cerrarModales();
    } else {
        alert("Revisa la cantidad o el stock disponible");
    }
}

function anularVenta(ventaId) {
    const v = ventas.find(v => v.id === ventaId);
    if (!v) return;

    const p = inventario.find(prod => prod.id === v.producto_id);
    if (p) {
        db.ref(`inventario/${v.producto_id}`).update({
            stock: p.stock + v.cantidad_vendida
        });
    }
    db.ref(`ventas/${ventaId}`).remove();
}

// --- GESTIÓN DE STOCK MODAL ---
function confirmarCambioStock(operacion) {
    const cantNueva = parseInt(document.getElementById('inputCantidadStock').value);
    const nuevoCostoCompra = parseFloat(document.getElementById('inputNuevoCosto').value);
    const p = inventario.find(i => i.id === idSeleccionado);
    
    if (!p || isNaN(cantNueva) || cantNueva <= 0) return;

    let datosActualizar = {};

    if (operacion === 'sumar') {
        const stockFinal = p.stock + cantNueva;
        
        // Si el usuario introdujo un nuevo costo, calculamos el promedio ponderado
        if (!isNaN(nuevoCostoCompra)) {
            // Fórmula: ((2 * 5€) + (10 * 3€)) / 12 unidades
            const costoPonderado = ((p.stock * p.costo) + (cantNueva * nuevoCostoCompra)) / stockFinal;
            datosActualizar.costo = parseFloat(costoPonderado.toFixed(2));
        }
        
        datosActualizar.stock = stockFinal;
    } else {
        // Si es resta, el costo no cambia, solo bajamos el stock
        datosActualizar.stock = Math.max(0, p.stock - cantNueva);
    }
    
    db.ref(`inventario/${idSeleccionado}`).update(datosActualizar);
    
    // Limpieza
    document.getElementById('inputNuevoCosto').value = "";
    cerrarModales();
}

function confirmarEliminar() {
    db.ref(`inventario/${idSeleccionado}`).remove();
    cerrarModales();
}

// --- INTERFAZ (DOM) ---
function abrirVenta(id) { idSeleccionado = id; document.getElementById('modalVenta').style.display = 'flex'; }
function abrirStock(id) { idSeleccionado = id; document.getElementById('modalStock').style.display = 'flex'; }
function abrirEliminar(id) { idSeleccionado = id; document.getElementById('modalEliminar').style.display = 'flex'; }
function cerrarModales() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }

function actualizarVista() {
    const tbody = document.getElementById('tabla-cuerpo');
    const thistorial = document.getElementById('historial-cuerpo');
    
    // Limpiamos la tabla antes de rellenar
    tbody.innerHTML = '';
    
    // 1. FILTRADO: Creamos una lista que solo contenga los nombres que coincidan con el buscador
    // Usamos toLowerCase() para que no importe si escribes en mayúsculas o minúsculas
    const productosFiltrados = inventario.filter(p => 
        p.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase())
    );

    // 2. DIBUJAR INVENTARIO (Usamos la lista filtrada)
    productosFiltrados.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.nombre}</td>
            <td class="${p.stock < 3 ? 'low-stock' : ''}">${p.stock}</td>
            <td>
                <small style="color: #64748b;">Compra: $${p.costo.toFixed(2)}</small><br>
                <strong>Venta: $${p.venta.toFixed(2)}</strong>
            </td>
            <td>
                <button class="btn btn-sell" onclick="abrirVenta('${p.id}')">Vender</button>
                <button class="btn btn-sec" onclick="abrirStock('${p.id}')">➕/➖</button>
                <button class="btn btn-delete" onclick="abrirEliminar('${p.id}')">✕</button>
            </td>
        </tr>`;
    });

    // 3. DIBUJAR HISTORIAL DE VENTAS
    thistorial.innerHTML = '';
    let fTotal = 0;
    let gTotal = 0;

    ventas.forEach(v => {
        fTotal += v.monto_facturado;
        gTotal += v.monto_ganancia;
        thistorial.innerHTML += `<tr>
            <td style="font-size: 0.7rem;">${new Date(v.fecha).toLocaleTimeString()}</td>
            <td>${v.nombre_registro}</td>
            <td>$${v.monto_facturado.toFixed(2)}</td>
            <td><button class="btn btn-delete" style="padding: 2px 6px;" onclick="anularVenta('${v.id}')">Anular</button></td>
        </tr>`;
    });

    // 4. ACTUALIZAR ESTADÍSTICAS SUPERIORES
    document.getElementById('facturacion-total').innerText = `$${fTotal.toFixed(2)}`;
    document.getElementById('ganancia-total').innerText = `$${gTotal.toFixed(2)}`;
    document.getElementById('total-items').innerText = inventario.reduce((acc, p) => acc + p.stock, 0);
    
    // 5. ACTUALIZAR EL GRÁFICO
    if (typeof actualizarGrafico === "function") {
        actualizarGrafico();
    }
}

function actualizarGrafico() {
    const ctx = document.getElementById('graficoVentas').getContext('2d');
    
    // 1. Preparar etiquetas (últimos 7 días)
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const hoy = new Date();
    let etiquetas = [];
    let totalesPorDia = new Array(7).fill(0);

    // 2. Agrupar ventas de los últimos 7 días
    ventas.forEach(v => {
        const fechaVenta = new Date(v.fecha);
        const diferenciaDias = Math.floor((hoy - fechaVenta) / (1000 * 60 * 60 * 24));
        
        if (diferenciaDias < 7) {
            const indiceDia = fechaVenta.getDay();
            totalesPorDia[indiceDia] += v.monto_facturado;
        }
    });

    // Reordenar para que el día actual sea el último en el gráfico
    const ordenados = [];
    const labelsOrdenadas = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(hoy.getDate() - i);
        const dayIdx = d.getDay();
        labelsOrdenadas.push(diasSemana[dayIdx]);
        ordenados.push(totalesPorDia[dayIdx]);
    }

    // 3. Crear o actualizar el gráfico
    if (miGrafico) miGrafico.destroy(); // Evita que se solapen gráficos viejos

    miGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsOrdenadas,
            datasets: [{
                label: 'Ventas Diarias ($)',
                data: ordenados,
                backgroundColor: '#4f46e5',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function filtrarProductos() {
    // Guardamos lo que el usuario escribe en minúsculas para que no importe si usa Mayúsculas
    filtroBusqueda = document.getElementById('buscador').value.toLowerCase();
    // Volvemos a dibujar la tabla, pero ahora pasará por el filtro
    actualizarVista();
}