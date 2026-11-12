# <Nombre de la conexión>

Audience: both

> **Resumen:** una frase: qué servicio es y para qué lo usa el proyecto.

- **Para qué sirve:** <qué hace el proyecto con este servicio>
- **Vía:** <MCP, CLI o REST> - <por qué esta vía y no otra>
- **Cuenta o destino:** <qué cuenta, proyecto o workspace>
- **Cómo se probó:** <fecha y qué se comprobó>
- **Quién puede escribir:** <nadie (read-only) / quién y con qué condición>
- **Límites:** <límites de uso, costes, datos que nunca debe tocar>
- **.env.example:** <solo los nombres de las variables, nunca sus valores>
- **Seguro para que lo ejecute un agente (`test_connection`):** <sí / no>

## Contrato de `test_connection`

El proyecto puede poner un script `test_connection` junto a esta ficha. Debe:

- comprobar solo la identidad (quién soy en este servicio), sin cambiar nada;
- ser de solo lectura;
- salir con 0 e imprimir `OK <name> → <identity>`;
- salir con código distinto de 0 e imprimir el motivo si falla;
- no imprimir nunca un secreto.
