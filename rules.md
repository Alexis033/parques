# **Manual de Reglas Oficiales y Variaciones del Parqués Colombiano**

## **1\. Componentes del Juego y Configuración Inicial**

### **1.1 El Tablero**

* **Estructura del circuito:** Es un circuito cerrado con casillas especiales distribuidas simétricamente de forma bidimensional en el sentido de las manecillas del reloj.  
* **Capacidad:** Típicamente diseñado para 4 o 6 jugadores.  
* **Tipos de casillas:**  
  * **Casillas Comunes:** Casillas estándar de tránsito donde se puede capturar y ser capturado.  
  * **Cárcel (Home):** Área de almacenamiento inicial fuera del circuito principal para las fichas de cada jugador.  
  * **Salida (Exit):** Casilla especial donde se sitúan las fichas al ser liberadas de la cárcel. Funciona también como un "Seguro" para el dueño de esa salida.  
  * **Seguro (Safe Zone):** Casillas específicas distribuidas a lo largo del tablero que otorgan inmunidad de captura.  
  * **Cielo / Pasillo de Meta (Finish Lane):** Un camino exclusivo de casillas para cada color que conduce a la meta final.  
  * **Meta / Coronación (Goal):** La casilla final donde la ficha sale del juego con éxito.

### **1.2 Las Fichas**

* Cada jugador posee estrictamente **4 fichas** del mismo color.  
* Estado de las fichas: \[CÁRCEL, EN\_TRANSITO, EN\_CIELO, CORONADA\].

### **1.3 Los Dados**

* Se juega obligatoriamente con **dos (2) dados tradicionales de 6 caras** (valores del 1 al 6 cada uno).

## **2\. Flujo de Juego y Turnos**

### **2.1 El Inicio y Mecánica de la Cárcel (Salir de Cárcel)**

* **Estado inicial:** Todos los jugadores inician la partida con sus 4 fichas en estado CÁRCEL.  
* **Mecánica de Lanzamiento:** \* Mientras un jugador tenga **todas** sus fichas en la cárcel, tiene derecho a realizar hasta **tres (3) lanzamientos** de dados en su turno para intentar obtener un par.  
  * Si el jugador ya tiene al menos una ficha activa en el tablero, solo tiene derecho a **un (1) lanzamiento** por turno.  
* **Condición de Salida (Par):** Se requiere obtener un "par" (ambos dados con el mismo valor numérico, ej: 1-1, 2-2, etc.) para liberar fichas.  
* **Efecto del Par en la Salida:** Al obtener un par, se mueven las fichas obligatoriamente a la casilla de Salida. La cantidad de fichas liberadas se define por acuerdo previo antes de la partida:  
  * *Opción A (Estándar):* Se liberan todas las fichas posibles en la cárcel con cualquier par.  
  * *Opción B (Restringido):* Se liberan solo dos (2) fichas por par.  
  * *Opción C (Condicionado):* Se liberan todas solo si es par de 1 (Ases) o par de 6; con otros pares se liberan menos o ninguna.

### **2.2 Movimiento de Fichas**

* **Dirección:** Sentido de las manecillas del reloj.  
* **Asignación de Puntos:** Los valores de los dados se pueden aplicar de dos maneras:  
  1. **Movimiento Combinado:** Sumar el valor de ambos dados (Dado A \+ Dado B) y mover una sola ficha esa cantidad total de casillas.  
  2. **Movimiento Dividido:** Mover una ficha la cantidad del Dado A y otra ficha diferente la cantidad del Dado B.  
* **Regla de Bloqueo por Ruta:** No se puede saltar ni ocupar una casilla que cause colisión fuera de las reglas de captura estándar.

### **2.3 Lanzamientos Extra (Pares)**

* **Regla del Par:** Cada vez que un jugador lanza un par, obtiene inmediatamente el derecho a **un lanzamiento extra** (turno extra) tras haber completado los movimientos del lanzamiento actual.  
* **Consecuencia de Tres Pares Consecutivos (Parqués):** Si un jugador saca tres pares de forma consecutiva en el mismo turno:  
  * **Efecto:** La ficha de ese jugador que se encuentre más adelantada en el tablero (excluyendo las que ya están en el "Cielo" o "Metas") es **coronada automáticamente** (liberada del tablero directo a la meta). Y se termina su turno.

## **3\. Combate, Captura y Zonas de Seguridad**

### **3.1 Mecánica de Captura ("Comer Ficha")**

* **Definición:** Ocurre cuando una ficha finaliza su movimiento en una casilla común que ya está ocupada por una ficha de un oponente.  
* **Efecto:** La ficha del oponente es capturada y enviada inmediatamente a la Cárcel, perdiendo todo su progreso en el tablero.

### **3.2 Zonas de Inmunidad**

* **Casillas de Seguro y Salida:** \* Si una ficha se encuentra posicionada sobre un Seguro o sobre su propia casilla de Salida, adquiere el estado de INMUNE.  
  * **Regla de Coexistencia Pacífica:** Varias fichas de diferentes jugadores pueden ocupar simultáneamente la misma casilla de Seguro o Salida sin que ocurra ninguna captura.

## **4\. Fase Final y Coronación**

### **4.1 Entrada al "Cielo"**

* Al completar la vuelta completa al tablero, las fichas giran hacia el pasillo de meta exclusivo (Cielo).  
* En el Cielo, las fichas ya no pueden ser capturadas por rivales.

### **4.2 Coronación (Entrada a la Meta)**

* Para retirar la ficha del juego en la casilla de Meta (coronación), el jugador debe obtener en los dados el **número exacto** de casillas que le faltan para llegar.  
* **Regla de Rebote:** Si el resultado de los dados excede la distancia requerida para coronar, el movimiento se considerará inválido y la ficha no podrá moverse con ese dado.

### **4.3 Mecánica de la Última Ficha**

* Cuando a un jugador le queda **únicamente una (1) ficha** activa en todo el juego (las otras tres ya fueron coronadas exitosamente), se activa una regla de restricción:  
  * El jugador debe lanzar obligatoriamente utilizando **un solo dado** en lugar de dos para realizar sus movimientos restantes hasta coronar.

## **5\. Variaciones Locales Comunes ("Reglas de Casa")**

Estas variaciones alteran la lógica algorítmica y deben programarse como parámetros booleanos configurables (true / false):

### **5.1 Soplar Ficha (SOPLAR\_CORRESPONDIENTE: boolean)**

* **Lógica:** Si un jugador tiene un movimiento legal disponible que le permite capturar ("comer") la ficha de un oponente, pero decide no hacerlo (ya sea por omisión, distracción o estrategia de juego):  
  * **Consecuencia:** Cualquiera de los oponentes puede denunciar la acción de inmediato (durante el transcurso del turno) "soplando" la ficha del jugador infractor. Esto envía la ficha con la que se debía hacer la captura directamente de vuelta a la Cárcel.

### **5.2 Patear el Seguro en Salida (PATEAR\_SEGURO\_SALIDA: boolean)**

* **Lógica:** Rompe la inmunidad de la casilla de Salida bajo condiciones específicas de liberación.  
* **Mecánica:** Si un jugador obtiene un par para salir de la cárcel, y su casilla de Salida se encuentra ocupada por una o más fichas enemigas:  
  * **Consecuencia:** La ficha que sale de la cárcel "patea" o destruye a las fichas enemigas que estaban allí, enviándolas directamente a la Cárcel, ignorando por completo la inmunidad estándar del seguro.