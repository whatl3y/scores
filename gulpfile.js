const gulp = require('gulp')
const babel = require('gulp-babel')
const sourcemaps = require('gulp-sourcemaps')
const plumber = require('gulp-plumber')
// const uglify = require('gulp-uglify')

gulp.task('config', function() {
  return gulp.src("./src/config.js")
    .pipe(babel())
    .pipe(gulp.dest("./"))
})

gulp.task('bin', function() {
  return gulp.src("./src/bin/*.js")
    .pipe(babel())
    .pipe(gulp.dest("./bin"))
})

gulp.task('libs', function () {
  return gulp.src("./src/libs/*.js")
    .pipe(babel())
    // .pipe(uglify().on('error', console.log))
    .pipe(gulp.dest("./libs"))
})

gulp.task('build', ['config', 'bin', 'libs'], function() {})
