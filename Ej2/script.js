class EstadoTurnero {
    constructor(datos) {
        this.limiteInferior = Number(datos["limite inferior"]);
        this.limiteSuperior = Number(datos["limite superior"]);
        this.numeros = Array.isArray(datos.números)
            ? datos.números.map((item) => Number(item.numero))
            : [];
    }

    get cantidadDisponible() {
        return this.limiteSuperior - this.limiteInferior + 1 - this.numeros.length;
    }

    contiene(numero) {
        return this.numeros.includes(numero);
    }

    dentroDelRango(numero) {
        return numero >= this.limiteInferior && numero <= this.limiteSuperior;
    }

    comoJson() {
        return {
            "limite inferior": this.limiteInferior,
            "limite superior": this.limiteSuperior,
            "números": this.numeros.map((numero) => ({ numero }))
        };
    }
}

class ApiTurnero {
    async solicitar(accion, datos = {}) {
        const respuesta = await fetch(`api.php?accion=${accion}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.ok) {
            throw new Error(resultado.mensaje || "No se pudo completar la operación.");
        }
        return resultado.datos;
    }

    cargar() {
        return this.solicitar("cargar");
    }

    guardar(estado) {
        return this.solicitar("guardar", estado.comoJson());
    }

    reiniciar(estado) {
        return this.solicitar("reiniciar", {
            "limite inferior": estado.limiteInferior,
            "limite superior": estado.limiteSuperior
        });
    }
}

class TurneroAleatorio {
    constructor(api) {
        this.api = api;
        this.estado = null;
    }

    establecerEstado(datos) {
        this.estado = new EstadoTurnero(datos);
        return this.estado;
    }

    validarLimites(inferior, superior) {
        return Number.isInteger(inferior)
            && Number.isInteger(superior)
            && inferior >= 0
            && superior >= inferior;
    }

    async actualizarLimites(inferior, superior) {
        if (!this.validarLimites(inferior, superior)) {
            throw new Error("Ingresá límites enteros válidos. El inferior debe ser menor o igual al superior.");
        }
        const estado = new EstadoTurnero({
            "limite inferior": inferior,
            "limite superior": superior,
            "números": []
        });
        return this.establecerEstado(await this.api.guardar(estado));
    }

    async generar() {
        if (!this.estado || this.estado.cantidadDisponible <= 0) {
            return null;
        }

        const rango = this.estado.limiteSuperior - this.estado.limiteInferior + 1;
        const candidato = Math.floor(Math.random() * rango) + this.estado.limiteInferior;
        let numero = this.buscarDisponible(candidato, 1);
        if (numero === null) {
            numero = this.buscarDisponible(candidato, -1);
        }
        if (numero === null) {
            return null;
        }

        this.estado.numeros.push(numero);
        await this.api.guardar(this.estado);
        return numero;
    }

    buscarDisponible(desde, paso) {
        for (let numero = desde; this.estado.dentroDelRango(numero); numero += paso) {
            if (!this.estado.contiene(numero)) {
                return numero;
            }
        }
        return null;
    }

    async reiniciar() {
        this.establecerEstado(await this.api.reiniciar(this.estado));
        return this.estado;
    }
}

class AplicacionTurnero {
    constructor() {
        this.api = new ApiTurnero();
        this.turnero = new TurneroAleatorio(this.api);
        this.elementos = {
            formulario: document.querySelector("#form-configuracion"),
            inferior: document.querySelector("#limite-inferior"),
            superior: document.querySelector("#limite-superior"),
            generar: document.querySelector("#btn-generar"),
            reiniciar: document.querySelector("#btn-reiniciar"),
            numero: document.querySelector("#numero-actual"),
            rango: document.querySelector("#rango-actual"),
            cantidad: document.querySelector("#cantidad-generados"),
            historial: document.querySelector("#historial"),
            mensaje: document.querySelector("#mensaje"),
            estadoCarga: document.querySelector("#estado-carga")
        };
    }

    iniciar() {
        this.elementos.formulario.addEventListener("submit", (evento) => this.guardarLimites(evento));
        this.elementos.generar.addEventListener("click", () => this.generarNumero());
        this.elementos.reiniciar.addEventListener("click", () => this.reiniciar());
        this.cargar();
    }

    async cargar() {
        try {
            this.actualizarVista(this.turnero.establecerEstado(await this.api.cargar()));
            this.elementos.estadoCarga.textContent = "";
            this.elementos.estadoCarga.className = "";
        } catch (error) {
            this.mostrarMensaje(error.message, "danger");
            this.elementos.estadoCarga.textContent = "";
            this.elementos.estadoCarga.className = "";
        }
    }

    async guardarLimites(evento) {
        evento.preventDefault();
        const inferior = Number(this.elementos.inferior.value);
        const superior = Number(this.elementos.superior.value);
        try {
            this.bloquear(true);
            this.actualizarVista(await this.turnero.actualizarLimites(inferior, superior));
            this.mostrarMensaje("Límites guardados. Se reinició el historial para usar el nuevo rango.", "success");
            this.elementos.estadoCarga.textContent = "";
            this.elementos.estadoCarga.className = "";
        } catch (error) {
            this.mostrarMensaje(error.message, "danger");
        } finally {
            this.bloquear(false);
        }
    }

    async generarNumero() {
        try {
            this.bloquear(true);
            const numero = await this.turnero.generar();
            if (numero === null) {
                this.mostrarMensaje("Todos los números están generados.", "warning");
                return;
            }
            this.actualizarVista(this.turnero.estado, numero);
            this.elementos.mensaje.classList.add("hidden");
            this.elementos.mensaje.textContent = "";
        } catch (error) {
            this.mostrarMensaje(error.message, "danger");
        } finally {
            this.bloquear(false);
        }
    }

    async reiniciar() {
        try {
            this.bloquear(true);
            this.actualizarVista(await this.turnero.reiniciar());
            this.mostrarMensaje("El turnero fue reiniciado.", "danger");
            this.elementos.estadoCarga.className = "";
            this.elementos.estadoCarga.textContent = "";
        } catch (error) {
            this.mostrarMensaje(error.message, "danger");
        } finally {
            this.bloquear(false);
        }
    }

    actualizarVista(estado, ultimoNumero = null) {
        this.elementos.inferior.value = estado.limiteInferior;
        this.elementos.superior.value = estado.limiteSuperior;
        this.elementos.numero.textContent = ultimoNumero === null ? "—" : ultimoNumero;
        this.elementos.rango.textContent = `Rango actual: ${estado.limiteInferior} a ${estado.limiteSuperior}`;
        this.elementos.cantidad.textContent = estado.numeros.length;
        this.elementos.generar.disabled = estado.cantidadDisponible <= 0;
        this.elementos.historial.innerHTML = estado.numeros.length
            ? estado.numeros.map((numero) => `<span class="inline-flex min-w-11 items-center justify-center rounded-full border border-violet-300/40 bg-violet-500/10 px-2.5 py-1.5 text-sm font-bold text-violet-100 shadow-sm shadow-violet-950/40">${numero}</span>`).join("")
            : '<p class="text-sm text-slate-300">Todavía no se generaron números.</p>';
    }

    mostrarMensaje(texto, tipo) {
        this.elementos.mensaje.textContent = texto;

        const colorMap = {
            success: "turnero-alert-success",
            danger: "turnero-alert-danger",
            warning: "turnero-alert-warning"
        };

        this.elementos.mensaje.className = `turnero-alert ${colorMap[tipo] || colorMap.success}`;
        this.elementos.mensaje.classList.remove("hidden");
    }

    bloquear(bloqueado) {
        this.elementos.generar.disabled = bloqueado || this.turnero.estado?.cantidadDisponible <= 0;
        this.elementos.reiniciar.disabled = bloqueado;
        this.elementos.formulario.querySelector("button").disabled = bloqueado;
    }
}

document.addEventListener("DOMContentLoaded", () => new AplicacionTurnero().iniciar());