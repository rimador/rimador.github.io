const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const uglify = require('gulp-uglify');
const concat = require('gulp-concat');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');

// Tasca 1: CSS
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

// Tasca 2: JS (Sense allowEmpty per detectar errors)
gulp.task('scripts', function () {
    return gulp.src('script.js') // <--- HE TRET { allowEmpty: true }
        .pipe(sourcemaps.init())
        .pipe(gulp.dest('dist/js'))  
        .pipe(uglify().on('error', console.error)) // Això ens dirà si hi ha error de sintaxi
        .pipe(rename({ suffix: '.min' }))  
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist/js'));  
});

// Tasca 3: Build
gulp.task('build', gulp.series('styles', 'scripts'));

// Tasca 4: Watch
gulp.task('watch', function () {
    // Ja no cal fer el build aquí dins, el fa la tasca 'dev' abans
    gulp.watch('css/**/*.css', gulp.series('styles'));
    gulp.watch('script.js', gulp.series('scripts'));
});

// Default
gulp.task('default', gulp.series('build'));

// Dev
gulp.task('dev', gulp.series('build', 'watch'));