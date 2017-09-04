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

gulp.task('bin-dev', function() {
  return gulp.src("./src/bin/*.js")
    .pipe(babel())
    .pipe(gulp.dest("./bin"))
})

gulp.task('bin-prod', function() {
  return gulp.src("./src/bin/*.js")
    .pipe(sourcemaps.init())
    .pipe(plumber())
    .pipe(babel())
    // .pipe(uglify().on('error', console.log))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest("./bin"))
})

gulp.task('libs-dev', function () {
  return gulp.src("./src/libs/*.js")
    .pipe(babel())
    // .pipe(uglify().on('error', console.log))
    .pipe(gulp.dest("./libs"))
})

gulp.task('libs-prod', function () {
  return gulp.src("./src/libs/*.js")
    .pipe(sourcemaps.init())
    .pipe(plumber())
    .pipe(babel())
    // .pipe(uglify().on('error', console.log))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest("./libs"))
})

gulp.task('prep-dev', ['config', 'bin-dev', 'libs-dev'], function() {})
gulp.task('prep-prod', ['config', 'bin-prod', 'libs-prod'], function() {})
