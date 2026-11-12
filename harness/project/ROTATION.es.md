# ROTATION

Audience: both

> **Resumen:** qué hacer cuando se filtra un secreto o se va una persona: qué secretos hay, dónde vive cada uno y los pasos exactos para cambiarlo.
> Nunca se escribe aquí un secreto, solo su nombre y dónde se guarda.
> Última revisión: AAAA-MM-DD

## Secretos

| Nombre | Lo usa | Guardado en | Lo rota |
| --- | --- | --- | --- |
| nombre del secreto, nunca su valor | servicio o fichero que lo lee | gestor, ajuste de CI o fichero de entorno fuera de git | persona |

## Pasos si se filtra uno

1. Revocar o rotar el secreto primero en su proveedor.
2. Guardar el valor nuevo donde diga la tabla, nunca en un fichero versionado.
3. Quitar el valor filtrado del historial del repositorio si llegó a subirse, con el OK de la persona responsable.
4. Volver a desplegar lo que dependa de él y comprobar que funciona.
5. Anotar lo ocurrido en `decisions/` o en `STATUS`.

## A quién se avisa

- Nombrar a la persona o canal y cuándo.
