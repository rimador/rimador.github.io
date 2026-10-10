cd "$(dirname "$0")" || exit 1

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v npx >/dev/null 2>&1; then
    echo "No es troba el npx. Cal instal·lar el Node.js: https://nodejs.org"
    echo "Prem Intro per tancar."
    read -r
    exit 1
fi

echo "Arrencant 'npx gulp dev' a $(pwd)"
echo

npx gulp dev
codi=$?

echo
echo "El gulp s'ha aturat (codi $codi). Prem Intro per tancar."
read -r