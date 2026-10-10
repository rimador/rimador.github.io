cd "$(dirname "$0")" || exit 1

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v npx >/dev/null 2>&1; then
    echo "No es troba el npx. Cal instal·lar el Node.js: https://nodejs.org"
    echo "Prem Intro per tancar."
    read -r
    exit 1
fi

# Comprova si existeix la carpeta node_modules; si no, instal·la les dependències
if [ ! -d "node_modules" ]; then
    echo "No s'han trobat els mòduls locals. S'estan instal·lant amb 'npm install'..."
    npm install
    
    # Si la instal·lació falla, atura l'script
    if [ $? -ne 0 ]; then
        echo "S'ha produït un error en instal·lar els mòduls. Prem Intro per tancar."
        read -r
        exit 1
    fi
    echo "Mòduls instal·lats correctament."
    echo
fi

echo "Arrencant 'npx gulp dev' a $(pwd)"
echo

npx gulp dev
codi=$?

echo
echo "El gulp s'ha aturat (codi $codi). Prem Intro per tancar."
read -r