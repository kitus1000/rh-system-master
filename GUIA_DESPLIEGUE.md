# Guía de Despliegue: El Expediente 🚀

Esta guía explica cómo instalar una copia independiente de **El Expediente** para un nuevo cliente.

## 1. Preparar la Base de Datos (Supabase)
Cada cliente debe tener su propio proyecto en Supabase para garantizar la seguridad de los datos.

1.  Crea un nuevo proyecto en [Supabase.com](https://supabase.com).
2.  Ve a la sección **SQL Editor**.
3.  Copia y pega el contenido del archivo `SCRIPTS_NUEVA_EMPRESA.sql` y ejecútalo.
4.  Ve a **Project Settings -> API** y guarda estos dos valores:
    -   `Project URL`
    -   `anon key`

## 2. Preparar el Hosting (Vercel)
Vercel servirá la aplicación web de forma gratuita o económica.

1.  Sube el código a un repositorio privado en **GitHub**.
2.  En [Vercel.com](https://vercel.com), dale a **Add New -> Project**.
3.  Importa el repositorio de **El Expediente**.
4.  **IMPORTANTE:** En la sección "Environment Variables", agrega estas dos:
    -   `NEXT_PUBLIC_SUPABASE_URL`: (El Project URL de Supabase)
    -   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (El anon key de Supabase)
5.  Dale a **Deploy**.

## 3. Configuración Inicial
Una vez que el sitio esté en línea (ej. `empresa-abc.vercel.app`):

1.  Entra a la página.
2.  Inicia sesión (usa las credenciales temporales o las que hayas configurado).
3.  Ve al menú **Configuración** y sube el Logo y los datos fiscales del cliente.
4.  ¡Listo! El sistema ya es funcional para esa empresa.

---

### Mantenimiento y Costos
-   **Dominio:** Si el cliente quiere `rrhh.empresa.com`, cómpralo en GoDaddy y conéctalo en la pestaña "Domains" de Vercel.
-   **Copias:** Repite este proceso por cada negocio que te compre el software. Nunca mezcles bases de datos de diferentes clientes.
