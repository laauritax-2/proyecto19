// Dirección de la API pública de Lemmy.
const API_URL = "https://lemmy.world/api/v3";

// Comunidades que aparecen cuando se abre el proyecto por primera vez.
const comunidadesIniciales = ["technology", "linux"];

// Elementos de la página que se usan desde JavaScript.
const formulario = document.getElementById("add-form");
const campoComunidad = document.getElementById("community-input");
const mensaje = document.getElementById("form-message");
const contenedor = document.getElementById("lanes-container");
const botonActualizar = document.getElementById("refresh-all");

// Recupera las comunidades guardadas en el navegador.
let comunidades = JSON.parse(localStorage.getItem("misComunidades")) || comunidadesIniciales;

// Al iniciar, se muestran los carriles y se cargan sus publicaciones.
mostrarCarriles();
comunidades.forEach(cargarPublicaciones);

// Guarda la lista de comunidades en el navegador.
function guardarComunidades() {
    localStorage.setItem("misComunidades", JSON.stringify(comunidades));
}

// Muestra un mensaje debajo del formulario.
function mostrarMensaje(texto, tipo = "") {
    mensaje.textContent = texto;
    mensaje.className = tipo;
}

// Busca una comunidad y obtiene sus publicaciones desde Lemmy.
async function consultarComunidad(nombre) {
    try {
        // Primero se busca la comunidad por su nombre.
        const respuestaComunidad = await fetch(
            `${API_URL}/community?name=${encodeURIComponent(nombre)}`
        );

        // Comprueba si la búsqueda respondió correctamente.
        if (!respuestaComunidad.ok) {
            return { ok: false, error: "No se pudo buscar la comunidad." };
        }

        // Convierte la respuesta en un objeto JavaScript.
        const datosComunidad = await respuestaComunidad.json();
        const comunidad = datosComunidad.community_view?.community;

        // Si no existe, devuelve un mensaje de error.
        if (!comunidad) {
            return { ok: false, error: "No se encontró esa comunidad." };
        }

        // Después de encontrarla, solicita sus publicaciones recientes.
        const respuestaPosts = await fetch(
            `${API_URL}/post/list?community_id=${comunidad.id}&sort=New&limit=10`
        );

        // Comprueba si se pudieron obtener las publicaciones.
        if (!respuestaPosts.ok) {
            return { ok: false, error: "No se pudieron cargar las publicaciones." };
        }

        // Convierte las publicaciones recibidas.
        const datosPosts = await respuestaPosts.json();

        // Devuelve la lista de publicaciones.
        return { ok: true, posts: datosPosts.posts || [] };
    } catch (error) {
        // Muestra el error en la consola para poder revisarlo.
        console.log("Error al conectar con Lemmy:", error);

        // Devuelve un mensaje para el usuario.
        return { ok: false, error: "Error de conexión. Inténtalo nuevamente." };
    }
}

// Crea los carriles según las comunidades guardadas.
function mostrarCarriles() {
    // Borra el contenido anterior.
    contenedor.innerHTML = "";

    // Si no hay comunidades, muestra un aviso.
    if (comunidades.length === 0) {
        contenedor.innerHTML = '<p class="lane-state">No hay comunidades agregadas.</p>';
        return;
    }

    // Crea un carril por cada comunidad.
    comunidades.forEach((nombre) => {
        const carril = document.createElement("article");
        carril.className = "lane";
        carril.id = `carril-${nombre}`;

        // Agrega el título, el botón para eliminar y el mensaje de carga.
        carril.innerHTML = `
            <div class="lane-header">
                <div>
                    <h3>c/${escaparTexto(nombre)}</h3>
                    <p>Publicaciones recientes</p>
                </div>
                <button class="remove-lane" type="button">Eliminar</button>
            </div>
            <div class="lane-content">
                <p class="lane-state">Cargando publicaciones...</p>
            </div>
        `;

        // Agrega el carril a la página.
        contenedor.appendChild(carril);

        // Permite eliminar este carril al pulsar el botón.
        carril.querySelector(".remove-lane").addEventListener("click", () => {
            eliminarComunidad(nombre);
        });
    });
}

