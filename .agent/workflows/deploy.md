---
description: Cómo subir cambios a GitHub para que Vercel los reconozca
---

Para que tus cambios se reflejen en Vercel, debes seguir estos 3 pasos en tu terminal (PowerShell):

### 1. Preparar archivos
Este comando agrega todos los archivos que modificaste a la lista para subir.
```powershell
git add .
```

### 2. Confirmar cambios
Este comando guarda tus cambios con una nota descriptiva.
```powershell
git commit -m "Descripción de lo que cambiaste"
```

### 3. Subir a GitHub
Este comando envía tus cambios a GitHub. Vercel detectará esto automáticamente y comenzará a actualizar tu sitio.
```powershell
git push
```

> [!TIP]
> Puedes ver el progreso de la actualización entrando a tu panel de control en [vercel.com](https://vercel.com/dashboard).
