// Fa passar les proves de Python (test_*.py) dins de la mateixa ordre que les de
// node, perquè es pugui córrer tot d'una vegada:
//
//     node --test "joc/eines/proves/*.test.mjs"
//
// Les proves de Python fan servir dades de joguina i no llegeixen el diccionari.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ARREL = fileURLToPath(new URL('../../../', import.meta.url));

test('les proves de Python (variants_era.py i congelar_era.py)', (t) => {
    const prova = spawnSync('python3', ['--version'], { encoding: 'utf8' });
    if (prova.error) {
        t.skip('no hi ha python3');
        return;
    }

    const resultat = spawnSync(
        'python3',
        ['-m', 'unittest', 'discover', '-s', 'joc/eines/proves', '-p', 'test_*.py'],
        { cwd: ARREL, encoding: 'utf8' });
    assert.equal(resultat.status, 0, `${resultat.stdout}\n${resultat.stderr}`);
});