// Consulta las publicaciones de una comunidad y las muestra.
async function cargarPublicaciones(nombre) {
    // Busca el carril que corresponde a esa comunidad.
    const carril = document.getElementById(`carril-${nombre}`);

    // Si el carril no existe, termina la función.
    if (!carril) return;

    // Muestra un mensaje mientras se realiza la consulta.
    const contenido = carril.querySelector(".lane-content");
    contenido.innerHTML = '<p class="lane-state">Cargando publicaciones...</p>';

    // Consulta los datos en la API.
    const resultado = await consultarComunidad(nombre);

    // Comprueba que el carril todavía exista.
    if (!document.getElementById(`carril-${nombre}`)) return;

    // Si ocurre un error, lo muestra en el carril.
    if (!resultado.ok) {
        contenido.innerHTML = `<p class="lane-state">${escaparTexto(resultado.error)}</p>`;
        return;
    }

    // Si no hay publicaciones, muestra un aviso.
    if (resultado.posts.length === 0) {
        contenido.innerHTML = '<p class="lane-state">No hay publicaciones para mostrar.</p>';
        return;
    }

    // Recorre las publicaciones recibidas.
    resultado.posts.forEach((item) => {
        const post = item.post;
        const autor = item.creator;
        const votos = item.counts?.score || 0;
        const comentarios = item.counts?.comments || 0;

        // Crea una tarjeta para cada publicación.
        const tarjeta = document.createElement("div");
        tarjeta.className = "post-card";

        // Prepara el enlace de la publicación.
        const enlace = obtenerEnlace(post.ap_id || post.url);

        // Agrega el título, autor, votos y comentarios.
        tarjeta.innerHTML = `
            <h4>${escaparTexto(post.name || "Publicación sin título")}</h4>
            <div class="post-meta">
                <span>Autor: ${escaparTexto(autor?.name || "Desconocido")}</span>
                <span class="post-score">Votos: ${Number(votos).toLocaleString("es-CO")}</span>
                <span>Comentarios: ${Number(comentarios).toLocaleString("es-CO")}</span>
            </div>
            <a class="post-link" href="${enlace}" target="_blank" rel="noopener noreferrer">Ver publicación</a>
        `;

        // Añade la tarjeta al carril.
        contenido.appendChild(tarjeta);
    });
}

// Agrega una comunidad cuando se envía el formulario.
formulario.addEventListener("submit", async (evento) => {
    // Evita que la página se recargue.
    evento.preventDefault();

    // Obtiene el nombre escrito y lo convierte a minúsculas.
    const nombre = campoComunidad.value.trim().toLowerCase().replace(/^c\//, "");

    // Comprueba que el campo no esté vacío.
    if (!nombre) {
        mostrarMensaje("Escribe el nombre de una comunidad.", "error");
        return;
    }

    // Evita agregar una comunidad repetida.
    if (comunidades.includes(nombre)) {
        mostrarMensaje("Esa comunidad ya está agregada.", "error");
        return;
    }

    // Cambia el texto del botón mientras se verifica.
    const boton = formulario.querySelector("button");
    boton.disabled = true;
    boton.textContent = "Buscando...";

    // Consulta la comunidad para comprobar que exista.
    const resultado = await consultarComunidad(nombre);

    // Vuelve a activar el botón.
    boton.disabled = false;
    boton.textContent = "Agregar";

    // Si la comunidad no existe, muestra el error.
    if (!resultado.ok) {
        mostrarMensaje(resultado.error, "error");
        return;
    }

    // Agrega y guarda la comunidad.
    comunidades.push(nombre);
    guardarComunidades();

    // Limpia el campo y muestra una confirmación.
    campoComunidad.value = "";
    mostrarMensaje("Comunidad agregada correctamente.", "success");

    // Actualiza los carriles y carga la nueva comunidad.
    mostrarCarriles();
    cargarPublicaciones(nombre);
});

// Elimina una comunidad de la lista.
function eliminarComunidad(nombre) {
    // Deja en la lista todas las comunidades menos la seleccionada.
    comunidades = comunidades.filter((comunidad) => comunidad !== nombre);

    // Guarda los cambios y actualiza la pantalla.
    guardarComunidades();
    mostrarCarriles();

    // Muestra un mensaje de confirmación.
    mostrarMensaje("Comunidad eliminada.", "success");

    // Vuelve a cargar las comunidades que siguen en la lista.
    comunidades.forEach((comunidad) => {
        const carril = document.getElementById(`carril-${comunidad}`);
        if (carril && carril.querySelector(".lane-content").children.length === 0) {
            cargarPublicaciones(comunidad);
        }
    });
}

// Actualiza las publicaciones de todos los carriles.
botonActualizar.addEventListener("click", () => {
    comunidades.forEach(cargarPublicaciones);
});

// Evita que los textos recibidos se interpreten como código HTML.
function escaparTexto(texto) {
    return String(texto).replace(/[&<>"']/g, (caracter) => {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };
        return caracteres[caracter];
    });
}

// Comprueba que el enlace recibido sea una dirección web válida.
function obtenerEnlace(direccion) {
    try {
        const url = new URL(direccion);

        // Solo permite enlaces HTTP o HTTPS.
        if (url.protocol === "http:" || url.protocol === "https:") {
            return url.href;
        }
    } catch (error) {
        // Si el enlace no es válido, se usa la página principal.
    }

    return "https://lemmy.world/";
}
