import request from 'request'
import mysql from 'mysql'
import moment from 'moment'
import config from '../config'

const NOOP = () => {}

export default class Squairs {
  constructor(opts={}) {
    this.connection = mysql.createConnection({
      host: opts.host,
      user: opts.user,
      password: opts.password,
      database: opts.database
    })

    this.request = request.defaults({
      baseUrl: `http://${config.squairs.domain}`
    })
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connection.connect(function(e) {
        if (e) return reject(e)
        resolve()
      })
    })
  }

  query(sql) {
    return new Promise((resolve, reject) => {
      this.connection.query(sql, (e, rows) => {
        if (e) return reject(e)
        resolve(rows)
      })
    })
  }

  postScore(info) {
    return new Promise((resolve, reject) => {
      this.request.post({
        url: config.squairs.postScorePath,
        headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: JSON.stringify({
          type: "storeResult",
          template: info.templateID,
          scores: {
            home: info.home,
            visiting: info.visiting
          }
        })
      }, (err, httpResponse, body) => {
        if (err) return reject(err)
        if (httpResponse.statusCode >= 400) return reject(body)

        resolve(body)
      })
    })
  }

  notFinalScoreYet(dateUtc) {
    const now = moment().subtract(5, 'hours')
    const date = moment(dateUtc)
    return date.isAfter(now)
  }
}
