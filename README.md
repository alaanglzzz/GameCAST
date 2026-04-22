# 🚀 X-WING PRO — Manual de Juego

> Simulador de combate espacial en Three.js. Pilota un X-Wing rebelde y destruye cazas imperiales.

---

## ▶️ Cómo iniciar

1. Abre `index.html` en un servidor local (por ejemplo con Live Server en VS Code o `python -m http.server`).
2. Haz clic en **"INICIAR MISIÓN"** en la pantalla de inicio.
3. Haz clic en cualquier parte de la pantalla una vez para desbloquear el audio.

> ⚠️ El juego requiere un servidor local. No funciona abriendo el archivo directamente desde el explorador de archivos por restricciones de CORS con los modelos 3D y el HDR.

---

## 🎮 Controles

| Tecla | Acción |
|-------|--------|
| `W` | Acelerar hacia adelante |
| `S` | Frenar / retroceder |
| `A` | Girar a la izquierda |
| `D` | Girar a la derecha |
| `Q` | Subir altitud |
| `E` | Bajar altitud |
| `ESPACIO` | Disparar (mantén para fuego automático) |
| `R` | Reiniciar el juego en cualquier momento |

---

## 🖥️ Interfaz (HUD)

El HUD aparece en la parte inferior de la pantalla y tiene tres bloques:

### Velocímetro (izquierda)
Muestra tu velocidad actual en MGS. Acelera con `W` y reduce con `S`.

### Barras de estado (centro)
- **CASCO** — Tu vida. Si llega a 0, es Game Over. Se regenera muy lentamente.
- **ESCUDO** — Absorbe el daño antes de que baje el casco. Se regenera automáticamente después de 2 segundos sin recibir daño.

> Cuando el casco está por debajo del 25%, la barra parpadea en rojo como advertencia.

### Puntuación (derecha)
- **Score** — Puntos acumulados. Cada enemigo destruido da `100 + (oleada × 10)` puntos.
- **Bajas** — Número total de cazas imperiales destruidos.
- **Oleada** — La oleada actual. Sube cada 10 kills.

---

## ⚔️ Sistema de combate

### Tus balas
Disparas dos rayos láser simultáneos, uno de cada ala. Mantén `ESPACIO` para disparo continuo con cadencia de fuego de 200ms entre ráfagas.

### Enemigos (Caza Imperial)
- Se mueven hacia ti de forma activa.
- Disparan proyectiles cian directamente a tu posición.
- Su cadencia de disparo y velocidad aumentan con cada oleada.
- Al destruirlos se genera una explosión de partículas.

### Asteroides
- Flotan por el mapa y rebotan suavemente.
- Si chocas con uno pierdes **18 de casco** (el escudo absorbe primero).
- Tus balas se destruyen al impactar con ellos.
- Si se alejan demasiado, se reposicionan cerca de ti.

### Daño y cooldown
Hay un cooldown de **0.5 segundos** entre golpes para evitar que pierdas toda la vida de golpe.

| Fuente de daño | Daño |
|----------------|------|
| Bala enemiga | 6 |
| Colisión con enemigo | 12 |
| Colisión con asteroide | 18 |

---

## 🌊 Sistema de oleadas

Cada **10 kills** sube la oleada. Al subir:

- Aparece un banner naranja con el número de oleada.
- Aumenta el número máximo de enemigos en pantalla (`6 + oleada × 2`).
- Los enemigos disparan más rápido y se mueven con más velocidad.

No hay un límite de oleadas — el juego continúa indefinidamente hasta que mueres.

---

## 💀 Game Over

Cuando el casco llega a 0 aparece la pantalla de Game Over con tus estadísticas finales:

- Puntuación total
- Bajas conseguidas
- Oleada alcanzada

Pulsa **REINICIAR** o la tecla `R` para empezar de nuevo.

---

## 📁 Estructura de archivos

```
/
├── index.html              # Estructura HTML y HUD
├── main.css                # Estilos y animaciones del HUD
├── game.js                 # Lógica del juego (Three.js)
├── models/
│   ├── rebels_x-wing_starfighter.glb
│   ├── caza_imperial.glb
│   └── asteroide_low_poly.glb
├── sounds/
│   ├── laser.mp3
│   ├── explosion.mp3
│   └── music.mp3
├── hdr/
│   └── rogland_clear_night_4k.hdr
├── build/
│   └── three.module.js
└── jsm/                    # Three.js addons (loaders, etc.)
```

---

## 💡 Consejos

- El **escudo** se regenera solo, pero el **casco** casi no. No dejes que el casco baje demasiado.
- Mantén distancia de los asteroides — el daño que hacen es el mayor del juego.
- Los enemigos apuntan a donde estás *en este momento*, no donde estarás. Moverse lateralmente ayuda a esquivar.
- El fuego automático (mantener espacio) es más eficiente que clics individuales.
- La puntuación por kill aumenta con la oleada, así que aguantar más tiempo vale la pena.
