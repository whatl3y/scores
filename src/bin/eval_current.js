import Scores from '../libs/Scores'
import Squairs from '../libs/Squairs'
import config from '../config'

const scores = new Scores()
const squairs = new Squairs(config.mysql.creds)

const leagueMap = {
  "NFL Football": "nfl",
  "NBA Basketball": "nba",
  "NCAA Football": "ncf",
  "NCAA Basketball": "ncb",
  "MLB Baseball": "mlb",
  "NHL Hockey": "nhl"
}

;(async () => {
  try {
    await squairs.connect()
    const rows = await squairs.query(config.squairs.unscoredEventsSql)
    if (rows && rows.length) {
      const unscoredEvents = rows[0]
      const finalGames = await scores.getAllFinalGames()
      if (finalGames && finalGames.length) {
        await Promise.all(
          unscoredEvents.map(async event => {
            if (squairs.notFinalScoreYet(event["StartDateGMT"])) return

            const curGames = finalGames.filter(g => Object.keys(g)[0] == leagueMap[event["SportLeague"]])[0][leagueMap[event["SportLeague"]]]
            await Promise.all(
              curGames.map(async game => {
                const visitingAliases = event["VisitingTeamAliases"]
                const homeAliases = event["HomeTeamAliases"]

                const o = scores.checkTeams({ visiting: visitingAliases, home: homeAliases }, game)
                if (typeof o === "object") {
                  o.templateID = event["tid"]
                  o.HomeTeamName = event["HomeTeamName"]
                  o.VisitingTeamName = event["VisitingTeamName"]

                  const responseBody = await squairs.postScore(o)
                  console.log(`Success: Template ID: ${o.templateID} - ${o.VisitingTeamName} ${o.visiting} at ${o.HomeTeamName} ${o.home}`)
                  // console.log('Response from postScore', responseBody)

                } else {
                  // console.log("o is not an object: " + o)
                }
              })
            )
          })
        )
      }
    }

    console.log('Successfully evaluated all events!')
    squairs.connection.destroy()

  } catch(err) {
    squairs.connection.destroy()
    console.error("Error", err)
  }
})()
