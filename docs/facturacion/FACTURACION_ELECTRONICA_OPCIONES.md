# Facturación Electrónica en Paraguay (SIFEN / e-Kuatia) — Opciones para Luxury Garage

> **Documento de análisis de producto/fiscal.** Investigación de los facturadores electrónicos habilitados en Paraguay para integrar la emisión de factura electrónica legal al backend Node.js de Luxury Garage, tras cada pago aprobado por Bancard.
>
> Fecha: 2026-06-22 · Autor: análisis con búsqueda web actualizada.
>
> ⚠️ **Aviso de honestidad:** los **precios cambian con frecuencia** y varios no están publicados (certificados digitales, planes "enterprise"). Las cifras de este documento son **aproximadas y referenciales** — hay que confirmarlas con el contador y pidiendo cotización formal a cada proveedor. Donde no pude verificar un dato, lo marco explícitamente como **(no verificado)**.

---

## 1. Contexto: qué es SIFEN / e-Kuatia / DNIT

- **DNIT** — Dirección Nacional de Ingresos Tributarios. Es el organismo recaudador del Paraguay (sucesora de la antigua SET, Subsecretaría de Estado de Tributación). Administra todo el sistema tributario, incluida la facturación electrónica. Muchos documentos técnicos todavía dicen "SET".
- **SIFEN** — Sistema Integrado de Facturación Electrónica Nacional. Es la plataforma central del Estado que **recibe, valida y aprueba** los documentos electrónicos. Cuando emitís una factura electrónica, no es "legal" hasta que SIFEN la **aprueba**. Ya superó **1.700 millones** de Documentos Tributarios Electrónicos aprobados.
- **e-Kuatia** — La marca/programa público de facturación electrónica. Tiene dos sabores (ver sección 2): el sistema gratuito **e-Kuatia'i** (para chicos) y el esquema **e-Kuatia** de integración (para medianos/grandes, vía desarrollo propio o proveedor).

### Comprobante electrónico — los conceptos clave

- **DE (Documento Electrónico)** — el XML que generás según el **Manual Técnico de SIFEN** (versión vigente **V150**). Contiene emisor, receptor, ítems, impuestos, totales, etc.
- **DTE (Documento Tributario Electrónico)** — el DE **una vez firmado digitalmente y aprobado por SIFEN**. Recién ahí tiene validez fiscal. (Se usa también "DTE" como sinónimo genérico de comprobante electrónico aprobado.)
- **CDC** — Código de Control, un identificador único de 44 dígitos que SIFEN asigna a cada documento. Va en el QR.
- **KuDE** — *Kuatia Documento Electrónico*. Es la **representación gráfica imprimible/PDF** del DTE, con su **QR** y CDC, que se le entrega al cliente. El KuDE es lo que el cliente "ve" como factura; el valor legal lo tiene el XML aprobado, no el PDF.
- **Tipos de documento** del ecosistema: Factura Electrónica, Factura Electrónica de Exportación, Autofactura, Nota de Crédito y Débito electrónicas, Comprobantes de Retención, etc. Para un lavadero lo normal es **Factura Electrónica** y eventualmente **Nota de Crédito** (devoluciones/anulaciones).

### Certificado digital y "timbrado"

