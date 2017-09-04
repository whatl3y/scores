import path from 'path'

export default {
  mysql: {
    creds: {
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PW,
      database: process.env.MYSQL_DB
    }
  },
  squairs: {
    domain: "squairs.com",
    postScorePath: process.env.SQUAIRS_POST_SCORE_PATH,
    unscoredEventsSql: `CALL ${process.env.SQUAIRS_UNSCORED_PROCEDURE}()`

  },
  scores: {
    path: sport => path.join('..', 'files', `${sport}.txt`)
  }
}
