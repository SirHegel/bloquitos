#!/usr/bin/env bash
#
# revisar-secretos.sh — Comprueba que no se cuela nada que no deba estar en un
# repositorio público: credenciales, claves privadas o rutas del equipo local.
#
# Se ejecuta a mano o desde la integración continua:
#     herramientas/revisar-secretos.sh
#
# Devuelve 0 si está limpio y 1 si encuentra algo.
#
# POR QUÉ ES UN SCRIPT Y NO UNA LÍNEA EN EL FLUJO DE CI
#
# Un escáner de secretos contiene, por definición, los patrones que busca. Si se
# escribe dentro del propio flujo de CI, ese archivo se encuentra a sí mismo y la
# comprobación falla siempre. La primera versión intentó resolverlo con la opción
# --exclude de grep, pero esa opción se comporta distinto según la implementación:
# funcionaba con ugrep en local y no con GNU grep en el servidor, así que pasaba
# en un sitio y fallaba en el otro.
#
# Aquí la lista de archivos se construye con `git ls-files` y este propio script
# se descarta por su ruta, en el shell. Eso se comporta igual en cualquier
# máquina, sin depender de qué grep esté instalado.

set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

ESTE_SCRIPT='herramientas/revisar-secretos.sh'

# Patrones de credenciales conocidas y de rutas personales.
PATRONES='sk-ant-[A-Za-z0-9_-]{20,}'
PATRONES+='|sk-[A-Za-z0-9]{32,}'
PATRONES+='|gh[pousr]_[A-Za-z0-9]{30,}'
PATRONES+='|github_pat_[A-Za-z0-9_]{50,}'
PATRONES+='|AKIA[0-9A-Z]{16}'
PATRONES+='|AIza[0-9A-Za-z_-]{30,}'
PATRONES+='|xox[baprs]-[A-Za-z0-9-]{10,}'
PATRONES+='|ya29\.[A-Za-z0-9_-]{20,}'
PATRONES+='|BEGIN (RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY'
PATRONES+='|/home/[a-z][a-z0-9_-]*/'
PATRONES+='|/Users/[a-zA-Z][a-zA-Z0-9_-]*/'

encontrados=0

# Solo archivos de texto que estén realmente en el repositorio.
while IFS= read -r archivo; do
  [ "$archivo" = "$ESTE_SCRIPT" ] && continue
  [ -f "$archivo" ] || continue

  case "$archivo" in
    *.js|*.mjs|*.cjs|*.html|*.css|*.json|*.yml|*.yaml|*.md|*.sh|*.webmanifest|*.svg)
      if salida=$(grep -InE "$PATRONES" "$archivo" 2>/dev/null); then
        echo "$salida" | while IFS= read -r linea; do
          echo "  $archivo:$linea"
        done
        encontrados=1
      fi
      ;;
  esac
done < <(git ls-files)

if [ "$encontrados" -ne 0 ]; then
  echo ""
  echo "✗ Hay algo que no debe estar en un repositorio público."
  echo "  Si es una credencial: revócala, no basta con borrarla del archivo."
  echo "  Si es una ruta local: sustitúyela por una relativa o un marcador."
  exit 1
fi

echo "✓ Limpio: ni credenciales ni rutas locales."
exit 0
