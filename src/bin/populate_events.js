var argv = require('minimist')(process.argv.slice(2));
const moment = require('moment-timezone')
const async = require('async')
const request = require('request')
const mysql = require('mysql')

const endpoint = argv.e || `http://www.scoresandodds.com/feeds/day/${moment().format('YYYYMMDD')}`

const connection = mysql.createConnection({
  host: argv.h || process.env.MYSQL_HOST,
  user: argv.u || process.env.MYSQL_USER,
  password: argv.p || process.env.MYSQL_PW,
  database: argv.d || process.env.MYSQL_DB
})

async.parallel([
  function(callback) {
    connection.connect(callback)
  },
  function(callback) {
    request.get({url: endpoint}, function(err,httpResponse,body) {
      return callback(err,[httpResponse,body])
    })
  }
],
  function(err, results) {
    if (err) return console.log('request error', err)
    const httpResponse = results[1][0]
    const body = results[1][1]

    if (httpResponse.statusCode !== 200) return console.log('bad status code',httpResponse.statusCode,httpResponse)
    const oBody = JSON.parse(body)
    const day = oBody.DAY

    // review the individual league
    async.each(day.LEAGUE, function(l, callback) {
      const aryLeagueSport = sportTypeLeagueMap(l.NAME)
      const sportType = aryLeagueSport[0]
      const league = aryLeagueSport[1]

      l.GAME = (l.GAME instanceof Array) ? l.GAME : [l.GAME]
      async.each(l.GAME, function(g, _callback) {
        const gamenumber = g.PRIMARYID
        if (!gamenumber) return _callback()
        console.log('gamenumber', gamenumber)

        const dateUtc = moment.tz(g.DATE, "America/New_York").utc().format()
        const description = g.NOTES

        // create/update individual events records
        async.waterfall([
          function(__callback) {
            checkExists(`select * from events where gamenumber = ?`, [gamenumber], __callback)
          },
          function(alreadyExists, __callback) {
            if (alreadyExists) {
              return connection.query(`
                update events set
                  gamenumber = ?,
                  sporttype = ?,
                  league = ?,
                  event_datetimeGMT = ?,
                  description = ?
                where gamenumber = ?
              `, [gamenumber, sportType, league, dateUtc, description, gamenumber], __callback)
            }

            connection.query(`
              insert into events (gamenumber, sporttype, league, event_datetimeGMT, description)
              values (?, ?, ?, ?, ?)
            `, [gamenumber, sportType, league, dateUtc, description], __callback)
          }
        ],
          function(e, result) {
            if (e) return _callback(e)

            // create/update participants
            const away_team = g.AWAY.INFO
            const home_team = g.HOME.INFO
            const partAndLineInfo = parseParticipantsAndPeriods(gamenumber, away_team, home_team)

            async.waterfall([
              function(__callback) {
                async.parallel([
                  function(___callback) {
                    checkExists(`select * from events_participants where gamenumber = ? and participant_name = ?`, [
                      gamenumber,
                      partAndLineInfo.participants.away.participant_name
                    ], ___callback)
                  },
                  function(___callback) {
                    checkExists(`select * from events_participants where gamenumber = ? and participant_name = ?`, [
                      gamenumber,
                      partAndLineInfo.participants.home.participant_name
                    ], ___callback)
                  }
                ],__callback)
              },
              function(aryAlreadyExists, __callback) {
                aryAlreadyExists = [['away',aryAlreadyExists[0]], ['home',aryAlreadyExists[1]]]
                async.each(aryAlreadyExists, function(alreadyExistsInfo, ___callback) {
                  const awayOrHome = alreadyExistsInfo[0]
                  const alreadyExists = alreadyExistsInfo[1]
                  const part = partAndLineInfo.participants[awayOrHome]
                  if (alreadyExists) {
                    return connection.query(`
                      update events_participants set
                        gamenumber = ?,
                        participant_name = ?,
                        contestantnum = ?,
                        visiting_home_draw = ?,
                        odds = ?,
                        total_points = ?,
                        units = ?
                      where gamenumber = ? and participant_name = ?`, [
                        part.gamenumber,
                        part.participant_name,
                        part.contestantnum,
                        part.visiting_home_draw,
                        part.odds,
                        part.total_points,
                        part.units,
                        part.gamenumber,
                        part.participant_name
                      ], ___callback)
                  }

                  connection.query(`
                    insert into events_participants (gamenumber, participant_name, contestantnum, visiting_home_draw, odds, total_points, units)
                    values (?, ?, ?, ?, ?, ?, ?)
                  `, [
                    part.gamenumber,
                    part.participant_name,
                    part.contestantnum,
                    part.visiting_home_draw,
                    part.odds,
                    part.total_points,
                    part.units
                  ], ___callback)
                }, __callback)
              }
            ],
              function(err, result) {
                if (e) return _callback(e)

                // update periods
                const period = partAndLineInfo.periods.game
                async.waterfall([
                  function(__callback) {
                    checkExists(`select * from events_periods where gamenumber = ? and period_number = ?`, [gamenumber, 0], __callback)
                  },
                  function(alreadyExists, __callback) {
                    if (alreadyExists) {
                      return connection.query(`
                        update events_periods set
                          gamenumber = ?,
                          period_number = ?,
                          period_description = ?,
                          periodcutoff_datetimeGMT = ?,
                          period_update = ?,
                          moneyline_visiting = ?,
                          moneyline_home = ?,
                          moneyline_draw = ?,
                          spread_visiting = ?,
                          spread_adjust_visiting = ?,
                          spread_home = ?,
                          spread_adjust_home = ?,
                          total_points = ?,
                          over_adjust = ?,
                          under_adjust = ?
                        where gamenumber = ? and period_number = ?`, [
                          period.gamenumber,
                          period.period_number,
                          period.period_description,
                          period.periodcutoff_datetimeGMT,
                          period.period_update,
                          period.moneyline_visiting,
                          period.moneyline_home,
                          period.moneyline_draw,
                          period.spread_visiting,
                          period.spread_adjust_visiting,
                          period.spread_home,
                          period.spread_adjust_home,
                          period.total_points,
                          period.over_adjust,
                          period.under_adjust,
                          period.gamenumber,
                          period.period_number
                        ], __callback)
                    }

                    connection.query(`
                      insert into events_periods (
                        gamenumber,
                        period_number,
                        period_description,
                        periodcutoff_datetimeGMT,
                        period_update,
                        moneyline_visiting,
                        moneyline_home,
                        moneyline_draw,
                        spread_visiting,
                        spread_adjust_visiting,
                        spread_home,
                        spread_adjust_home,
                        total_points,
                        over_adjust,
                        under_adjust
                      )
                      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                      period.gamenumber,
                      period.period_number,
                      period.period_description,
                      period.periodcutoff_datetimeGMT,
                      period.period_update,
                      period.moneyline_visiting,
                      period.moneyline_home,
                      period.moneyline_draw,
                      period.spread_visiting,
                      period.spread_adjust_visiting,
                      period.spread_home,
                      period.spread_adjust_home,
                      period.total_points,
                      period.over_adjust,
                      period.under_adjust
                    ], __callback)
                  }
                ],_callback)
              }
            )
          }
        )
      },callback)
    },
      function(error) {
        connection.destroy()
        if (error) console.log('error while iterating over games',error)
      }
    )
  }
)

function sportTypeLeagueMap(league) {
  const sportMap = {
    MLB: 'Baseball',
    NFL: 'Football',
    FBC: 'Football',
    BKC: 'Basketball',
    NBA: 'Basketball',
    NHL: 'Hockey'
  }
  const leagueMap = {
    FBC: 'NCAA',
    BKC: 'NCAA'
  }
  return [
    sportMap[league],
    leagueMap[league] || league
  ]
}

function parseParticipantsAndPeriods(gameNumber, awayTeam, homeTeam) {
  const away = parseLine(awayTeam.CURRENTLINE)
  const home = parseLine(homeTeam.CURRENTLINE)
  // [spreadPoints1, spreadLine1, spreadType1] = parseLine(awayTeam.CURRENTLINE)
  // [spreadPoints2, spreadLine2, spreadType2] = parseLine(homeTeam.CURRENTLINE)
  let spreadPoints1 = away[0] || null
  let spreadLine1 = away[1] || null
  let spreadType1 = away[2]
  let spreadPoints2 = home[0] || null
  let spreadLine2 = home[1] || null
  let spreadType2 = home[2]

  let spreadHome
  let spreadHomeLine
  let spreadVisiting
  let spreadVisitingLine
  let ouPoints
  let ouLine
  if (spreadType1 == 'ou') {
    ouPoints = spreadPoints1
    ouLine = spreadLine1
    spreadHome = spreadPoints2
    spreadHomeLine = spreadLine2
    spreadVisiting = spreadPoints2 * -1
    spreadVisitingLine = (spreadLine2 * -1) - 20
    spreadVisitingLine = (Math.abs(spreadVisitingLine) < 100) ? (-110 + (100-Math.abs(spreadHomeLine))) : spreadVisitingLine
  } else {
    ouPoints = spreadPoints2
    ouLine = spreadLine2
    spreadVisiting = spreadPoints1
    spreadVisitingLine = spreadLine1
    spreadHome = spreadPoints1 * -1
    spreadHomeLine = (spreadLine1 * -1) - 20
    spreadHomeLine = (Math.abs(spreadHomeLine) < 100) ? (-110 + (100-Math.abs(spreadHomeLine))) : spreadHomeLine
  }


  return {
    participants: {
      away: {
        gamenumber: gameNumber,
        participant_name: titleCase(awayTeam.TEAMNAME),
        contestantnum: null,
        visiting_home_draw: 'Visiting',
        odds: null,
        total_points: null,
        units: null
      },
      home: {
        gamenumber: gameNumber,
        participant_name: titleCase(homeTeam.TEAMNAME),
        contestantnum: null,
        visiting_home_draw: 'Home',
        odds: null,
        total_points: null,
        units: null
      }
    },
    periods: {
      game: {
        gamenumber: gameNumber,
        period_number: 0,
        period_description: 'Game',
        periodcutoff_datetimeGMT: null,
        period_update: 'open',
        moneyline_visiting: awayTeam.CURRENTMONEYLINE,
        moneyline_home: homeTeam.CURRENTMONEYLINE,
        moneyline_draw: null,
        spread_visiting: spreadVisiting,
        spread_adjust_visiting: spreadVisitingLine,
        spread_home: spreadHome,
        spread_adjust_home: spreadHomeLine,
        total_points: ouPoints,
        over_adjust: ouLine,
        under_adjust: ouLine
      }
    }
  }
}

function parseLine(lineStr) {
  const aSpread = lineStr.split(' ')
  const points = parseFloat(aSpread[0])
  let line = -110
  let type = 'ou'
  if (aSpread.length > 1) {
    type = 'points'
    line = parseInt(aSpread[1] || line)
    if (Math.abs(line) < 100) {
      line += (line < 0) ? -100 : 100
    }
  }
  return [points, line, type]
}

function titleCase(string) {
  return string.replace(/(\w)(\w+)/g, function(match, p1, p2, p3, offset, string) {
    return `${p1.toUpperCase()}${p2.toLowerCase()}`
  })
}

function checkExists(query, values, callback) {
  connection.query(query, values, function(err, results, fields) {
    if (err) return callback(err)
    callback(null,results.length > 0)
  })
}
