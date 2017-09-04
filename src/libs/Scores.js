import fs from 'fs'
import request from 'request'
import util from 'util'
import config from '../config'

const readFile = util.promisify(fs.readFile)

const NOOP = () => {}

export default class Scores {
  constructor(sport=null) {
    //sports include: nfl,nba,ncf,ncb,mlb,nhl

    this.sport = sport || "nfl"
    this.endpoint = "www.espn.com"
    this.path = this.setPath(this.sport)

    this.request = request.defaults({
      baseUrl: `http://${this.endpoint}`
    })
  }

  async getAllFinalGames(events=[]) {
    this.remainingEvents = this.remainingEvents || ["nfl", "nba", "ncf", "ncb", "nhl", "mlb"]
    this.sport = this.remainingEvents.shift()
    this.setPath(this.sport)

    const data = await this.get()

    try {
      const ret = await this.parseFinalGames(data)
      events.push({ [this.sport]: ret })

    } catch(err) {
      console.trace(`Error parsing final games for sport '${this.sport}':`, err)
    }

    if (this.remainingEvents.length > 0) {
      return await this.getAllFinalGames(events)
    } else {
      return events
    }
  }

  setPath(sport, raw=false) {
    return this.path = (raw) ? sport : `/${sport}/bottomline/scores`
  }

  parseFinalGames(response) {
    const oResponse = this.unserialize(response)
    let ret = []
    for (let _key in oResponse) {
      if (_key.search(/^\w{1,8}_s_left\d{1,3}$/) > -1) {
        if (this.isFinal(oResponse[_key].toLowerCase())) {
          const formatted = oResponse[_key].replace(/([^\w\d\s\(\)'-\.]*)([\w\d\s\(\)'\-&\.]+\s\d{1,3})(\W*)(\s|\^)([\w\d\s\(\)'\-&\.]+\s\d{1,3})(.*)(\(.+\))(.*)/, "$2|$5")
          const teams = formatted.split("|")

          let o = {}
          for (let  _i = 0; _i < teams.length; _i++) {
            const team = teams[_i].replace(/^([\(\d\)\s]*)(.+)(\s)(\d{1,3})$/, "$2")
            const score = teams[_i].replace(/^([\(\d\)\s]*)(.+)(\s)(\d{1,3})$/, "$4")

            o[team] = Number(score)
          }

          ret.push(o)
        }
      }
    }
    return ret
  }

  checkTeams(aliases, gameInfo) {
    const visitingAliases = aliases.visiting.split("|")
    const homeAliases = aliases.home.split("|")
    const team1 = Object.keys(gameInfo)[0]
    const team2 = Object.keys(gameInfo)[1]
    const team1score = gameInfo[team1]
    const team2score = gameInfo[team2]

    const checkTeam = (aliases, team) => {
      for (let _i = 0; _i < aliases.length; _i++) {
        if (aliases[_i].toLowerCase() == team.toLowerCase())
          return team
      }
      return false
    }

    const v1 = checkTeam(visitingAliases, team1)
    const v2 = checkTeam(visitingAliases, team2)
    const h1 = checkTeam(homeAliases, team1)
    const h2 = checkTeam(homeAliases, team2)

    if (v1 && h2) {
      return { home: team2score, visiting: team1score }
    } else if (v2 && h1) {
      return { home: team1score, visiting: team2score }
    }

    return false
  }

  isFinal(text) {
    const endOfGameText = ["(final)", "(end of 4th)", "(00:00 in 4th)", "(final - ot)", "(final - 2nd ot)", "(final - 3rd ot)"]

    for (let _i = 0; _i < endOfGameText.length; _i++) {
      if (text.search(endOfGameText[_i].toLowerCase()) > -1)
        return true
    }
    return false
  }

  unserialize(string='') {
    string = (/^\?/.test(string)) ? string.substring(1) : string    //if first char is a question mark, remove it from the string

    const a = string.split("&")
    let obj = {}
    for (let _i = 0; _i < a.length; _i++) {
      const _a = a[_i].split("=")
      try {
        obj[ decodeURIComponent(_a[0] || "") ] = decodeURIComponent(_a[1] || "")
      } catch(e) {
        console.log(`Error parsing URI; _a[0]: ${_a[0]}; _a[1]: ${_a[1]}; error: ${e}`)
      }
    }
    return obj
  }

  get() {
    return new Promise(async (resolve, reject) => {
      try {
        const filePath = config.scores.path(this.sport)
        const fileData = await this.readLocalGamesFile(filePath)
        if (fileData) {
          fs.unlink(filePath)
          return resolve(fileData)
        }

        this.request(this.path, (err, httpResponse, body) => {
          if (err) return reject(err)
          if (httpResponse.statusCode >= 400) return reject(body)
          resolve(body)
        })

      } catch(err) {
        reject(err)
      }
    })
  }

  async readLocalGamesFile(filePath) {
    try {
      const data = await readFile(filePath, {encoding: "utf8"})
      return data
    } catch(e) {}
  }
}
