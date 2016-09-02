var async = require("async");
var config = require("./libs/config.js");
var Scores = require("./libs/Scores.js");
var Squairs = require("./libs/Squairs.js");

var Score = new Scores();
var leagueMap = {
  "NFL Football": "nfl",
  "NBA Basketball": "nba",
  "NCAA Football": "ncf",
  "NCAA Basketball": "ncb",
  "MLB Baseball": "mlb",
  "NHL Hockey": "nhl"
};

var Sq = new Squairs(config.mysql.creds);

async.waterfall([
  function(callback) {
    Sq.connect(function(e) {
      callback(e);
    });
  },
  function(callback) {
    Sq.connection.query(config.squairs.unscoredEventsSql,function(e,rows) {
      if (e) return callback(e);
      if (!rows || !rows.length) return callback("No unscores events from the Squairs database to grade.");

      return callback(null,rows[0]);
    });
  },
  function(unscoredEvents,callback) {
    Score.getAllFinalGames(function(_err,data) {
      if (_err) return callback(_err);
      if (!data || !data.length) return callback("No final games to evalutate from the scores source.");

      return callback(null,unscoredEvents,data);
    });
  }
],
  function(err,unscoredEvents,finalGames) {
    if (err) {
      Sq.connection.destroy();
      return console.trace("Error in main:",err);
    }

    try {
      var curGames,visitingScore,homeScore,o;
      for (var _i=0;_i<unscoredEvents.length;_i++) {
        if (Sq.notFinalScoreYet(unscoredEvents[_i]["StartDateGMT"] + " UTC")) continue;

        curGames = finalGames.filter(function(g) {
          return Object.keys(g)[0] == leagueMap[unscoredEvents[_i]["SportLeague"]];
        })[0][leagueMap[unscoredEvents[_i]["SportLeague"]]];

        if (curGames.length) {
          for (var _j=0;_j<curGames.length;_j++) {
            var visitingAliases = unscoredEvents[_i]["VisitingTeamAliases"];
            var homeAliases = unscoredEvents[_i]["HomeTeamAliases"];

            var o = Score.checkTeams({visiting:visitingAliases,home:homeAliases},curGames[_j]);

            if (typeof o==="object") {
              o.templateID = unscoredEvents[_i]["tid"];
              o.HomeTeamName = unscoredEvents[_i]["HomeTeamName"];
              o.VisitingTeamName = unscoredEvents[_i]["VisitingTeamName"];

              Sq.postScore(o,function(e,ret,original) {
                if (e) {
                  console.trace("Squairs Error: ",e);
                } else {
                  console.log("Success: Template ID: "+original.templateID+" - "+original.VisitingTeamName+" "+original.visiting+" at " +original.HomeTeamName+" "+original.home);
                }
              });
            } else {
              console.log("o is not an object: " + o)
            }
          }
        } else {
          // console.log("There are no current games to score.");
        }
      }

    } catch(_err) {
      console.trace("Error after IO:",_err);
    }

    Sq.connection.destroy();
  }
);
