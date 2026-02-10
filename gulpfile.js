const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');

// Tasca 1: Minificar i combinar CSS
gulp.task('styles', function () {
    return gulp.src('css/**/*.css', { allowEmpty: true }) 
        .pipe(sourcemaps.init())
        .pipe(concat('styles.css')) 
        .pipe(gulp.dest('dist/css'))
        .pipe(cleanCSS())  
        .pipe(rename({ suffix: '.min' })) 
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/css'));
});

// Tasca 2: Minificar JS
gulp.task('scripts', function () {
    return gulp.src('script.js', { allowEmpty: true }) 
        .pipe(sourcemaps.init())
        .pipe(gulp.dest('dist/js'))  
        .pipe(uglify().on('error', console.error))  
        .pipe(rename({ suffix: '.min' }))  
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/js'));  
});

// Tasca 3: Construir una sola vegada (Per a GitHub Actions)
gulp.task('build', gulp.series('styles', 'scripts'));

// Tasca 4: Vigilar canvis (Per a TU en local)
gulp.task('watch', function () {
    // Primer construïm per assegurar que els fitxers existeixen
    gulp.series('styles', 'scripts')(); 
    
    // Després vigilem
    gulp.watch('css/**/*.css', gulp.series('styles'));
    gulp.watch('script.js', gulp.series('scripts'));
});

// Per defecte (si escrius 'gulp' o per a GitHub): Només construeix
gulp.task('default', gulp.series('build'));

// Tasca 'dev': Construeix i es posa a vigilar
gulp.task('dev', gulp.series('build', 'watch'));