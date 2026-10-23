#!/bin/sh
# Servidor local para las pruebas en navegador (puerto 8765), desde la raíz del repositorio.
cd "$(dirname "$0")/../.." && exec python3 -m http.server 8765
