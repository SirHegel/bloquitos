/**
 * principal.js — Proceso principal de la aplicación de escritorio (Electron).
 *
 * El juego en sí no cambia: es exactamente el mismo index.html que se abre en el
 * navegador. Esto solo lo envuelve en una ventana propia para poder distribuirlo
 * como .exe, .AppImage o .dmg.
 *
 * SEGURIDAD
 *
 * Electron da acceso a Node desde la página, y eso convertiría cualquier fallo
 * de la web en ejecución de código en el equipo. Aquí se cierra esa puerta del
 * todo, porque el juego no necesita Node para nada:
 *
 *   - nodeIntegration: false   → la página no ve `require` ni `process`
 *   - contextIsolation: true   → el código de la página vive aislado del de Electron
 *   - sandbox: true            → el proceso de render corre en un sandbox del sistema
 *   - webSecurity: true        → se respeta el origen y la política de contenido
 *   - sin precarga              → no se expone ni un solo puente al sistema
 *
 * Además se bloquea toda navegación fuera del propio juego y la apertura de
 * ventanas nuevas: si algún día se colara un enlace externo, no podría llevar a
 * la aplicación a cargar contenido ajeno.
 */

'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const INDICE = path.join(RAIZ, 'index.html');

/** Solo se permite navegar dentro de la carpeta del juego. */
function esDelJuego(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:') return false;
    const ruta = path.normalize(decodeURIComponent(u.pathname));
    return ruta.startsWith(path.normalize(RAIZ));
  } catch {
    return false;
  }
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0d1030',
    title: 'Bloquitos',
    icon: path.join(RAIZ, 'iconos', 'icono-512.png'),
    show: false,                  // se muestra cuando ya está pintada, sin parpadeo
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      spellcheck: false,
    },
  });

  ventana.loadFile(INDICE);

  ventana.once('ready-to-show', () => ventana.show());

  // Cualquier intento de abrir una ventana nueva se deniega. Si la URL es
  // externa y con esquema seguro, se abre en el navegador del sistema, que es
  // donde debe abrirse, nunca dentro de la aplicación.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Navegación bloqueada fuera del juego.
  ventana.webContents.on('will-navigate', (evento, url) => {
    if (!esDelJuego(url)) evento.preventDefault();
  });

  // Si el proceso de render se cae, se recarga en vez de dejar una ventana muerta.
  ventana.webContents.on('render-process-gone', () => {
    if (!ventana.isDestroyed()) ventana.reload();
  });

  // El juego no pide cámara, micrófono, ubicación ni notificaciones.
  // Se deniega todo por defecto.
  ventana.webContents.session.setPermissionRequestHandler((_wc, _permiso, permitir) => permitir(false));

  return ventana;
}

// Una sola instancia: si se abre otra vez, se enfoca la ventana existente.
const bloqueo = app.requestSingleInstanceLock();
if (!bloqueo) {
  app.quit();
} else {
  let principal = null;

  app.on('second-instance', () => {
    if (principal) {
      if (principal.isMinimized()) principal.restore();
      principal.focus();
    }
  });

  app.whenReady().then(() => {
    // Menú mínimo: solo pantalla completa y salir. Sin herramientas de
    // desarrollo ni recarga, que en una aplicación para niños solo estorban.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'Bloquitos',
        submenu: [
          { role: 'togglefullscreen', label: 'Pantalla completa' },
          { type: 'separator' },
          { role: 'quit', label: 'Salir' },
        ],
      },
    ]));

    principal = crearVentana();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) principal = crearVentana();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Refuerzo global: se prohíbe adjuntar cualquier vista incrustada y se
  // vuelven a fijar las opciones seguras aunque algo intentara cambiarlas.
  app.on('web-contents-created', (_e, contenido) => {
    contenido.on('will-attach-webview', (evento, preferencias) => {
      delete preferencias.preload;
      preferencias.nodeIntegration = false;
      preferencias.contextIsolation = true;
      evento.preventDefault();
    });
  });
}
