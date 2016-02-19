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

Score.getAllFinalGames(function(_err,data) {
  try {
    if (_err) throw _err
    
    var finalGames = data;
    
    var Sq = new Squairs(config.mysql.creds);
    Sq.connect(function(e) {
      if (e) {
        console.log("Squairs Error: ",e);
      } else {
        Sq.connection.query(config.squairs.unscoredEventsSql,function(e,rows) {
          if (e) {
            console.log("Squairs Error: ",e);
            return;
          }
          
          rows = rows[0];
          
          var curGames,visitingScore,homeScore,o;
          for (var _i=0;_i<rows.length;_i++) {
            curGames = finalGames.filter(function(g) {
              return Object.keys(g)[0] == leagueMap[rows[_i]["SportLeague"]];
            })[0][leagueMap[rows[_i]["SportLeague"]]];
            
            for (var _j=0;_j<curGames.length;_j++) {
              var visitingAliases = rows[_i]["VisitingTeamAliases"];
              var homeAliases = rows[_i]["HomeTeamAliases"];
              
              var o = Score.checkTeams({visiting:visitingAliases,home:homeAliases},curGames[_j]);
              
              if (typeof o==="object") {
                o.templateID = rows[_i]["tid"];
                o.HomeTeamName = rows[_i]["HomeTeamName"];
                o.VisitingTeamName = rows[_i]["VisitingTeamName"];
                
                Sq.postScore(o,function(e,ret,original) {
                  if (e) {
                    console.log("Squairs Error: ",e);
                  } else {
                    console.log("Success: Template ID: "+original.templateID+" - "+original.VisitingTeamName+" "+original.visiting+" at " +original.HomeTeamName+" "+original.home);
                  }
                });
              }
            }
          }
          
          Sq.connection.destroy();
        });
      }
    });
    
  } catch (e) {
    console.log("Scores Error: ",e);
  }
});