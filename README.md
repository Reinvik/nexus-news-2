# Nexus News 🌐

**Nexus News** es un agregador de noticias inteligente diseñado para combatir las burbujas de información. Inspirado en plataformas como *Ground News*, su objetivo es empoderar al usuario permitiéndole comparar cómo diferentes medios (Izquierda, Centro, Derecha) cubren una misma noticia en tiempo real.

![Nexus News Preview](/demo-screenshot.png)

## 🚀 Misión

En la era de la desinformación, **Nexus News** busca ofrecer una visión multipolar de la actualidad. No se trata solo de leer noticias, sino de entender la narrativa detrás de ellas.

## ✨ Características Principales

*   **📊 Análisis de Sesgo 2.0**: Clasificación automática de fuentes en una escala de 5 puntos (**Extrema Izquierda, Centro Izquierda, Centro, Centro Derecha, Extrema Derecha**) para una visualización precisa del espectro mediático.
*   **🤖 Análisis AI con Gemini**: Integración con **Google Gemini 2.0 Flash** para analizar clusters de noticias en tiempo real, detectando:
    *   **Contradicciones** factuales entre medios.
    *   **Sesgos evidentes** y lenguaje emotivo.
    *   Resúmenes de las distintas narrativas en juego.
*   **👁️ Detección de Blindspots**: Identifica automáticamente historias que están siendo ignoradas por un lado del espectro político (ej. "Blindspot Izquierda" si solo la derecha cubre el tema).
*   **📱 Experiencia PWA**: Aplicación web progresiva instalable en móviles:
    *   Icono nativo "Nexus".
    *   Experiencia pantalla completa (sin barras de navegador).
    *   Optimizado para tactil.
*   **🌎 Cobertura Global y Local**:
    *   **Nacional (Chile)**: Balanceo forzado con fuentes locales (.cl).
    *   **Internacional (LatAm/España/Anglo)**: Selección curada de medios globales.
*   **🧠 Clustering Inteligente**: Agrupa artículos utilizando algoritmos de similitud semántica y superposición de entidades nombradas.

## 🛠️ Stack Tecnológico

Este proyecto fue construido con tecnologías modernas enfocadas en rendimiento y experiencia de usuario:

*   **Frontend**: [Next.js 15](https://nextjs.org/) (App Router), React 19.
*   **IA**: [Google Generative AI SDK](https://ai.google.dev/) (Gemini 2.0 Flash).
*   **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) (Diseño responsivo, Glassmorphism, Dark Mode).
*   **Iconos**: Lucide React.
*   **Datos**: Integración con NewsAPI, Currents, GNews y WorldNewsAPI.

## 👨‍💻 Autor

Desarrollado por **Ariel Mella**.

---
*Este proyecto es parte de mi portafolio profesional. Si te interesa saber más sobre cómo funciona el algoritmo de balanceo o la arquitectura, ¡conectemos en LinkedIn!*