- **Certificado digital cualificado tipo F1** — Es la **firma electrónica** con la que se firma el XML. Sin firma válida, SIFEN rechaza el documento. Para facturación electrónica se exige el certificado **Tipo F1 ("Certificado Cualificado Tributario")**. Validez **1 año** (renovación anual). Se compra a un **Prestador de Servicios de Confianza** acreditado por el MIC (Ministerio de Industria y Comercio) / AC Raíz — p. ej. **Code100, eFirma, Documenta S.A., VIT S.A.**
- El certificado es un archivo **`.p12` / `.pfx`** protegido con contraseña (PKCS#12). El que firma necesita ese archivo + su clave.
- **Timbrado** — En el mundo electrónico, el "timbrado" se gestiona como **autorización y rango de numeración** dentro de Marangatú/SIFEN (el sistema asigna establecimiento, punto de expedición y numeración autorizada). No es el sticker físico de antes; es la **habilitación electrónica** del emisor para una serie de documentos. Esto se tramita en el portal de la DNIT (Marangatú).

> **Para Luxury Garage:** el negocio necesita (1) **RUC activo**, (2) estar **habilitado como Facturador Electrónico** en e-Kuatia, (3) un **certificado digital F1** vigente, y (4) un **medio para generar/firmar/enviar el XML** (que es donde entran las opciones de la sección 3).

---

## 2. Caminos posibles

### (a) e-Kuatia'i — sistema **gratuito** de la DNIT

- **Qué es:** una **web pública y gratuita** de la DNIT para emitir facturas electrónicas, pensada para **contribuyentes de bajo volumen**.
- **Requisitos / límites:** **un solo establecimiento y un solo punto de expedición**, RUC activo, y certificado de firma. Dato relevante: la DNIT provee **gratuitamente** un Certificado Cualificado de Firma Electrónica para e-Kuatia'i (trámite en la PAC de Asunción, según Resolución DNIT N° 757/2024).
- **Limitación crítica para nosotros:** es una **interfaz web manual** (cargás la factura a mano en el portal). **No expone una API** para integrarla al backend. Sirve para emitir, pero **no automatiza** la emisión tras un pago de Bancard.
- **Cuándo conviene:** volumen muy bajo, o como **plan B / contingencia manual** mientras se define la integración.

### (b) e-Kuatia (esquema de integración propia)

- **Qué es:** el esquema para **medianos/grandes** o quien quiera integrar. El contribuyente (o su software) **genera el XML, lo firma y lo envía directamente a los web services de SIFEN** (recepción síncrona, lote asíncrono, consulta de estado, eventos, consulta RUC).
- **Implica:** desarrollar/operar contra los **web services SOAP/XML de SIFEN** siguiendo el Manual Técnico V150, manejar el certificado, los reintentos, los estados, los eventos (cancelación, inutilización), etc. Es la **vía más control + más trabajo**.
- Para Node.js, esta vía **se puede hacer con librerías open source** (ver 3) en lugar de escribir todo desde cero.

### (c) Facturadores / proveedores privados habilitados con API (PSE)

- **Qué es:** empresas que ya resolvieron toda la complejidad de SIFEN y te dan una **API REST**: vos les mandás un **JSON**, ellos **generan el XML V150, lo firman con tu certificado, lo envían a SIFEN, te devuelven el estado y el KuDE/PDF**.
- **Ventaja:** integración en días, no meses; ellos mantienen el sistema al día con cada cambio de la DNIT (validaciones nuevas, versiones del manual).
- **Costo:** mensualidad + a veces costo por documento. El **certificado digital se paga aparte** (no lo incluye casi ninguno).
- **Es la vía recomendada por defecto** para un negocio como Luxury Garage que quiere automatizar y no mantener infraestructura fiscal.

---

## 3. Comparativo de proveedores/facturadores reales con API REST

> Todos los siguientes **existen y están operando en Paraguay (verificado vía web, junio 2026)**. Precios marcados como aproximados/referenciales — confirmar con cotización.

### Resumen rápido

| Proveedor | Tipo | API REST | Maneja firma/cert. | Costo aprox. (referencial) | Encaje con Node.js |
|---|---|---|---|---|---|
| **FacturaSend** (TIPS S.A.) | SaaS + self-hosted | ✅ Sí (JSON) | ✅ Sí (subís tu .p12) | ~Gs 100k–525k/mes por planes de docs, o **USD 110/mes self-hosted ilimitado** | ⭐ Muy bueno (ejemplos JS/Axios) |
| **Librerías TIPS-SA / marcosjara (npm)** | Open source (self-build) | N/A (las usás vos) | ✅ vos firmás con .p12 | **Gratis (MIT)** + tu dev time | ⭐⭐ Nativo Node.js |
| **Sifende** | SaaS | ✅ Sí (JSON) | ✅ Sí (.p12 cifrado) | Plan free 100 docs/mes; Gs 99k; Gs 250k; Gs 600k+/RUC/mes | ⭐ Muy bueno |
| **FactPy** | SaaS (POS + API) | ✅ Sí (REST/JSON) | ✅ Sí | (no publicado — pedir) | Bueno (API agnóstica) |
| **BillPy** | SaaS | ✅ Sí (REST) | ⚠️ Te ayuda a comprar cert. aparte | Desde **Gs 79.000/mes** (+ cert. aparte) | Bueno (webhooks, tokens) |
| **Roshka `rshk-jsifenlib`** | Open source (self-build) | N/A | ✅ vos firmás (PFX) | **Gratis (MIT)** + dev time | ⚠️ Es **Java**, no Node |

### Detalle por proveedor

#### 1) FacturaSend — *TIPS S.A.* (recomendado para evaluar primero)
- **Qué es:** plataforma **paraguaya** de facturación electrónica con **API REST** completa. Vos mandás JSON y ellos generan/firman/envían a SIFEN y devuelven XML + **KuDE PDF**.
- **API REST:** sí, bien documentada (`docs.facturasend.com.py`). Endpoints clave: `POST /lote/create` (hasta 50 docs por request), `POST /recibo/create`, consulta `GET /de/id/{id}` y `GET /de/cdc/{cdc}`, estado `POST /de/estado`, descarga XML `GET /de/xml` y **KuDE PDF `POST /de/pdf`**, reenvío por email `POST /de/email`, y **eventos** (cancelación/inutilización/conformidad). Ejemplos en **cURL y JavaScript (Axios)** → encaje directo con Node.js.
- **Firma/certificado:** la plataforma **firma el XML con el certificado de la empresa** (subís tu `.p12`). Provee certificados de prueba para ambiente test/desconectado.
- **Costos (referenciales):**
  - **Nube:** Plan 200 = Gs 100.000/mes (hasta 200 docs, Gs 500/doc); Plan 500 = Gs 225.000/mes; Plan 1000 = Gs 400.000/mes; Plan 1500 = Gs 525.000/mes. Implementación gratuita. No se cobra el ambiente de test; la facturación arranca con el primer documento productivo en SIFEN.
  - **Self-hosted / nube privada:** **USD 110/mes por nodo**, documentos y usuarios **ilimitados** (+ USD 5/mes almacenamiento extra).
- **Node.js:** ⭐ excelente. Además, **TIPS-SA es la misma gente** que mantiene las librerías npm open source (ver punto 2), así que el ecosistema está muy alineado con Node.

#### 2) Librerías open source de TIPS-SA / `marcosjara` (npm) — *self-build en Node nativo*
La opción "hazlo vos mismo" pero **sin escribir el XML desde cero**. Tres paquetes **MIT, en npm, activos**:
- **`facturacionelectronicapy-xmlgen`** — genera el XML V150 desde un JSON y valida según el Manual Técnico. *(latest 1.0.283, actualizado 2026-05-29 — muy activo.)*
- **`facturacionelectronicapy-xmlsign`** — firma el XML con tu certificado `.p12` (DSIG / PKCS#12). Uso: `xmlsign.signXML(xml, '/ruta/Certificado.p12', 'clave')`. *(latest 1.0.28, 2025-08.)*
- **`facturacionelectronicapy-setapi`** — envía el XML firmado a los web services de SIFEN y consulta estados. *(latest 1.0.34, 2025-08.)*
- **Costo:** **gratis (MIT)**; pagás solo tu tiempo de desarrollo + certificado F1. **No hay costo por documento.**
- **Trade-off:** vos mantenés la integración, el manejo de errores de SIFEN, reintentos, eventos y la generación del KuDE PDF (estas libs cubren generar/firmar/enviar; el PDF lo armás vos o con otra lib). Más control, más responsabilidad de mantenimiento ante cambios de la DNIT.
- **Node.js:** ⭐⭐ **nativo**, es la opción técnicamente más "en casa" para este backend.

#### 3) Sifende — *SaaS con API REST*
- **Qué es:** plataforma que abstrae toda la complejidad de SIFEN. *"Vos enviás JSON a nuestra API REST y nosotros generamos el XML según el Manual Técnico V150."*
- **API REST:** sí (sección `/docs`). No vi mención explícita de SDK Node, pero al ser REST/JSON funciona con cualquier cliente HTTP de Node (axios/fetch).
- **Firma/certificado:** subís tu **`.p12`** una vez al panel (se guarda **cifrado**), la plataforma **firma automáticamente** y te avisa antes del vencimiento.
- **Costos (referenciales, IVA incluido):** **Inicial = gratis** (hasta 100 docs/mes, 2 usuarios); **Intermedio = Gs 99.000/RUC/mes** (docs ilimitados); **Profesional = Gs 250.000/RUC/mes**; **Empresarial = Gs 600.000+/RUC/mes**. Sin contratos de largo plazo en planes mensuales.
- **Node.js:** ⭐ bueno (REST puro). El **plan gratis de 100 docs/mes** es atractivo para arrancar/probar.

#### 4) FactPy — *POS + API REST/JSON*
- **Qué es:** sistema POS web **con** facturación electrónica SIFEN integrada **y** una **API REST/JSON** para conectar ERPs o sistemas a medida en cualquier lenguaje.
- **API REST:** sí. Maneja certificado/firma. Sirve tanto si querés POS para mostrador como solo la API para el backend.
- **Costos:** **no publicados** en el sitio → pedir cotización. **(no verificado)**
- **Node.js:** bueno (API agnóstica de lenguaje).

#### 5) BillPy — *SaaS con API REST + webhooks*
- **Qué es:** plataforma DNIT/SIFEN con emisión de **e-KuDE con QR**, web + móvil, y **"API REST para integrar tu ERP, POS o sistema propio"** (gestión de clientes/productos, emisión, consultas, **webhooks**, **auth por token**, sandbox).
- **Firma/certificado:** **no opera el certificado por vos**; te ayuda a **comprarlo a precio preferencial** (necesitás RUC activo + Constancia/Certificado F1). El cert. va **aparte** del abono.
- **Costos:** desde **Gs 79.000/mes** (+ certificado anual aparte).
- **Node.js:** bueno (REST + webhooks + tokens encajan bien con un backend Express).

#### 6) Roshka `rshk-jsifenlib` — *open source, pero **Java***
- **Qué es:** **librería Java 8+ open source (MIT)**, sin dependencias externas, para hablar con los web services de SIFEN (consulta RUC, recepción síncrona de DE, consulta de DE, recepción asíncrona por lote, consulta de estado, recepción de eventos). Disponible en Maven Central. Usada en producción por empresas (incl. financieras y logística).
- **Requiere:** certificado **PFX** + credenciales **CSC** + config dev/prod.
- **Limitación para nosotros:** es **Java, no Node.js**. Solo tendría sentido si se levantara un **microservicio Java aparte** dedicado a facturación — añade un runtime y complejidad operativa que probablemente no compense frente a las opciones Node nativas. Lo incluyo como referencia honesta del mercado, **no recomendado** para este stack.

> **Otros nombres del rubro** que aparecen en el mercado pero con menos foco "API REST para integrar" o que no pude confirmar al detalle: **FactAPI / FactAPIpy** (especializado en **Odoo** ↔ SIFEN, certificación con firma incluida y sin cargo por documento, implementación 2–4 semanas), **Neosystem "Ekuatia"** (API gateway JSON→SIFEN), **Interfaces**, **FEN**, **EDICOM** y **Gosocket** (multinacionales, orientadas a empresas grandes y suelen ser más caras). De los nombres que me pediste verificar: **Tufactura, Bexen y "Facturita"** **no los pude confirmar** como facturadores SIFEN con API en Paraguay en esta búsqueda **(no verificado)**; **Roshka** sí existe pero su aporte es la **librería Java** de arriba, no un SaaS con API REST; **Documenta S.A.** existe pero como **emisor de certificados digitales F1**, no como API de facturación.

---

## 4. Qué implicaría integrarlo a este backend (Node.js)

### Dónde engancha
El disparador natural es **después de un pago aprobado**. En este backend ya está identificado el predicado de aprobación Bancard y la materialización idempotente del pago (ver memoria *Bancard integridad de pagos*: `materializeApprovedPayment`, webhook confirm, reconciliación cada 5 min). La emisión de factura debe colgarse **justo después de marcar el `Payment` como `COMPLETED`/aprobado** y ser **idempotente** (un pago → como máximo una factura). Puntos donde vive esa lógica hoy: rutas/servicios de Bancard (`backend/src/routes/bancard-webhooks.js`, `backend/src/services/bancardService.js`) y los flujos de membresías/citas/recargas que confirman pago.

> Recomendación de diseño: **no** emitir la factura de forma síncrona dentro del webhook de Bancard. Mejor **encolar un job** (ya hay infraestructura de jobs, p. ej. `backend/src/jobs/membershipJobs.js`) que tome los `Payment` aprobados sin factura y emita contra el proveedor, con reintentos. Así un caído de SIFEN o del proveedor no rompe la confirmación del pago.

### Datos que requiere cada factura
- **Emisor (Luxury Garage):** RUC + dígito verificador, razón social, **timbrado/numeración** autorizada (establecimiento + punto de expedición + número correlativo), actividad económica, dirección.
- **Receptor (cliente):** tipo de contribuyente (RUC o C.I. para consumidor final), nombre/razón social, y RUC si lo tiene. **Para consumidor final** se admite con datos mínimos. Hoy el sistema tiene datos de miembros/clientes que habría que mapear (¿guardamos RUC del cliente? probablemente haya que **agregar campo RUC opcional** al perfil).
- **Ítems:** descripción (p. ej. "Lavado ducha + cera", "Sellador cerámico", "Membresía mensual"), cantidad, precio unitario, y el **IVA 10%** (la mayoría de los servicios). Cada ítem indica su afectación de IVA (gravado 10%, 5% o exento). Para un lavadero, lo normal es **10%**.
- **Totales e impuestos:** subtotal, IVA discriminado, total. SIFEN valida la aritmética; los montos deben cuadrar exactamente.
- **Forma de pago:** "tarjeta de crédito/débito" (Bancard) — SIFEN tiene catálogo de medios de pago.
- **Certificado digital F1** vigente (`.p12` + clave) — guardado de forma segura (no en el repo; idealmente en variable de entorno cifrada / secreto, igual que las llaves de Bancard).

### Flujo end-to-end
```
Pago Bancard APROBADO (Payment = COMPLETED)
        │
        ▼
[Job de facturación]  ─── arma JSON con emisor + cliente + ítems + IVA 10%
        │
        ▼
Proveedor API REST  (FacturaSend / Sifende / FactPy / BillPy)
   ├─ genera XML (DE) según Manual Técnico V150
   ├─ firma con certificado F1 (.p12)
   └─ envía a SIFEN
        │
        ▼
SIFEN valida ──► APROBADO  ──► devuelve CDC + estado
        │                         │
        │                         ▼
        │                  Guardar en BD: cdc, estado, url XML/KuDE
        │                         │
        ▼                         ▼
   (si RECHAZADO:           Generar/recibir KuDE (PDF con QR)
    log + reintento /             │
    alerta al admin)              ▼
                          Entregar al cliente (email / descarga /
                          push ya implementado / "Mis comprobantes")
```
- Si elegís un **SaaS** (FacturaSend/Sifende/FactPy/BillPy): mandás **un JSON**, ellos hacen XML+firma+SIFEN+KuDE. Tu backend solo orquesta y guarda el resultado.
- Si elegís las **librerías npm** (xmlgen + xmlsign + setapi): hacés **vos** la cadena generar→firmar→enviar dentro del propio backend; guardás el `.p12` en el server y manejás errores/estados a mano.
- En **ambos casos** conviene una **tabla `Invoice`/`Comprobante`** (db push, según política del proyecto) ligada 1:1 al `Payment`, con `cdc`, `estado`, `xmlUrl`, `kudeUrl`, timestamps, para idempotencia, reintentos y la pantalla del cliente (recordar: la pantalla "Mis Facturas" de Stripe se quitó; esto la reemplazaría con comprobantes Bancard reales).

### Consideraciones fiscales/operativas a no olvidar
- **Anulaciones/devoluciones** → **Nota de Crédito electrónica** (no se "borra" una factura aprobada). Necesario si Bancard hace un reembolso.
- **Modo prueba vs producción:** SIFEN tiene ambiente de **test**; arrancar ahí. (FacturaSend y Sifende no cobran el ambiente de test.)
- **Obligatoriedad:** la facturación electrónica se está volviendo **obligatoria por grupos** (RG DNIT N° 21/2024; grupos hasta diciembre de 2026) y ya es obligatoria desde el 02/01/2026 para **proveedores del Estado** (RG 41/2025). **Hay que confirmar con el contador en qué grupo/fecha cae Luxury Garage**, aunque emitir electrónicamente conviene igual por imagen y operación.

---

## 5. Recomendación y próximos pasos

### Opciones priorizadas

**🥇 Opción 1 — FacturaSend (SaaS API REST).** *Recomendada para salir rápido y bien.*
- Empresa **paraguaya (TIPS S.A.)**, API REST madura con **ejemplos en JavaScript**, maneja firma+SIFEN+KuDE, costos transparentes (desde ~Gs 100k/mes o USD 110/mes self-hosted ilimitado), test gratis. Mismo equipo que las librerías npm → ecosistema Node muy alineado. Bajo riesgo, integración en días.

**🥈 Opción 2 — Sifende (SaaS API REST), con plan gratis para arrancar.**
- API REST JSON, sube `.p12` y firma sola, **plan Inicial gratis hasta 100 docs/mes** ideal para piloto, luego Gs 99k/mes ilimitado. Excelente para **validar el flujo sin costo** y migrar de plan según volumen. Buena alternativa/segunda cotización frente a FacturaSend.

**🥉 Opción 3 — Librerías npm open source (xmlgen + xmlsign + setapi).** *Si se prioriza costo cero por documento y control total.*
- **MIT, gratis, Node nativo**, sin costo por factura. A cambio: más desarrollo y **mantenimiento propio** ante cambios de la DNIT, y hay que manejar el `.p12` en el server. Tiene sentido si el volumen es alto (para no pagar por documento) y hay disposición a mantenerlo. **Viable incluso como evolución**: empezar con FacturaSend/Sifende y migrar a librerías si el costo por volumen lo justifica.

> **Descartado para este stack:** Roshka `jsifenlib` (Java, exigiría microservicio aparte). BillPy/FactPy quedan como **terceras cotizaciones** válidas pero sin ventaja clara sobre las dos primeras para Node.

### Costo total a considerar (no olvidar el certificado)
Cualquier opción SaaS **NO incluye** el **certificado digital F1** (salvo que se negocie). Hay que **sumar el certificado F1 anual** (proveedores: **Code100, eFirma, Documenta, VIT**) — **precio no publicado, confirmar (no verificado)**; FacturaSend tiene convenio con **Code100** "a menor costo". Trámite del certificado: **2–5 días**.

### Próximos pasos para decidir

**Preguntar al contador de Luxury Garage:**
1. ¿En qué **grupo/fecha de obligatoriedad** cae el RUC del lavadero (RG 21/2024)? ¿Ya está habilitado como facturador electrónico en e-Kuatia?
2. ¿Los servicios y membresías van todos a **IVA 10%**? ¿Algún ítem exento o al 5%?
3. ¿Cómo se factura hoy y qué **timbrado/numeración** electrónica hay que solicitar (establecimiento + punto de expedición)?
4. ¿Se necesita pedir **RUC al cliente** o la mayoría son **consumidor final**? (define qué campos agregar al perfil).
5. ¿El contador ya trabaja con algún proveedor (FacturaSend/Sifende/etc.) o tiene preferencia?

**Pedir a 2–3 proveedores (cotización formal):**
1. **Precio mensual + costo por documento** para nuestro volumen estimado (estimar facturas/mes según membresías + servicios).
2. ¿Incluyen o gestionan el **certificado F1**? ¿A qué costo anual?
3. **Sandbox/ambiente de prueba** y documentación de API (confirmar endpoints de **emisión, consulta de estado, KuDE PDF y Nota de Crédito**).
4. **SLA / soporte** y qué pasa si la DNIT cambia el manual técnico (¿lo actualizan ellos?).
5. ¿Tienen **webhooks** para notificar aprobación/rechazo asíncrono?

**Internamente (técnico, sin tocar código todavía):**
1. Estimar **volumen de facturas/mes** para elegir plan.
2. Decidir dónde se guarda el **certificado `.p12`** de forma segura (secreto/env cifrado, nunca en git).
3. Diseñar la **tabla `Invoice`** (1:1 con `Payment`, idempotente) y el **job de emisión** post-aprobación, reusando el patrón de `materializeApprovedPayment` y los jobs existentes.

---

## Fuentes

- DNIT — e-Kuatia (portal oficial): https://www.dnit.gov.py/en/web/e-kuatia
- DNIT — Quiero emitir electrónicamente: https://www.dnit.gov.py/en/web/e-kuatia/quiero-emitir-electronicamente
- DNIT — e-Kuatia'i (pequeños contribuyentes, gratis): https://www.dnit.gov.py/en/web/portal-institucional/w/dnit-implementa-uso-de-ekuatia-i
- DNIT — Certificado Cualificado de Firma Electrónica: https://www.dnit.gov.py/en/web/e-kuatia/firma-digital
- DNIT — Obligatoriedad SIFEN para proveedores del Estado (RG 41/2025): https://www.dnit.gov.py/en/web/portal-institucional/w/dnit-establece-obligatoriedad-de-adhesi%C3%B3n-al-sifen-para-proveedores-del-estado
- AC Raíz (prestadores de servicios de confianza acreditados): https://www.acraiz.gov.py/html/Certif_1PrestaServ.html
- FacturaSend — docs API: https://docs.facturasend.com.py/ · sitio: https://facturasend.com.py/
- FacturaSend — gestionar certificado digital: https://facturasend.com.py/documentacion/gestionar-un-certificado-digital/
- Sifende: https://www.sifende.com.py/
- FactPy: https://factpy.com/
- BillPy: https://billpy.com.py/ · funcionalidades: https://billpy.com.py/funcionalidades.html
- FactAPI (Odoo↔SIFEN): https://factapipy.com/
- Neosystem "Ekuatia": https://www.neosystem.com.py/soluciones/ekuatia
- Roshka — librería open source jsifenlib: https://github.com/roshkadev/rshk-jsifenlib · blog: http://blog.roshka.com/2021/10/libreria-de-codigo-abierto-para.html
- Librerías npm Node.js (TIPS-SA / marcosjara):
  - xmlgen: https://www.npmjs.com/package/facturacionelectronicapy-xmlgen
  - xmlsign: https://github.com/TIPS-SA/facturacionelectronicapy-xmlsign
  - setapi: https://github.com/TIPS-SA/facturacionelectronicapy-setapi
- Code100 (certificados F1): https://code100.com.py/productos
- eFirma (certificación digital): https://www.efirma.com.py/certificacion-digital-i2
- Documenta S.A. (certificado F1): https://efactura.puntoexe.com.uy/documentos/paraguay/requisitos-de-emisi%C3%B3n-de-certificado-cualificado-tributario-f1-en-paraguay/documenta-s-a
- Cronograma obligatoriedad 2026 (RG 21/2024): https://llbsolutions.com/es/paraguay-2026-sifen-y-la-nueva-etapa-operativa-de-la-facturacion-electronica/ · https://guru-soft.com/quienes-empezaran-a-emitir-facturas-electronicas-este-2026-en-paraguay/
- EDICOM — visión general SIFEN: https://edicomgroup.com/blog/the-electronic-invoice-in-paraguay
