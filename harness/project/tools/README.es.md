# Conexiones

Audience: both

> **Resumen:** una ficha por cada servicio externo que usa el proyecto (MCP, CLI o REST): para qué sirve, cómo se probó y quién puede escribir.
> Lee la ficha antes de usar el servicio.

## Cómo añadir una conexión

1. Copia `TEMPLATE.md` a `<nombre>/README.md` dentro de esta carpeta.
2. Rellena todos los campos. Nunca escribas el valor de una clave o token: solo los nombres de las variables.
3. Añade una fila al índice de abajo.

## Índice

| Conexión | Cuenta o destino | Vía (MCP / CLI / REST) | Modo (read-only / read-write) | Última vez OK |
| --- | --- | --- | --- | --- |
| <nombre> | <cuenta o destino> | <vía> | <modo> | <fecha> |

Las conexiones documentadas en otro sitio (por ejemplo una carpeta `tools/` en la raíz del proyecto) se listan aquí por su ruta.

## Para el asistente

Antes de usar un servicio externo, lee su ficha. Ejecuta su `test_connection` solo si la ficha dice que es seguro para un agente.
