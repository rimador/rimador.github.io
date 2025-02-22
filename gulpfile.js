const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');

// 🔹 Minificar i combinar CSS (des de la carpeta "css/")
gulp.task('styles', function () {
    return gulp.src('css/**/*.css', { allowEmpty: true }) // 📂 Agafa tots els CSS
        .pipe(sourcemaps.init())
        .pipe(concat('styles.css'))  // 🔀 Uneix-los en un sol fitxer
        .pipe(gulp.dest('dist/css'))  // 📤 Desa el fitxer sense minificar
        .pipe(cleanCSS())  // 🔽 Minifica
        .pipe(rename({ suffix: '.min' }))  // 🏷️ Afegim ".min"
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/css'));  // 📤 Desa el fitxer minificat
});

// 🔹 Minificar JavaScript (només "script.js")
gulp.task('scripts', function () {
    return gulp.src('js/**/script.js', { allowEmpty: true }) // 📂 Agafa només script.js
        .pipe(sourcemaps.init())
        .pipe(gulp.dest('dist/js'))  // 📤 Desa el fitxer sense minificar
        .pipe(uglify().on('error', console.error))  // 🔽 Minifica (TEMPORALMENT DESACTIVAT)
        .pipe(rename({ suffix: '.min' }))  // 🏷️ Afegim ".min"
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/js'));  // 📤 Desa el fitxer minificat
});

// 🔄 Tasca per vigilar canvis als arxius i executar automàticament
gulp.task('watch', function () {
    gulp.watch('css/**/*.css', gulp.series('styles'));
    gulp.watch('js/**/script.js', gulp.series('scripts'));
});

// 🚀 Tasca per defecte
gulp.task('default', gulp.series('styles', 'scripts', 'watch'));





//Executar 
//Terminal:
// cd Dropbox/FERRAN/Portàtil/ALTRES/Python/**GitHub/rimador.github.io/
//després
//npx gulp

// control c ho atura